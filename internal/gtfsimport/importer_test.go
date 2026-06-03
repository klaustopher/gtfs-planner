package gtfsimport

import (
	"archive/zip"
	"context"
	"database/sql"
	"errors"
	"io"
	"os"
	"path/filepath"
	"testing"

	"gtfs-planner/internal/db"

	_ "github.com/mattn/go-sqlite3"
)

// writeZip builds a GTFS zip from name->content and returns its path.
func writeZip(t *testing.T, files map[string]string) string {
	t.Helper()
	zipPath := filepath.Join(t.TempDir(), "feed.zip")
	f, err := os.Create(zipPath)
	if err != nil {
		t.Fatalf("create zip: %v", err)
	}
	zw := zip.NewWriter(f)
	for name, content := range files {
		w, err := zw.Create(name)
		if err != nil {
			t.Fatalf("zip create entry: %v", err)
		}
		if _, err := io.WriteString(w, content); err != nil {
			t.Fatalf("zip write: %v", err)
		}
	}
	if err := zw.Close(); err != nil {
		t.Fatalf("zip close: %v", err)
	}
	f.Close()
	return zipPath
}

func openRO(t *testing.T, dbPath string) *sql.DB {
	t.Helper()
	conn, err := sql.Open("sqlite3", "file:"+dbPath+"?mode=ro")
	if err != nil {
		t.Fatalf("open db: %v", err)
	}
	t.Cleanup(func() { conn.Close() })
	return conn
}

func runImport(t *testing.T, files map[string]string) string {
	t.Helper()
	zipPath := writeZip(t, files)
	dbPath := filepath.Join(t.TempDir(), "out.sqlite")
	if err := New(nil).Import(context.Background(), zipPath, dbPath); err != nil {
		t.Fatalf("import: %v", err)
	}
	return dbPath
}

// gtfs.de-style feed: shuffled, unquoted columns; single-digit and overnight
// times; an empty arrival_time.
var gtfsDEFiles = map[string]string{
	"stops.txt": "stop_name,parent_station,stop_id,stop_lat,stop_lon,location_type,platform_code\n" +
		"Hauptbahnhof,,S1,50.10,8.66,1,\n" +
		"Hauptbahnhof,S1,S1a,50.11,8.67,,1\n" +
		"Hauptbahnhof,S1,S1b,50.12,8.68,,2\n" +
		"Hauptbahnhof,S1,S1c,50.13,8.69,,3\n",
	"routes.txt": "route_long_name,route_short_name,agency_id,route_type,route_id,route_color,route_text_color\n" +
		"Regio,RE1,a,2,R1,FF0000,FFFFFF\n",
	"trips.txt": "route_id,service_id,trip_id\nR1,SVC1,T1\n",
	"stop_times.txt": "trip_id,arrival_time,departure_time,stop_id,stop_sequence,stop_headsign,pickup_type,drop_off_type\n" +
		"T1,08:00:00,8:00:00,S1a,0,,,\n" +
		"T1,25:10:00,25:10:00,S1b,1,,,\n" +
		"T1,,09:00:00,S1c,2,,,\n",
	"calendar.txt": "monday,tuesday,wednesday,thursday,friday,saturday,sunday,start_date,end_date,service_id\n" +
		"1,1,1,1,1,1,1,20200101,20301231,SVC1\n",
	"calendar_dates.txt": "service_id,exception_type,date\nSVC1,1,20240101\n",
}

func TestImportTablesAndCounts(t *testing.T) {
	dbPath := runImport(t, gtfsDEFiles)
	conn := openRO(t, dbPath)

	counts := map[string]int{
		"stops": 4, "routes": 1, "trips": 1, "stop_times": 3,
		"calendar": 1, "calendar_dates": 1,
	}
	for table, want := range counts {
		var got int
		if err := conn.QueryRow("SELECT COUNT(*) FROM " + table).Scan(&got); err != nil {
			t.Fatalf("count %s: %v", table, err)
		}
		if got != want {
			t.Errorf("%s count = %d, want %d", table, got, want)
		}
	}
}

func TestImportGeneratedTimestamps(t *testing.T) {
	dbPath := runImport(t, gtfsDEFiles)
	conn := openRO(t, dbPath)

	// single-digit hour "8:00:00" -> 28800
	var dep int
	if err := conn.QueryRow(`SELECT departure_timestamp FROM stop_times WHERE stop_id='S1a'`).Scan(&dep); err != nil {
		t.Fatalf("query S1a: %v", err)
	}
	if dep != 28800 {
		t.Errorf("departure_timestamp S1a = %d, want 28800", dep)
	}

	// overnight "25:10:00" -> 90600
	if err := conn.QueryRow(`SELECT departure_timestamp FROM stop_times WHERE stop_id='S1b'`).Scan(&dep); err != nil {
		t.Fatalf("query S1b: %v", err)
	}
	if dep != 90600 {
		t.Errorf("departure_timestamp S1b = %d, want 90600", dep)
	}

	// empty arrival_time -> NULL timestamp
	var arr sql.NullInt64
	if err := conn.QueryRow(`SELECT arrival_timestamp FROM stop_times WHERE stop_id='S1c'`).Scan(&arr); err != nil {
		t.Fatalf("query S1c: %v", err)
	}
	if arr.Valid {
		t.Errorf("arrival_timestamp S1c = %d, want NULL", arr.Int64)
	}
}

func TestImportColumnMappingByName(t *testing.T) {
	dbPath := runImport(t, gtfsDEFiles)
	conn := openRO(t, dbPath)

	// Despite the shuffled header, platform_code and parent_station must land right.
	var platform, parent string
	err := conn.QueryRow(`SELECT platform_code, parent_station FROM stops WHERE stop_id='S1a'`).Scan(&platform, &parent)
	if err != nil {
		t.Fatalf("query S1a: %v", err)
	}
	if platform != "1" {
		t.Errorf("platform_code = %q, want \"1\"", platform)
	}
	if parent != "S1" {
		t.Errorf("parent_station = %q, want \"S1\"", parent)
	}
}

func TestImportIndexesExist(t *testing.T) {
	dbPath := runImport(t, gtfsDEFiles)
	conn := openRO(t, dbPath)

	want := []string{"idx_stop_times_stop_dep", "idx_stops_parent", "idx_stops_geo", "idx_trips_route"}
	for _, name := range want {
		var n int
		if err := conn.QueryRow(`SELECT COUNT(*) FROM sqlite_master WHERE type='index' AND name=?`, name).Scan(&n); err != nil {
			t.Fatalf("query index %s: %v", name, err)
		}
		if n != 1 {
			t.Errorf("index %s missing", name)
		}
	}
}

func TestImportNoCalendar(t *testing.T) {
	files := map[string]string{}
	for k, v := range gtfsDEFiles {
		files[k] = v
	}
	delete(files, "calendar.txt") // calendar_dates-only feed

	dbPath := runImport(t, files)
	conn := openRO(t, dbPath)

	var n int
	if err := conn.QueryRow("SELECT COUNT(*) FROM calendar").Scan(&n); err != nil {
		t.Fatalf("count calendar: %v", err)
	}
	if n != 0 {
		t.Errorf("calendar count = %d, want 0", n)
	}
}

// DELFI/IFOPT feed: standalone platforms grouped by Haltestelle prefix.
var delfiFiles = map[string]string{
	"stops.txt": "stop_id,stop_name,stop_lat,stop_lon,location_type,parent_station\n" +
		"de:1:100:1:1,Bahnhofsplatz,50.10,8.66,0,\n" +
		"de:1:100:2:2,Bahnhofsplatz,50.12,8.68,0,\n" +
		"de:1:200,Solostop,51.00,9.00,0,\n",
	"routes.txt":         "route_id,route_short_name,route_type\nR1,RE1,106\n",
	"trips.txt":          "route_id,service_id,trip_id\nR1,SVC1,T1\n",
	"stop_times.txt":     "trip_id,stop_id,stop_sequence,arrival_time,departure_time\nT1,de:1:100:1:1,0,08:00:00,08:00:00\nT1,de:1:100:2:2,1,08:05:00,08:05:00\n",
	"calendar.txt":       "service_id,monday,tuesday,wednesday,thursday,friday,saturday,sunday,start_date,end_date\nSVC1,1,1,1,1,1,1,1,20200101,20301231\n",
	"calendar_dates.txt": "service_id,date,exception_type\nSVC1,20240101,1\n",
}

func TestImportNormalizesDELFIHierarchy(t *testing.T) {
	dbPath := runImport(t, delfiFiles)
	conn := openRO(t, dbPath)

	// A synthetic parent station for the Haltestelle prefix exists as a pin.
	var locType int
	if err := conn.QueryRow(`SELECT location_type FROM stops WHERE stop_id='de:1:100'`).Scan(&locType); err != nil {
		t.Fatalf("synthetic parent de:1:100 missing: %v", err)
	}
	if locType != 1 {
		t.Errorf("synthetic parent location_type = %d, want 1", locType)
	}

	// Both platforms are attached to it.
	for _, id := range []string{"de:1:100:1:1", "de:1:100:2:2"} {
		var parent string
		if err := conn.QueryRow(`SELECT parent_station FROM stops WHERE stop_id=?`, id).Scan(&parent); err != nil {
			t.Fatalf("query %s: %v", id, err)
		}
		if parent != "de:1:100" {
			t.Errorf("%s parent_station = %q, want de:1:100", id, parent)
		}
	}

	// The standalone Haltestelle-level stop is promoted to its own pin.
	if err := conn.QueryRow(`SELECT location_type FROM stops WHERE stop_id='de:1:200'`).Scan(&locType); err != nil {
		t.Fatalf("query de:1:200: %v", err)
	}
	if locType != 1 {
		t.Errorf("de:1:200 location_type = %d, want 1", locType)
	}

	// The synthetic parent is centered on the mean of its children.
	var lat float64
	if err := conn.QueryRow(`SELECT stop_lat FROM stops WHERE stop_id='de:1:100'`).Scan(&lat); err != nil {
		t.Fatalf("query parent lat: %v", err)
	}
	if lat < 50.10 || lat > 50.12 {
		t.Errorf("synthetic parent lat = %v, want between child coords", lat)
	}
}

func TestImportDedupesStandaloneStopsByNameAndProximity(t *testing.T) {
	files := map[string]string{
		"stops.txt": "stop_id,stop_name,stop_lat,stop_lon,location_type,parent_station\n" +
			"de:5:500:1:1,Teststadt Hbf,50.0000,8.0000,0,\n" + // IFOPT platform → synthetic parent de:5:500
			"900900,Teststadt Hbf,50.0005,8.0005,0,\n" + // numeric, same name, nearby → attach
			"900901,Teststadt Hbf,51.5000,9.5000,0,\n", // numeric, same name, far away → own pin
	}
	dbPath := runImport(t, files)
	conn := openRO(t, dbPath)

	// The nearby duplicate is attached to the synthetic Haltestelle, not a pin.
	var parent string
	var locType int
	if err := conn.QueryRow(`SELECT parent_station, location_type FROM stops WHERE stop_id='900900'`).Scan(&parent, &locType); err != nil {
		t.Fatalf("query 900900: %v", err)
	}
	if parent != "de:5:500" {
		t.Errorf("nearby duplicate parent_station = %q, want de:5:500", parent)
	}
	if locType == 1 {
		t.Errorf("nearby duplicate should not be promoted to a pin")
	}

	// The far-away same-named stop stays an independent pin.
	if err := conn.QueryRow(`SELECT location_type FROM stops WHERE stop_id='900901'`).Scan(&locType); err != nil {
		t.Fatalf("query 900901: %v", err)
	}
	if locType != 1 {
		t.Errorf("far-away stop location_type = %d, want 1 (own pin)", locType)
	}
}

func TestImportAtomicityLeavesExistingDBOnCorruptZip(t *testing.T) {
	dir := t.TempDir()
	dbPath := filepath.Join(dir, "out.sqlite")
	if err := os.WriteFile(dbPath, []byte("ORIGINAL"), 0o644); err != nil {
		t.Fatalf("seed db: %v", err)
	}

	badZip := filepath.Join(dir, "bad.zip")
	if err := os.WriteFile(badZip, []byte("not a zip"), 0o644); err != nil {
		t.Fatalf("write bad zip: %v", err)
	}

	if err := New(nil).Import(context.Background(), badZip, dbPath); err == nil {
		t.Fatal("expected import error on corrupt zip")
	}

	got, err := os.ReadFile(dbPath)
	if err != nil {
		t.Fatalf("read db: %v", err)
	}
	if string(got) != "ORIGINAL" {
		t.Errorf("existing db was modified: %q", got)
	}
	if _, err := os.Stat(dbPath + ".import.tmp"); !os.IsNotExist(err) {
		t.Errorf("temp import file was left behind")
	}
}

func TestImportCancellation(t *testing.T) {
	zipPath := writeZip(t, gtfsDEFiles)
	dbPath := filepath.Join(t.TempDir(), "out.sqlite")

	ctx, cancel := context.WithCancel(context.Background())
	cancel() // cancel before the import starts

	err := New(nil).Import(ctx, zipPath, dbPath)
	if !errors.Is(err, context.Canceled) {
		t.Fatalf("Import() error = %v, want context.Canceled", err)
	}
	if _, err := os.Stat(dbPath); !os.IsNotExist(err) {
		t.Errorf("database should not be created on cancellation")
	}
	if _, err := os.Stat(dbPath + ".import.tmp"); !os.IsNotExist(err) {
		t.Errorf("temp import file should be cleaned up on cancellation")
	}
}

// TestImportRoundTripThroughDB proves the produced schema satisfies db.go.
func TestImportRoundTripThroughDB(t *testing.T) {
	dbPath := runImport(t, gtfsDEFiles)

	database, err := db.Open(dbPath)
	if err != nil {
		t.Fatalf("db.Open: %v", err)
	}
	defer database.Close()

	stops, err := database.GetStops(51, 50, 9, 8) // bbox around the parent station
	if err != nil {
		t.Fatalf("GetStops: %v", err)
	}
	if len(stops) != 1 || stops[0].StopID != "S1" {
		t.Fatalf("GetStops = %+v, want only parent S1", stops)
	}

	trips, err := database.GetUpcomingTripsForStations([]string{"S1"}, "2024-01-01T07:00:00", 10, nil)
	if err != nil {
		t.Fatalf("GetUpcomingTripsForStations: %v", err)
	}
	if len(trips.Trips) == 0 {
		t.Fatal("expected at least one upcoming trip from S1")
	}
}
