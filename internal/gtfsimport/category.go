package gtfsimport

import (
	"context"
	"database/sql"
)

// assignStationCategories precomputes a single dominant transport category per
// parent station and writes it to stops.station_category. The map uses it to pick
// a per-service icon (rail, S-Bahn, U-Bahn, tram, bus, ferry …) without doing the
// stops→stop_times→trips→routes join per pin at query time.
//
// A station typically has several services; the "most important" one wins the icon
// via a priority rank (long-distance rail > regional > rail > S-Bahn > U-Bahn >
// tram > ferry > monorail > trolleybus > bus > other). The rank is computed per
// serving route, aggregated with MIN per station, then mapped back to the category
// id used by routeTypeCategoryExpr (and the frontend's transportCategory).
//
// Runs AFTER indexes are built so the heavy step — aggregating route types across
// every stop_time — can stream the covering index idx_stop_times_stop_dep
// (stop_id, …, trip_id) in stop_id order with no temporary sort:
//
//  1. trip_cat:    trip_id -> rank          (trips ⋈ routes, both PK lookups)
//  2. stop_cat:    stop_id -> MIN(rank)     (index-ordered GROUP BY stop_id, no sort)
//  3. station_cat: parent  -> category      (roll children up to their station)
//  4. UPDATE stops.station_category from station_cat
func assignStationCategories(ctx context.Context, db *sql.DB) error {
	if err := ctx.Err(); err != nil {
		return err
	}
	stmts := []string{
		`CREATE TEMP TABLE trip_cat (trip_id TEXT PRIMARY KEY, rank INTEGER) WITHOUT ROWID`,
		`INSERT INTO trip_cat (trip_id, rank)
			SELECT t.trip_id, ` + routeTypeRankExpr("r.route_type") + `
			FROM trips t
			JOIN routes r ON r.route_id = t.route_id
			WHERE r.route_type IS NOT NULL`,

		// GROUP BY stop_id matches idx_stop_times_stop_dep, which (being a secondary
		// index on a WITHOUT ROWID table) also carries trip_id — so this is a
		// covering, sort-free streaming aggregation over stop_times.
		`CREATE TEMP TABLE stop_cat (stop_id TEXT PRIMARY KEY, rank INTEGER) WITHOUT ROWID`,
		`INSERT INTO stop_cat (stop_id, rank)
			SELECT st.stop_id, MIN(tc.rank)
			FROM stop_times st
			JOIN trip_cat tc ON tc.trip_id = st.trip_id
			GROUP BY st.stop_id`,

		`CREATE TEMP TABLE station_cat (station_id TEXT PRIMARY KEY, category INTEGER) WITHOUT ROWID`,
		`INSERT INTO station_cat (station_id, category)
			SELECT station_id, ` + rankToCategoryExpr("best_rank") + `
			FROM (
				SELECT COALESCE(NULLIF(child.parent_station, ''), child.stop_id) AS station_id,
				       MIN(sc.rank) AS best_rank
				FROM stop_cat sc
				JOIN stops child ON child.stop_id = sc.stop_id
				GROUP BY station_id
			)`,

		`UPDATE stops SET station_category = (
			SELECT category FROM station_cat WHERE station_id = stops.stop_id
		) WHERE location_type = 1`,

		`DROP TABLE station_cat`,
		`DROP TABLE stop_cat`,
		`DROP TABLE trip_cat`,
	}
	for _, s := range stmts {
		if _, err := db.Exec(s); err != nil {
			return err
		}
	}
	return nil
}

// routeTypeRankExpr maps a GTFS route_type (standard 0-12 or extended 100-1700)
// to an icon-priority rank: lower wins when a station is served by several modes.
// Order in the CASE matters (specific extended rail codes before the 100-199
// range, monorail 405 before the 400-499 metro range).
func routeTypeRankExpr(col string) string {
	return `CASE
		WHEN ` + col + ` IN (101, 102) THEN 1
		WHEN ` + col + ` IN (103, 106, 107, 108) THEN 2
		WHEN ` + col + ` = 109 THEN 4
		WHEN ` + col + ` = 2 OR (` + col + ` BETWEEN 100 AND 199) THEN 3
		WHEN ` + col + ` = 1 THEN 5
		WHEN ` + col + ` = 405 THEN 8
		WHEN ` + col + ` BETWEEN 400 AND 499 THEN 5
		WHEN ` + col + ` = 0 OR (` + col + ` BETWEEN 900 AND 999) THEN 6
		WHEN ` + col + ` = 4 OR ` + col + ` IN (1000, 1200) THEN 7
		WHEN ` + col + ` = 12 THEN 8
		WHEN ` + col + ` = 11 OR ` + col + ` = 800 THEN 9
		WHEN ` + col + ` = 3 OR (` + col + ` BETWEEN 700 AND 799)
		     OR (` + col + ` BETWEEN 200 AND 299) OR (` + col + ` BETWEEN 1500 AND 1599) THEN 10
		WHEN ` + col + ` IN (5, 6, 7) OR (` + col + ` BETWEEN 1300 AND 1499) THEN 11
		ELSE 50 END`
}

// rankToCategoryExpr maps a winning rank from routeTypeRankExpr back to the
// transport category id (see routeTypeCategoryExpr / frontend transportCategory).
func rankToCategoryExpr(col string) string {
	return `CASE ` + col + `
		WHEN 1 THEN 101
		WHEN 2 THEN 106
		WHEN 3 THEN 2
		WHEN 4 THEN 109
		WHEN 5 THEN 1
		WHEN 6 THEN 0
		WHEN 7 THEN 4
		WHEN 8 THEN 12
		WHEN 9 THEN 11
		WHEN 10 THEN 3
		WHEN 11 THEN 5
		ELSE -1 END`
}
