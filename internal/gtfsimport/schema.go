package gtfsimport

import (
	"database/sql"
	"fmt"
)

// The schema is intentionally lean: only the columns internal/db reads, no
// CHECK/TYPEOF constraints (those are what make strict importers abort on real
// feeds, and they slow bulk inserts), WITHOUT ROWID for the text-PK tables, and
// the two STORED generated timestamp columns that db.go relies on.
//
// The substr-based generated columns convert "HH:MM:SS" to seconds since
// midnight and correctly handle GTFS times >= 24:00:00 and single-digit hours
// (e.g. "8:00:00").

const departureTimestampExpr = `INTEGER GENERATED ALWAYS AS (
		CASE WHEN departure_time IS NULL OR departure_time = '' THEN NULL
		ELSE CAST(substr(departure_time, 1, instr(departure_time, ':') - 1) * 3600 +
		          substr(departure_time, instr(departure_time, ':') + 1, 2) * 60 +
		          substr(departure_time, -2) AS INTEGER) END) STORED`

const arrivalTimestampExpr = `INTEGER GENERATED ALWAYS AS (
		CASE WHEN arrival_time IS NULL OR arrival_time = '' THEN NULL
		ELSE CAST(substr(arrival_time, 1, instr(arrival_time, ':') - 1) * 3600 +
		          substr(arrival_time, instr(arrival_time, ':') + 1, 2) * 60 +
		          substr(arrival_time, -2) AS INTEGER) END) STORED`

var createTableStatements = []string{
	`CREATE TABLE stops (
		stop_id        TEXT PRIMARY KEY,
		stop_name      TEXT COLLATE NOCASE,
		stop_lat       REAL,
		stop_lon       REAL,
		location_type  INTEGER,
		parent_station TEXT,
		platform_code  TEXT
	) WITHOUT ROWID`,

	`CREATE TABLE routes (
		route_id         TEXT PRIMARY KEY,
		route_short_name TEXT COLLATE NOCASE,
		route_long_name  TEXT COLLATE NOCASE,
		route_desc       TEXT,
		route_type       INTEGER,
		route_color      TEXT,
		route_text_color TEXT
	) WITHOUT ROWID`,

	`CREATE TABLE trips (
		trip_id       TEXT PRIMARY KEY,
		route_id      TEXT,
		service_id    TEXT,
		trip_headsign TEXT COLLATE NOCASE
	) WITHOUT ROWID`,

	`CREATE TABLE stop_times (
		trip_id             TEXT NOT NULL,
		stop_id             TEXT NOT NULL,
		stop_sequence       INTEGER NOT NULL,
		arrival_time        TEXT,
		departure_time      TEXT,
		arrival_timestamp   ` + arrivalTimestampExpr + `,
		departure_timestamp ` + departureTimestampExpr + `,
		PRIMARY KEY (trip_id, stop_sequence)
	) WITHOUT ROWID`,

	`CREATE TABLE calendar (
		service_id TEXT PRIMARY KEY,
		monday     INTEGER,
		tuesday    INTEGER,
		wednesday  INTEGER,
		thursday   INTEGER,
		friday     INTEGER,
		saturday   INTEGER,
		sunday     INTEGER,
		start_date TEXT,
		end_date   TEXT
	) WITHOUT ROWID`,

	`CREATE TABLE calendar_dates (
		service_id     TEXT NOT NULL,
		date           TEXT NOT NULL,
		exception_type INTEGER NOT NULL,
		PRIMARY KEY (service_id, date)
	) WITHOUT ROWID`,
}

// createIndexStatements are purpose-built for the queries in internal/db.
var createIndexStatements = []string{
	// Hot path: upcoming departures at a stop from a timestamp onward.
	`CREATE INDEX idx_stop_times_stop_dep ON stop_times(stop_id, departure_timestamp)`,
	// Parent-station joins (routes via children, normalization).
	`CREATE INDEX idx_stops_parent ON stops(parent_station)`,
	// Bounding-box queries always filter location_type = 1.
	`CREATE INDEX idx_stops_geo ON stops(stop_lat, stop_lon) WHERE location_type = 1`,
	// routes -> trips -> stop_times joins.
	`CREATE INDEX idx_trips_route ON trips(route_id)`,
}

// ApplyTables creates the (empty) tables. Run before bulk inserts.
func ApplyTables(db *sql.DB) error {
	for _, stmt := range createTableStatements {
		if _, err := db.Exec(stmt); err != nil {
			return fmt.Errorf("create table failed: %w", err)
		}
	}
	return nil
}

// ApplyIndexes creates the indexes and runs ANALYZE. Run after inserts and
// normalization so bulk loading stays fast and the planner gets statistics.
func ApplyIndexes(db *sql.DB) error {
	for _, stmt := range createIndexStatements {
		if _, err := db.Exec(stmt); err != nil {
			return fmt.Errorf("create index failed: %w", err)
		}
	}
	if _, err := db.Exec("ANALYZE"); err != nil {
		return fmt.Errorf("analyze failed: %w", err)
	}
	return nil
}
