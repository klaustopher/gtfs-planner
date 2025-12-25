// Package db provides database operations for GTFS data.
package db

import (
	"database/sql"
	"fmt"
	"strings"

	"bus-planning/internal/models"

	_ "github.com/mattn/go-sqlite3"
)

// DB wraps a sql.DB connection with GTFS-specific operations.
type DB struct {
	conn *sql.DB
}

// Open opens a connection to the SQLite database at the given path.
func Open(path string) (*DB, error) {
	conn, err := sql.Open("sqlite3", path+"?mode=ro")
	if err != nil {
		return nil, fmt.Errorf("failed to open database: %w", err)
	}

	// Verify connection works
	if err := conn.Ping(); err != nil {
		conn.Close()
		return nil, fmt.Errorf("failed to ping database: %w", err)
	}

	return &DB{conn: conn}, nil
}

// Close closes the database connection.
func (db *DB) Close() error {
	if db.conn != nil {
		return db.conn.Close()
	}
	return nil
}

// GetStops returns all stations within the given bounding box.
func (db *DB) GetStops(north, south, east, west float64) ([]models.Stop, error) {
	query := `
		SELECT stop_id, stop_name, stop_lat, stop_lon
		FROM stops
		WHERE stop_lat BETWEEN ? AND ?
		  AND stop_lon BETWEEN ? AND ?
		  AND location_type = 1
	`

	rows, err := db.conn.Query(query, south, north, west, east)
	if err != nil {
		return nil, fmt.Errorf("query failed: %w", err)
	}
	defer rows.Close()

	var stops []models.Stop
	for rows.Next() {
		var s models.Stop
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

// GetStationDetails returns details about a station including its routes.
func (db *DB) GetStationDetails(stopID string) (*models.StationDetails, error) {
	// Get station info
	var details models.StationDetails
	err := db.conn.QueryRow(`
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

	rows, err := db.conn.Query(routeQuery, stopID)
	if err != nil {
		return nil, fmt.Errorf("routes query failed: %w", err)
	}
	defer rows.Close()

	for rows.Next() {
		var r models.Route
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

// GetRoutesForStation returns route geometries and all stations for routes serving a station.
func (db *DB) GetRoutesForStation(stopID string) (*models.RoutesData, error) {
	// Get all route IDs that serve this station
	routeIDsQuery := `
		SELECT DISTINCT r.route_id,
			COALESCE(r.route_short_name, ''),
			COALESCE(r.route_long_name, ''),
			COALESCE(r.route_color, '')
		FROM routes r
		JOIN trips t ON t.route_id = r.route_id
		JOIN stop_times st ON st.trip_id = t.trip_id
		JOIN stops child ON child.stop_id = st.stop_id
		WHERE child.parent_station = ?
	`

	routeRows, err := db.conn.Query(routeIDsQuery, stopID)
	if err != nil {
		return nil, fmt.Errorf("routes query failed: %w", err)
	}
	defer routeRows.Close()

	var routeInfos []struct {
		id, shortName, longName, color string
	}
	for routeRows.Next() {
		var info struct {
			id, shortName, longName, color string
		}
		if err := routeRows.Scan(&info.id, &info.shortName, &info.longName, &info.color); err != nil {
			return nil, fmt.Errorf("route scan failed: %w", err)
		}
		routeInfos = append(routeInfos, info)
	}

	if err := routeRows.Err(); err != nil {
		return nil, fmt.Errorf("routes rows error: %w", err)
	}

	result := &models.RoutesData{
		Routes:   make([]models.RouteGeometry, 0),
		Stations: make([]models.Stop, 0),
	}

	stationSet := make(map[string]models.Stop)

	// For each route, get a representative trip and its stop sequence
	for _, routeInfo := range routeInfos {
		routeGeom, stations := db.getRouteGeometry(routeInfo.id, stopID, routeInfo.shortName, routeInfo.longName, routeInfo.color)
		if routeGeom != nil {
			result.Routes = append(result.Routes, *routeGeom)
		}
		for _, station := range stations {
			stationSet[station.StopID] = station
		}
	}

	// Convert station set to slice
	for _, station := range stationSet {
		result.Stations = append(result.Stations, station)
	}

	return result, nil
}

// SearchStations returns stations whose names loosely match the provided query text.
func (db *DB) SearchStations(query string, limit int) ([]models.Stop, error) {
	trimmed := strings.TrimSpace(query)
	if trimmed == "" {
		return []models.Stop{}, nil
	}

	if limit <= 0 {
		limit = 10
	}
	if limit > 50 {
		limit = 50
	}

	searchTerm := "%" + trimmed + "%"
	rows, err := db.conn.Query(`
		SELECT stop_id, stop_name, stop_lat, stop_lon
		FROM stops
		WHERE location_type = 1
		  AND UPPER(stop_name) LIKE UPPER(?)
		ORDER BY stop_name
		LIMIT ?
	`, searchTerm, limit)
	if err != nil {
		return nil, fmt.Errorf("station search failed: %w", err)
	}
	defer rows.Close()

	var results []models.Stop
	for rows.Next() {
		var stop models.Stop
		if err := rows.Scan(&stop.StopID, &stop.StopName, &stop.StopLat, &stop.StopLon); err != nil {
			return nil, fmt.Errorf("search scan failed: %w", err)
		}
		results = append(results, stop)
	}

	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("search rows error: %w", err)
	}

	return results, nil
}

// getRouteGeometry fetches the geometry for a single route, preferring a trip that serves the
// selected station to ensure the drawn polyline actually passes through it.
func (db *DB) getRouteGeometry(routeID, stationID, shortName, longName, color string) (*models.RouteGeometry, []models.Stop) {
	tripID, err := db.findTripServingStation(routeID, stationID)
	if err != nil {
		tripID, err = db.findLongestTrip(routeID)
		if err != nil {
			return nil, nil // Skip routes without usable trips
		}
	}

	// Get stops for this trip in sequence order
	stopsQuery := `
		SELECT s.stop_lat, s.stop_lon,
			COALESCE(parent.stop_id, s.stop_id) as station_id,
			COALESCE(parent.stop_name, s.stop_name) as station_name,
			COALESCE(parent.stop_lat, s.stop_lat) as station_lat,
			COALESCE(parent.stop_lon, s.stop_lon) as station_lon
		FROM stop_times st
		JOIN stops s ON s.stop_id = st.stop_id
		LEFT JOIN stops parent ON parent.stop_id = s.parent_station AND parent.location_type = 1
		WHERE st.trip_id = ?
		ORDER BY st.stop_sequence
	`

	stopRows, err := db.conn.Query(stopsQuery, tripID)
	if err != nil {
		return nil, nil
	}
	defer stopRows.Close()

	var coordinates []models.Coordinate
	var stations []models.Stop

	for stopRows.Next() {
		var stopLat, stopLon float64
		var stationIDVal, stationName string
		var stationLat, stationLon float64

		if err := stopRows.Scan(&stopLat, &stopLon, &stationIDVal, &stationName, &stationLat, &stationLon); err != nil {
			continue
		}

		coordinates = append(coordinates, models.Coordinate{Lat: stopLat, Lon: stopLon})

		if stationIDVal != "" {
			stations = append(stations, models.Stop{
				StopID:   stationIDVal,
				StopName: stationName,
				StopLat:  stationLat,
				StopLon:  stationLon,
			})
		}
	}

	if len(coordinates) == 0 {
		return nil, nil
	}

	return &models.RouteGeometry{
		RouteID:        routeID,
		RouteShortName: shortName,
		RouteLongName:  longName,
		RouteColor:     color,
		Coordinates:    coordinates,
	}, stations
}

// findTripServingStation returns a trip on the given route that actually stops at the provided
// station (or one of its child stops), preferring the variant with the most stops to approximate the
// full route.
func (db *DB) findTripServingStation(routeID, stationID string) (string, error) {
	query := `
		WITH route_trip_stops AS (
			SELECT t.trip_id,
				COUNT(*) AS stop_count,
				SUM(CASE
					WHEN COALESCE(s.parent_station, s.stop_id) = ? THEN 1
					ELSE 0
				END) AS matches_station
			FROM trips t
			JOIN stop_times st ON st.trip_id = t.trip_id
			JOIN stops s ON s.stop_id = st.stop_id
			WHERE t.route_id = ?
			GROUP BY t.trip_id
		)
		SELECT trip_id
		FROM route_trip_stops
		WHERE matches_station > 0
		ORDER BY stop_count DESC
		LIMIT 1
	`

	var tripID string
	err := db.conn.QueryRow(query, stationID, routeID).Scan(&tripID)
	if err != nil {
		return "", err
	}
	return tripID, nil
}

// findLongestTrip returns the trip on the route with the highest number of recorded stops. Used as a
// fallback when no station-specific trip can be located (should be rare if the database is
// consistent).
func (db *DB) findLongestTrip(routeID string) (string, error) {
	query := `
		SELECT t.trip_id
		FROM trips t
		JOIN stop_times st ON st.trip_id = t.trip_id
		WHERE t.route_id = ?
		GROUP BY t.trip_id
		ORDER BY COUNT(*) DESC
		LIMIT 1
	`

	var tripID string
	err := db.conn.QueryRow(query, routeID).Scan(&tripID)
	if err != nil {
		return "", err
	}
	return tripID, nil
}
