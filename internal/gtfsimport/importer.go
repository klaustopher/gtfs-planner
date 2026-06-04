// Package gtfsimport reads a GTFS feed zip and builds the lean SQLite database
// the app reads from, natively in Go (no external tooling). It replaces the
// previous `npx gtfs-import` dependency.
package gtfsimport

import (
	"archive/zip"
	"context"
	"database/sql"
	"fmt"
	"io"
	"os"
	"path"
	"strconv"

	"gtfs-planner/internal/textfold"

	_ "github.com/mattn/go-sqlite3"
)

// progressEvery controls how often row progress is reported for large files.
const progressEvery = 5000

// Importer builds a SQLite database from a GTFS zip.
type Importer struct {
	progress   ProgressFunc
	skipped    int
	bytesRead  int64 // uncompressed bytes consumed so far across all files
	totalBytes int64 // sum of uncompressed sizes of the imported files
}

// New returns an Importer that reports progress via the given callback (may be nil).
func New(progress ProgressFunc) *Importer {
	return &Importer{progress: progress}
}

// Import reads the GTFS zip at zipPath and writes a fresh SQLite database to
// dbPath atomically: it builds a temp database alongside dbPath and renames it
// into place only on success, so a failed import never corrupts an existing DB.
func (im *Importer) Import(ctx context.Context, zipPath, dbPath string) (err error) {
	zr, err := zip.OpenReader(zipPath)
	if err != nil {
		return fmt.Errorf("failed to open feed zip: %w", err)
	}
	defer zr.Close()

	files := make(map[string]*zip.File, len(zr.File))
	for _, f := range zr.File {
		files[path.Base(f.Name)] = f
	}

	// Total uncompressed bytes of the files we import — drives a real progress
	// bar without a second pass over the (multi-GB) feed.
	for _, name := range []string{"stops.txt", "routes.txt", "trips.txt", "calendar.txt", "calendar_dates.txt", "stop_times.txt"} {
		if f := files[name]; f != nil {
			im.totalBytes += int64(f.UncompressedSize64)
		}
	}

	tmpPath := dbPath + ".import.tmp"
	removeDBFiles(tmpPath)

	db, err := openWriterDB(tmpPath)
	if err != nil {
		return err
	}
	// On any error, discard the temp database entirely.
	defer func() {
		db.Close()
		if err != nil {
			removeDBFiles(tmpPath)
		}
	}()

	if err = ApplyTables(db); err != nil {
		return err
	}

	tx, err := db.Begin()
	if err != nil {
		return fmt.Errorf("failed to begin transaction: %w", err)
	}
	defer func() {
		if err != nil {
			tx.Rollback()
		}
	}()

	if err = im.loadStops(ctx, tx, files["stops.txt"]); err != nil {
		return err
	}
	if err = im.loadRoutes(ctx, tx, files["routes.txt"]); err != nil {
		return err
	}
	if err = im.loadTrips(ctx, tx, files["trips.txt"]); err != nil {
		return err
	}
	if err = im.loadCalendar(ctx, tx, files["calendar.txt"]); err != nil {
		return err
	}
	if err = im.loadCalendarDates(ctx, tx, files["calendar_dates.txt"]); err != nil {
		return err
	}
	if err = im.loadStopTimes(ctx, tx, files["stop_times.txt"]); err != nil {
		return err
	}

	im.progress.report(Progress{Phase: PhaseImport, Current: im.totalBytes, Total: im.totalBytes, Message: "normalize"})
	if err = normalizeStations(tx); err != nil {
		return err
	}

	if err = tx.Commit(); err != nil {
		return fmt.Errorf("failed to commit import: %w", err)
	}

	im.progress.report(Progress{Phase: PhaseImport, Current: im.totalBytes, Total: im.totalBytes, Message: "index"})
	if err = ApplyIndexes(db); err != nil {
		return err
	}

	// After indexes exist, the per-station transport category can be aggregated by
	// streaming the covering stop_id index instead of a full sort over stop_times.
	im.progress.report(Progress{Phase: PhaseImport, Current: im.totalBytes, Total: im.totalBytes, Message: "categories"})
	if err = assignStationCategories(ctx, db); err != nil {
		return err
	}

	if err = db.Close(); err != nil {
		return fmt.Errorf("failed to close database: %w", err)
	}

	if im.skipped > 0 {
		im.progress.report(Progress{Phase: PhaseImport, Message: fmt.Sprintf("%d Zeilen übersprungen", im.skipped)})
	}

	if err = os.Rename(tmpPath, dbPath); err != nil {
		return fmt.Errorf("failed to publish database: %w", err)
	}
	return nil
}

// openWriterDB opens a read-write SQLite connection tuned for bulk import. All
// work runs on a single connection so the PRAGMAs and transaction stay together.
func openWriterDB(path string) (*sql.DB, error) {
	db, err := sql.Open("sqlite3", "file:"+path+"?mode=rwc")
	if err != nil {
		return nil, fmt.Errorf("failed to open writer database: %w", err)
	}
	db.SetMaxOpenConns(1)

	pragmas := []string{
		"PRAGMA page_size=4096", // must run before any table is created
		"PRAGMA journal_mode=OFF",
		"PRAGMA synchronous=OFF",
		"PRAGMA temp_store=MEMORY",
		"PRAGMA cache_size=-65536",
	}
	for _, p := range pragmas {
		if _, err := db.Exec(p); err != nil {
			db.Close()
			return nil, fmt.Errorf("pragma %q failed: %w", p, err)
		}
	}
	return db, nil
}

// loadFile opens the given zip entry, parses it as CSV, and calls handle for
// each row with the row and its header index. A nil file is skipped (the GTFS
// file is optional). handle returns true if the row was inserted, false if it
// was skipped (counted toward im.skipped).
func (im *Importer) loadFile(ctx context.Context, f *zip.File, handle func(row []string, h headerIndex) (bool, error)) error {
	if f == nil {
		return nil
	}

	rc, err := f.Open()
	if err != nil {
		return fmt.Errorf("failed to open %s: %w", f.Name, err)
	}
	defer rc.Close()

	base := path.Base(f.Name)
	cr, header, err := newCSVReader(&countingReader{r: rc, counter: &im.bytesRead})
	if err != nil {
		return fmt.Errorf("failed to read %s header: %w", base, err)
	}

	var rows int64
	im.reportBytes(base)

	for {
		if err := ctx.Err(); err != nil {
			return err
		}
		row, err := cr.Read()
		if err != nil {
			break // io.EOF or a malformed final record; stop reading this file
		}
		inserted, err := handle(row, header)
		if err != nil {
			return fmt.Errorf("failed to insert row in %s: %w", base, err)
		}
		if !inserted {
			im.skipped++
		}
		rows++
		if rows%progressEvery == 0 {
			im.reportBytes(base)
		}
	}

	im.reportBytes(base)
	return nil
}

// reportBytes emits import progress as bytes processed out of the total.
func (im *Importer) reportBytes(file string) {
	im.progress.report(Progress{
		Phase:   PhaseImport,
		File:    file,
		Current: im.bytesRead,
		Total:   im.totalBytes,
	})
}

// countingReader tallies bytes read from the underlying reader so the import can
// report real progress against the known uncompressed total.
type countingReader struct {
	r       io.Reader
	counter *int64
}

func (c *countingReader) Read(p []byte) (int, error) {
	n, err := c.r.Read(p)
	*c.counter += int64(n)
	return n, err
}

func (im *Importer) loadStops(ctx context.Context, tx *sql.Tx, f *zip.File) error {
	stmt, err := tx.Prepare(`INSERT OR IGNORE INTO stops
		(stop_id, stop_name, stop_name_fold, stop_lat, stop_lon, location_type, parent_station, platform_code)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?)`)
	if err != nil {
		return err
	}
	defer stmt.Close()

	return im.loadFile(ctx, f, func(row []string, h headerIndex) (bool, error) {
		id := h.get(row, "stop_id")
		if id == "" {
			return false, nil
		}
		name := h.get(row, "stop_name")
		_, err := stmt.Exec(
			id,
			nullStr(name),
			nullStr(textfold.Fold(name)),
			nullFloat(h.get(row, "stop_lat")),
			nullFloat(h.get(row, "stop_lon")),
			nullInt(h.get(row, "location_type")),
			nullStr(h.get(row, "parent_station")),
			nullStr(h.get(row, "platform_code")),
		)
		return err == nil, err
	})
}

func (im *Importer) loadRoutes(ctx context.Context, tx *sql.Tx, f *zip.File) error {
	stmt, err := tx.Prepare(`INSERT OR IGNORE INTO routes
		(route_id, route_short_name, route_long_name, route_desc, route_type, route_color, route_text_color)
		VALUES (?, ?, ?, ?, ?, ?, ?)`)
	if err != nil {
		return err
	}
	defer stmt.Close()

	return im.loadFile(ctx, f, func(row []string, h headerIndex) (bool, error) {
		id := h.get(row, "route_id")
		if id == "" {
			return false, nil
		}
		_, err := stmt.Exec(
			id,
			nullStr(h.get(row, "route_short_name")),
			nullStr(h.get(row, "route_long_name")),
			nullStr(h.get(row, "route_desc")),
			nullInt(h.get(row, "route_type")),
			nullStr(h.get(row, "route_color")),
			nullStr(h.get(row, "route_text_color")),
		)
		return err == nil, err
	})
}

func (im *Importer) loadTrips(ctx context.Context, tx *sql.Tx, f *zip.File) error {
	stmt, err := tx.Prepare(`INSERT OR IGNORE INTO trips
		(trip_id, route_id, service_id, trip_headsign) VALUES (?, ?, ?, ?)`)
	if err != nil {
		return err
	}
	defer stmt.Close()

	return im.loadFile(ctx, f, func(row []string, h headerIndex) (bool, error) {
		id := h.get(row, "trip_id")
		if id == "" {
			return false, nil
		}
		_, err := stmt.Exec(
			id,
			nullStr(h.get(row, "route_id")),
			nullStr(h.get(row, "service_id")),
			nullStr(h.get(row, "trip_headsign")),
		)
		return err == nil, err
	})
}

func (im *Importer) loadCalendar(ctx context.Context, tx *sql.Tx, f *zip.File) error {
	stmt, err := tx.Prepare(`INSERT OR IGNORE INTO calendar
		(service_id, monday, tuesday, wednesday, thursday, friday, saturday, sunday, start_date, end_date)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
	if err != nil {
		return err
	}
	defer stmt.Close()

	return im.loadFile(ctx, f, func(row []string, h headerIndex) (bool, error) {
		id := h.get(row, "service_id")
		if id == "" {
			return false, nil
		}
		_, err := stmt.Exec(
			id,
			nullInt(h.get(row, "monday")), nullInt(h.get(row, "tuesday")),
			nullInt(h.get(row, "wednesday")), nullInt(h.get(row, "thursday")),
			nullInt(h.get(row, "friday")), nullInt(h.get(row, "saturday")),
			nullInt(h.get(row, "sunday")),
			nullStr(h.get(row, "start_date")), nullStr(h.get(row, "end_date")),
		)
		return err == nil, err
	})
}

func (im *Importer) loadCalendarDates(ctx context.Context, tx *sql.Tx, f *zip.File) error {
	stmt, err := tx.Prepare(`INSERT OR IGNORE INTO calendar_dates
		(service_id, date, exception_type) VALUES (?, ?, ?)`)
	if err != nil {
		return err
	}
	defer stmt.Close()

	return im.loadFile(ctx, f, func(row []string, h headerIndex) (bool, error) {
		id := h.get(row, "service_id")
		date := h.get(row, "date")
		if id == "" || date == "" {
			return false, nil
		}
		_, err := stmt.Exec(id, date, nullInt(h.get(row, "exception_type")))
		return err == nil, err
	})
}

func (im *Importer) loadStopTimes(ctx context.Context, tx *sql.Tx, f *zip.File) error {
	stmt, err := tx.Prepare(`INSERT OR IGNORE INTO stop_times
		(trip_id, stop_id, stop_sequence, arrival_time, departure_time)
		VALUES (?, ?, ?, ?, ?)`)
	if err != nil {
		return err
	}
	defer stmt.Close()

	return im.loadFile(ctx, f, func(row []string, h headerIndex) (bool, error) {
		tripID := h.get(row, "trip_id")
		stopID := h.get(row, "stop_id")
		seq := h.get(row, "stop_sequence")
		if tripID == "" || stopID == "" || seq == "" {
			return false, nil
		}
		seqNum, convErr := strconv.Atoi(seq)
		if convErr != nil {
			return false, nil // stop_sequence is part of the PK; skip unparseable rows
		}
		_, err := stmt.Exec(
			tripID, stopID, seqNum,
			nullStr(h.get(row, "arrival_time")),
			nullStr(h.get(row, "departure_time")),
		)
		return err == nil, err
	})
}

// nullStr maps "" to SQL NULL so db.go's COALESCE handling works.
func nullStr(s string) interface{} {
	if s == "" {
		return nil
	}
	return s
}

// nullInt parses an integer column, returning NULL for empty/invalid values.
func nullInt(s string) interface{} {
	if s == "" {
		return nil
	}
	n, err := strconv.Atoi(s)
	if err != nil {
		return nil
	}
	return n
}

// nullFloat parses a real column, returning NULL for empty/invalid values.
func nullFloat(s string) interface{} {
	if s == "" {
		return nil
	}
	v, err := strconv.ParseFloat(s, 64)
	if err != nil {
		return nil
	}
	return v
}

// removeDBFiles deletes a SQLite database file and its -wal/-shm siblings.
func removeDBFiles(path string) {
	for _, suffix := range []string{"", "-wal", "-shm", "-journal"} {
		os.Remove(path + suffix)
	}
}
