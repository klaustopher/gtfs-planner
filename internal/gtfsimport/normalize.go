package gtfsimport

import (
	"database/sql"
	"strings"
)

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
		(stop_id, stop_name, stop_lat, stop_lon, location_type) VALUES (?, ?, ?, ?, 1)`)
	if err != nil {
		return err
	}
	for prefix, agg := range prefixes {
		var lat, lon interface{}
		if agg.coordCount > 0 {
			lat = agg.sumLat / float64(agg.coordCount)
			lon = agg.sumLon / float64(agg.coordCount)
		}
		if _, err := insertParent.Exec(prefix, nullStr(agg.name), lat, lon); err != nil {
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

	// Promote any remaining ungrouped standalone stop to its own pin so it is
	// visible on the map (grouped platforms now have a parent and are excluded).
	if _, err := tx.Exec(`UPDATE stops SET location_type = 1
		WHERE (parent_station IS NULL OR parent_station = '') AND location_type = 0`); err != nil {
		return err
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
