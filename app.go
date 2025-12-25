package main

import (
	"context"
	"database/sql"
	"fmt"

	_ "github.com/mattn/go-sqlite3"
)

// Stop represents a GTFS stop
type Stop struct {
	StopID   string  `json:"stop_id"`
	StopName string  `json:"stop_name"`
	StopLat  float64 `json:"stop_lat"`
	StopLon  float64 `json:"stop_lon"`
}

// Route represents a GTFS route
type Route struct {
	RouteID        string `json:"route_id"`
	RouteShortName string `json:"route_short_name"`
	RouteLongName  string `json:"route_long_name"`
	RouteDesc      string `json:"route_desc"`
	RouteType      int    `json:"route_type"`
	RouteColor     string `json:"route_color"`
	RouteTextColor string `json:"route_text_color"`
}

// StationDetails contains station info and its routes
type StationDetails struct {
	StopID   string  `json:"stop_id"`
	StopName string  `json:"stop_name"`
	StopLat  float64 `json:"stop_lat"`
	StopLon  float64 `json:"stop_lon"`
	Routes   []Route `json:"routes"`
}

// App struct
type App struct {
	ctx context.Context
	db  *sql.DB
}

// NewApp creates a new App application struct
func NewApp() *App {
	return &App{}
}

// startup is called when the app starts. The context is saved
// so we can call the runtime methods
func (a *App) startup(ctx context.Context) {
	a.ctx = ctx

	// Open the SQLite database
	db, err := sql.Open("sqlite3", "gtfs-data/sqlite/gtfs.sqlite?mode=ro")
	if err != nil {
		fmt.Printf("Failed to open database: %v\n", err)
		return
	}
	a.db = db
}

// shutdown is called when the app is closing
func (a *App) shutdown(ctx context.Context) {
	if a.db != nil {
		a.db.Close()
	}
}

// GetStops returns all stops within the given bounding box
func (a *App) GetStops(north, south, east, west float64) ([]Stop, error) {
	if a.db == nil {
		return nil, fmt.Errorf("database not connected")
	}

	query := `
		SELECT stop_id, stop_name, stop_lat, stop_lon
		FROM stops
		WHERE stop_lat BETWEEN ? AND ?
		  AND stop_lon BETWEEN ? AND ?
		  AND location_type = 1
	`

	rows, err := a.db.Query(query, south, north, west, east)
	if err != nil {
		return nil, fmt.Errorf("query failed: %w", err)
	}
	defer rows.Close()

	var stops []Stop
	for rows.Next() {
		var s Stop
		if err := rows.Scan(&s.StopID, &s.StopName, &s.StopLat, &s.StopLon); err != nil {
			return nil, fmt.Errorf("scan failed: %w", err)
		}
		stops = append(stops, s)
	}

	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("rows error: %w", err)
	}

	return stops, nil
}

// GetStationDetails returns details about a station including its routes
func (a *App) GetStationDetails(stopID string) (*StationDetails, error) {
	if a.db == nil {
		return nil, fmt.Errorf("database not connected")
	}

	// Get station info
	var details StationDetails
	err := a.db.QueryRow(`
		SELECT stop_id, stop_name, stop_lat, stop_lon
		FROM stops
		WHERE stop_id = ? AND location_type = 1
	`, stopID).Scan(&details.StopID, &details.StopName, &details.StopLat, &details.StopLon)
	if err != nil {
		return nil, fmt.Errorf("station not found: %w", err)
	}

	// Get routes that serve this station (via child stops)
	routeQuery := `
		SELECT DISTINCT r.route_id,
			COALESCE(r.route_short_name, ''),
			COALESCE(r.route_long_name, ''),
			COALESCE(r.route_desc, ''),
			r.route_type,
			COALESCE(r.route_color, ''),
			COALESCE(r.route_text_color, '')
		FROM routes r
		JOIN trips t ON t.route_id = r.route_id
		JOIN stop_times st ON st.trip_id = t.trip_id
		JOIN stops child ON child.stop_id = st.stop_id
		WHERE child.parent_station = ?
		ORDER BY r.route_short_name, r.route_long_name
	`

	rows, err := a.db.Query(routeQuery, stopID)
	if err != nil {
		return nil, fmt.Errorf("routes query failed: %w", err)
	}
	defer rows.Close()

	for rows.Next() {
		var r Route
		if err := rows.Scan(&r.RouteID, &r.RouteShortName, &r.RouteLongName, &r.RouteDesc, &r.RouteType, &r.RouteColor, &r.RouteTextColor); err != nil {
			return nil, fmt.Errorf("route scan failed: %w", err)
		}
		details.Routes = append(details.Routes, r)
	}

	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("routes rows error: %w", err)
	}

	return &details, nil
}

// Greet returns a greeting for the given name
func (a *App) Greet(name string) string {
	return fmt.Sprintf("Hello %s, It's show time!", name)
}
