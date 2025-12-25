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

// GetUpcomingTrips returns the next N trips departing from a station at or after the given time.
// The date parameter is in YYYYMMDD format, and time is in HH:MM:SS format.
// Only stops after the selected station are included in the trip geometry.
func (db *DB) GetUpcomingTrips(stopID string, date string, timeStr string, limit int) (*models.UpcomingTripsData, error) {
	if limit <= 0 {
		limit = 10
	}
	if limit > 50 {
		limit = 50
	}

	// Find the day of week for calendar filtering
	// date is YYYYMMDD format, we need to determine the day of week
	dayOfWeek, err := db.getDayOfWeek(date)
	if err != nil {
		return nil, fmt.Errorf("invalid date format: %w", err)
	}

	// Query to find upcoming trips from this station
	// We need to handle times that might be >= 24:00:00 for trips that span midnight
	query := `
		WITH station_departures AS (
			SELECT
				t.trip_id,
				t.route_id,
				st.departure_time,
				st.stop_sequence,
				COALESCE(t.trip_headsign, '') as trip_headsign
			FROM stop_times st
			JOIN stops s ON s.stop_id = st.stop_id
			JOIN trips t ON t.trip_id = st.trip_id
			LEFT JOIN calendar c ON c.service_id = t.service_id
			LEFT JOIN calendar_dates cd ON cd.service_id = t.service_id AND cd.date = ?
			WHERE (s.parent_station = ? OR s.stop_id = ?)
			  AND st.departure_time >= ?
			  AND (
			      -- Include if calendar_dates says this service runs on this date
			      cd.exception_type = 1
			      OR (
			          -- Or if calendar says it runs on this day and no exception removes it
			          cd.exception_type IS NULL
			          AND c.start_date <= ?
			          AND c.end_date >= ?
			          AND ` + dayOfWeek + ` = 1
			      )
			  )
			ORDER BY st.departure_time
			LIMIT ?
		)
		SELECT
			sd.trip_id,
			sd.route_id,
			COALESCE(r.route_short_name, '') as route_short_name,
			COALESCE(r.route_long_name, '') as route_long_name,
			COALESCE(r.route_color, '') as route_color,
			sd.departure_time,
			sd.trip_headsign,
			sd.stop_sequence
		FROM station_departures sd
		JOIN routes r ON r.route_id = sd.route_id
		ORDER BY sd.departure_time
	`

	rows, err := db.conn.Query(query, date, stopID, stopID, timeStr, date, date, limit)
	if err != nil {
		return nil, fmt.Errorf("upcoming trips query failed: %w", err)
	}
	defer rows.Close()

	type tripInfo struct {
		tripID        string
		routeID       string
		shortName     string
		longName      string
		color         string
		departureTime string
		headsign      string
		stopSequence  int
	}

	var tripInfos []tripInfo
	for rows.Next() {
		var info tripInfo
		if err := rows.Scan(
			&info.tripID, &info.routeID, &info.shortName, &info.longName,
			&info.color, &info.departureTime, &info.headsign, &info.stopSequence,
		); err != nil {
			return nil, fmt.Errorf("trip scan failed: %w", err)
		}
		tripInfos = append(tripInfos, info)
	}

	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("trips rows error: %w", err)
	}

	result := &models.UpcomingTripsData{
		Trips:    make([]models.UpcomingTrip, 0),
		Stations: make([]models.Stop, 0),
	}

	stationSet := make(map[string]models.Stop)

	// For each trip, get only the stops after the selected station
	for _, info := range tripInfos {
		trip, stations := db.getTripGeometryFromSequence(info.tripID, info.stopSequence, info.routeID, info.shortName, info.longName, info.color, info.departureTime, info.headsign)
		if trip != nil {
			result.Trips = append(result.Trips, *trip)
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

// getDayOfWeek returns the calendar column name for the day of week corresponding to the given date.
func (db *DB) getDayOfWeek(date string) (string, error) {
	if len(date) != 8 {
		return "", fmt.Errorf("date must be in YYYYMMDD format")
	}

	// Parse YYYYMMDD
	year := date[0:4]
	month := date[4:6]
	day := date[6:8]

	// Use SQLite to get the day of week
	var dayNum int
	err := db.conn.QueryRow(`SELECT strftime('%w', ? || '-' || ? || '-' || ?)`, year, month, day).Scan(&dayNum)
	if err != nil {
		return "", err
	}

	// SQLite %w returns 0=Sunday, 1=Monday, ..., 6=Saturday
	days := []string{"sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"}
	return days[dayNum], nil
}

// getTripGeometryFromSequence fetches the geometry for a trip starting from the given stop sequence.
func (db *DB) getTripGeometryFromSequence(tripID string, fromSequence int, routeID, shortName, longName, color, departureTime, headsign string) (*models.UpcomingTrip, []models.Stop) {
	// Get stops for this trip starting from the given sequence
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
		  AND st.stop_sequence >= ?
		ORDER BY st.stop_sequence
	`

	stopRows, err := db.conn.Query(stopsQuery, tripID, fromSequence)
	if err != nil {
		return nil, nil
	}
	defer stopRows.Close()

	var coordinates []models.Coordinate
	var stations []models.Stop
	var lastStationName string

	for stopRows.Next() {
		var stopLat, stopLon float64
		var stationIDVal, stationName string
		var stationLat, stationLon float64

		if err := stopRows.Scan(&stopLat, &stopLon, &stationIDVal, &stationName, &stationLat, &stationLon); err != nil {
			continue
		}

		coordinates = append(coordinates, models.Coordinate{Lat: stopLat, Lon: stopLon})

		// Always track the last station name we see
		if stationName != "" {
			lastStationName = stationName
		}

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

	// DisplayName: the short route name (e.g., "R27")
	displayName := strings.TrimSpace(shortName)

	// Destination: prefer route_long_name, fallback to final station name
	destination := strings.TrimSpace(longName)
	if destination == "" {
		destination = strings.TrimSpace(lastStationName)
	}

	return &models.UpcomingTrip{
		TripID:        tripID,
		RouteID:       routeID,
		RouteColor:    color,
		DepartureTime: departureTime,
		Headsign:      headsign,
		DisplayName:   displayName,
		Destination:   destination,
		Coordinates:   coordinates,
	}, stations
}
