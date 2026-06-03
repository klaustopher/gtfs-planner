package gtfsimport

import (
	"database/sql"
	"math"
	"strings"

	"gtfs-planner/internal/textfold"
)

// dedupeMaxDelta is the maximum |Δlat|+|Δlon| (degrees, ~0.008° ≈ <1 km) within
// which a standalone stop is merged into a same-named station instead of
// becoming its own pin.
const dedupeMaxDelta = 0.008

// normalizeStations maps a DELFI/opendata-ÖPNV feed onto the station model the
// app expects (location_type=1 = a map pin, platforms as children), so a single
// db.go query layer serves both feeds.
//
// gtfs.de already groups stops at the Haltestelle level, so it needs no change.
// DELFI instead encodes the grouping in the structured IFOPT stop id
// (de:<gemeinde>:<haltestelle>:<steig>:…) and leaves the individual platforms as
// standalone location_type=0 stops. For those we synthesize a parent station per
// Haltestelle prefix and attach the platforms to it; any remaining standalone
// stop becomes its own pin.
func normalizeStations(tx *sql.Tx) error {
	isDELFI, err := isIFOPTFeed(tx)
	if err != nil {
		return err
	}
	if !isDELFI {
		return nil
	}

	// aggregate accumulates the data needed to synthesize one parent station.
	type aggregate struct {
		sumLat, sumLon float64
		coordCount     int
		name           string
	}
	prefixes := make(map[string]*aggregate)
	var childIDs []string

	rows, err := tx.Query(`SELECT stop_id, stop_name, stop_lat, stop_lon FROM stops
		WHERE (parent_station IS NULL OR parent_station = '')
		  AND (location_type = 0 OR location_type IS NULL)
		  AND stop_id LIKE 'de:%:%:%'`)
	if err != nil {
		return err
	}
	for rows.Next() {
		var (
			id   string
			name sql.NullString
			lat  sql.NullFloat64
			lon  sql.NullFloat64
		)
		if err := rows.Scan(&id, &name, &lat, &lon); err != nil {
			rows.Close()
			return err
		}
		prefix := haltestellePrefix(id)
		if prefix == "" || prefix == id {
			continue // becomes its own pin in the final promote step
		}
		childIDs = append(childIDs, id)
		agg := prefixes[prefix]
		if agg == nil {
			agg = &aggregate{}
			prefixes[prefix] = agg
		}
		if agg.name == "" && name.Valid {
			agg.name = name.String
		}
		if lat.Valid && lon.Valid {
			agg.sumLat += lat.Float64
			agg.sumLon += lon.Float64
			agg.coordCount++
		}
	}
	if err := rows.Err(); err != nil {
		rows.Close()
		return err
	}
	// The cursor must be closed before issuing writes on the single-connection tx.
	rows.Close()

	// Insert synthetic parent stations (skipped if the id already exists as a
	// real station, e.g. a major hub like de:06412:10).
	insertParent, err := tx.Prepare(`INSERT OR IGNORE INTO stops
		(stop_id, stop_name, stop_name_fold, stop_lat, stop_lon, location_type) VALUES (?, ?, ?, ?, ?, 1)`)
	if err != nil {
		return err
	}
	for prefix, agg := range prefixes {
		var lat, lon interface{}
		if agg.coordCount > 0 {
			lat = agg.sumLat / float64(agg.coordCount)
			lon = agg.sumLon / float64(agg.coordCount)
		}
		if _, err := insertParent.Exec(prefix, nullStr(agg.name), nullStr(textfold.Fold(agg.name)), lat, lon); err != nil {
			insertParent.Close()
			return err
		}
	}
	insertParent.Close()

	// Attach each platform to its Haltestelle parent.
	reattach, err := tx.Prepare(`UPDATE stops SET parent_station = ? WHERE stop_id = ?`)
	if err != nil {
		return err
	}
	for _, id := range childIDs {
		if _, err := reattach.Exec(haltestellePrefix(id), id); err != nil {
			reattach.Close()
			return err
		}
	}
	reattach.Close()

	// Attach standalone stops that duplicate a nearby same-named station (e.g. a
	// numeric-id "Frankfurt (Main) Hauptbahnhof" that DELFI left unlinked) to
	// that station instead of letting them become a second pin.
	if err := dedupeStandaloneStops(tx); err != nil {
		return err
	}

	// Promote any remaining ungrouped standalone stop to its own pin so it is
	// visible on the map (grouped platforms now have a parent and are excluded).
	if _, err := tx.Exec(`UPDATE stops SET location_type = 1
		WHERE (parent_station IS NULL OR parent_station = '') AND location_type = 0`); err != nil {
		return err
	}
	return nil
}

// dedupeStandaloneStops attaches each parentless location_type=0 stop to an
// existing map-pin station (location_type=1) that has the exact same name and
// sits within dedupeMaxDelta. Same name alone is unreliable (generic names like
// "Bahnhof" repeat across the country), so proximity is required.
func dedupeStandaloneStops(tx *sql.Tx) error {
	type station struct {
		id       string
		lat, lon float64
	}

	// Index existing pins by name.
	byName := make(map[string][]station)
	rows, err := tx.Query(`SELECT stop_id, stop_name, stop_lat, stop_lon FROM stops
		WHERE location_type = 1 AND stop_name IS NOT NULL
		  AND stop_lat IS NOT NULL AND stop_lon IS NOT NULL`)
	if err != nil {
		return err
	}
	for rows.Next() {
		var s station
		var name string
		if err := rows.Scan(&s.id, &name, &s.lat, &s.lon); err != nil {
			rows.Close()
			return err
		}
		byName[name] = append(byName[name], s)
	}
	if err := rows.Err(); err != nil {
		rows.Close()
		return err
	}
	rows.Close()

	// Find the nearest same-named pin within range for each standalone stop.
	type match struct{ child, parent string }
	var matches []match
	rows, err = tx.Query(`SELECT stop_id, stop_name, stop_lat, stop_lon FROM stops
		WHERE location_type = 0 AND (parent_station IS NULL OR parent_station = '')
		  AND stop_name IS NOT NULL AND stop_lat IS NOT NULL AND stop_lon IS NOT NULL`)
	if err != nil {
		return err
	}
	for rows.Next() {
		var id, name string
		var lat, lon float64
		if err := rows.Scan(&id, &name, &lat, &lon); err != nil {
			rows.Close()
			return err
		}
		best, bestDelta := "", dedupeMaxDelta
		for _, s := range byName[name] {
			if s.id == id {
				continue
			}
			delta := math.Abs(s.lat-lat) + math.Abs(s.lon-lon)
			if delta < bestDelta {
				best, bestDelta = s.id, delta
			}
		}
		if best != "" {
			matches = append(matches, match{child: id, parent: best})
		}
	}
	if err := rows.Err(); err != nil {
		rows.Close()
		return err
	}
	rows.Close()

	attach, err := tx.Prepare(`UPDATE stops SET parent_station = ? WHERE stop_id = ?`)
	if err != nil {
		return err
	}
	defer attach.Close()
	for _, m := range matches {
		if _, err := attach.Exec(m.parent, m.child); err != nil {
			return err
		}
	}
	return nil
}

// isIFOPTFeed reports whether the stops use DELFI's structured IFOPT ids.
func isIFOPTFeed(tx *sql.Tx) (bool, error) {
	var exists int
	err := tx.QueryRow(`SELECT EXISTS(SELECT 1 FROM stops WHERE stop_id LIKE 'de:%:%:%')`).Scan(&exists)
	return exists == 1, err
}

// haltestellePrefix returns the first three colon-separated segments of a DELFI
// IFOPT stop id (de:<gemeinde>:<haltestelle>), or "" if it has fewer than three.
func haltestellePrefix(id string) string {
	parts := strings.SplitN(id, ":", 4)
	if len(parts) < 3 {
		return ""
	}
	return parts[0] + ":" + parts[1] + ":" + parts[2]
}
