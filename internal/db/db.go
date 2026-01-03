// Package db provides database operations for GTFS data.
package db

import (
	"database/sql"
	"fmt"
	"math"
	"strings"

	"bus-planning/internal/models"
	"bus-planning/internal/timeutil"

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

// GetNearbyStations returns all parent stations within radiusMeters of the given station.
// Uses a simple bounding box approximation for performance.
// Lat/lon differences approximation: 1 degree lat ≈ 111km, 1 degree lon ≈ 111km * cos(latitude)
func (db *DB) GetNearbyStations(stopID string, radiusMeters float64) ([]models.Stop, error) {
	// Get the reference station's coordinates
	var refLat, refLon float64
	err := db.conn.QueryRow(`
		SELECT stop_lat, stop_lon
		FROM stops
		WHERE stop_id = ? AND location_type = 1
	`, stopID).Scan(&refLat, &refLon)
	if err != nil {
		return nil, fmt.Errorf("station not found: %w", err)
	}

	// Calculate bounding box
	// At equator: 1 degree ≈ 111,320 meters
	// For small distances, this is accurate enough
	latDelta := radiusMeters / 111320.0
	lonDelta := radiusMeters / (111320.0 * math.Cos(refLat*math.Pi/180.0))

	minLat := refLat - latDelta
	maxLat := refLat + latDelta
	minLon := refLon - lonDelta
	maxLon := refLon + lonDelta

	// Query stations within bounding box, excluding the reference station
	query := `
		SELECT stop_id, stop_name, stop_lat, stop_lon
		FROM stops
		WHERE location_type = 1
		  AND stop_id != ?
		  AND stop_lat BETWEEN ? AND ?
		  AND stop_lon BETWEEN ? AND ?
		ORDER BY stop_name
	`

	rows, err := db.conn.Query(query, stopID, minLat, maxLat, minLon, maxLon)
	if err != nil {
		return nil, fmt.Errorf("nearby stations query failed: %w", err)
	}
	defer rows.Close()

	var stations []models.Stop
	for rows.Next() {
		var s models.Stop
		if err := rows.Scan(&s.StopID, &s.StopName, &s.StopLat, &s.StopLon); err != nil {
			return nil, fmt.Errorf("scan failed: %w", err)
		}
		stations = append(stations, s)
	}

	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("rows error: %w", err)
	}

	return stations, nil
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

		// Use parent station coordinates for the polyline so lines align with station markers
		coordinates = append(coordinates, models.Coordinate{Lat: stationLat, Lon: stationLon})

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

// GetUpcomingTripsForStations returns upcoming trips from multiple stations.
// This is the core implementation that fetches and merges trips from multiple station IDs.
func (db *DB) GetUpcomingTripsForStations(stationIDs []string, datetime string, limit int, routeTypes []int) (*models.UpcomingTripsData, error) {
	if limit <= 0 {
		limit = 10
	}
	if limit > 50 {
		limit = 50
	}

	if len(stationIDs) == 0 {
		return &models.UpcomingTripsData{Trips: []models.UpcomingTrip{}, Stations: []models.Stop{}}, nil
	}

	// Extract date and time from ISO 8601 datetime
	date, timeStr, err := timeutil.ExtractDateAndTime(datetime)
	if err != nil {
		return nil, fmt.Errorf("invalid datetime format: %w", err)
	}

	// Get previous day parameters for overnight trips
	prevDate, overnightTime, err := timeutil.GetPreviousDayOvernightParams(datetime)
	if err != nil {
		return nil, fmt.Errorf("failed to get overnight params: %w", err)
	}

	// Find the day of week for calendar filtering
	dayOfWeek, err := db.getDayOfWeek(date)
	if err != nil {
		return nil, fmt.Errorf("invalid date format: %w", err)
	}
	prevDayOfWeek, err := db.getDayOfWeek(prevDate)
	if err != nil {
		return nil, fmt.Errorf("invalid previous date format: %w", err)
	}

	// Get next day parameters for trips that start after midnight
	nextDate, err := timeutil.GetNextDay(date)
	if err != nil {
		return nil, fmt.Errorf("failed to get next day: %w", err)
	}
	nextDayOfWeek, err := db.getDayOfWeek(nextDate)
	if err != nil {
		return nil, fmt.Errorf("invalid next date format: %w", err)
	}

	// Query trips from all stations in a single query
	var allTripInfos []tripInfo
	seenTrips := make(map[string]bool)

	// Query current day trips for all stations
	tripInfos, err := db.queryTripsForMultipleStations(stationIDs, date, timeStr, dayOfWeek, limit, routeTypes)
	if err != nil {
		return nil, fmt.Errorf("failed to query current day trips: %w", err)
	}

	// Query overnight trips for all stations (24+ notation from previous day)
	overnightTripInfos, err := db.queryTripsForMultipleStations(stationIDs, prevDate, overnightTime, prevDayOfWeek, limit, routeTypes)
	if err != nil {
		// Continue with current day trips only
		overnightTripInfos = []tripInfo{}
	}

	// Query next day trips (normal 00:00+ notation) if we don't have enough trips yet
	// This handles cases where there are no more trips on the current day
	nextDayTripInfos := []tripInfo{}
	if len(tripInfos)+len(overnightTripInfos) < limit {
		nextDayTripInfos, err = db.queryTripsForMultipleStations(stationIDs, nextDate, "00:00:00", nextDayOfWeek, limit, routeTypes)
		if err != nil {
			// Continue without next day trips
			nextDayTripInfos = []tripInfo{}
		}
	}

	// Combine and deduplicate
	for _, info := range append(append(tripInfos, overnightTripInfos...), nextDayTripInfos...) {
		if !seenTrips[info.tripID] {
			seenTrips[info.tripID] = true
			allTripInfos = append(allTripInfos, info)
		}
	}

	result := &models.UpcomingTripsData{
		Trips:    make([]models.UpcomingTrip, 0),
		Stations: make([]models.Stop, 0),
	}

	stationSet := make(map[string]models.Stop)

	// For each trip, get geometry from sequence
	for _, info := range allTripInfos {
		trip, stations := db.getTripGeometryFromSequence(
			info.tripID, info.stopSequence, info.routeID, info.routeType,
			info.shortName, info.longName, info.color, info.departureTime,
			info.headsign, info.serviceDate,
		)
		if trip != nil {
			result.Trips = append(result.Trips, *trip)
		}
		for _, station := range stations {
			stationSet[station.StopID] = station
		}
	}

	// Sort trips by departure datetime
	sortTripsByDepartureDateTime(result.Trips)

	// Limit the final result
	if len(result.Trips) > limit {
		result.Trips = result.Trips[:limit]
	}

	// Convert station set to slice
	for _, station := range stationSet {
		result.Stations = append(result.Stations, station)
	}

	return result, nil
}

// tripInfo holds intermediate trip data from queries
type tripInfo struct {
	tripID        string
	routeID       string
	routeType     int
	shortName     string
	longName      string
	color         string
	departureTime string
	headsign      string
	stopSequence  int
	serviceDate   string // The service date (YYYYMMDD) this trip belongs to
}

// queryTripsForMultipleStations queries trips departing from multiple stations on a specific service date in a single SQL query
func (db *DB) queryTripsForMultipleStations(stopIDs []string, date, minTime, dayOfWeek string, limit int, routeTypes []int) ([]tripInfo, error) {
	if len(stopIDs) == 0 {
		return []tripInfo{}, nil
	}

	// Convert time string to timestamp for accurate comparison
	minTimestamp, err := timeToTimestamp(minTime)
	if err != nil {
		return nil, fmt.Errorf("invalid time format: %w", err)
	}

	// Build placeholders for IN clause
	placeholders := make([]string, len(stopIDs))
	args := []interface{}{date} // First arg is date for calendar_dates

	for i := range stopIDs {
		placeholders[i] = "?"
	}
	placeholdersStr := strings.Join(placeholders, ", ")

	// Add stopIDs twice (for parent_station and stop_id checks)
	for _, stopID := range stopIDs {
		args = append(args, stopID)
	}
	for _, stopID := range stopIDs {
		args = append(args, stopID)
	}

	// Add remaining parameters (use timestamp instead of time string)
	args = append(args, minTimestamp, date, date, limit)

	// Build route type filter if specified
	routeTypeFilter := ""
	if len(routeTypes) > 0 {
		routeTypeFilter = " WHERE r.route_type IN ("
		for i, rt := range routeTypes {
			if i > 0 {
				routeTypeFilter += ", "
			}
			routeTypeFilter += fmt.Sprintf("%d", rt)
		}
		routeTypeFilter += ")"
	}

	query := `
		WITH station_departures AS (
			SELECT
				t.trip_id,
				t.route_id,
				st.departure_time,
				st.departure_timestamp,
				st.stop_sequence,
				COALESCE(t.trip_headsign, '') as trip_headsign
			FROM stop_times st
			JOIN stops s ON s.stop_id = st.stop_id
			JOIN trips t ON t.trip_id = st.trip_id
			LEFT JOIN calendar c ON c.service_id = t.service_id
			LEFT JOIN calendar_dates cd ON cd.service_id = t.service_id AND cd.date = ?
			WHERE (s.parent_station IN (` + placeholdersStr + `) OR s.stop_id IN (` + placeholdersStr + `))
			  AND st.departure_timestamp >= ?
			  AND (
			      -- Include if calendar_dates says this service runs on this date (exception_type=1)
			      cd.exception_type = 1
			      OR (
			          -- Or if calendar says it runs on this day and no exception removes it
			          cd.exception_type IS NULL
			          AND c.start_date <= ?
			          AND c.end_date >= ?
			          AND ` + dayOfWeek + ` = 1
			      )
			  )
			  -- Explicitly exclude if exception_type = 2 (service removed)
			  AND (cd.exception_type IS NULL OR cd.exception_type != 2)
			ORDER BY st.departure_timestamp
			LIMIT ?
		)
		SELECT
			sd.trip_id,
			sd.route_id,
			r.route_type,
			COALESCE(r.route_short_name, '') as route_short_name,
			COALESCE(r.route_long_name, '') as route_long_name,
			COALESCE(r.route_color, '') as route_color,
			sd.departure_time,
			sd.trip_headsign,
			sd.stop_sequence
		FROM station_departures sd
		JOIN routes r ON r.route_id = sd.route_id` + routeTypeFilter + `
		ORDER BY sd.departure_timestamp
	`

	rows, err := db.conn.Query(query, args...)
	if err != nil {
		return nil, fmt.Errorf("trips query failed: %w", err)
	}
	defer rows.Close()

	var tripInfos []tripInfo
	for rows.Next() {
		var info tripInfo
		info.serviceDate = date
		if err := rows.Scan(
			&info.tripID, &info.routeID, &info.routeType, &info.shortName, &info.longName,
			&info.color, &info.departureTime, &info.headsign, &info.stopSequence,
		); err != nil {
			return nil, fmt.Errorf("trip scan failed: %w", err)
		}
		tripInfos = append(tripInfos, info)
	}

	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("trips rows error: %w", err)
	}

	return tripInfos, nil
}

// timeToTimestamp converts a time string (HH:MM:SS) to a timestamp (seconds since midnight)
// This matches the logic used in the departure_timestamp computed column
func timeToTimestamp(timeStr string) (int, error) {
	// Parse HH:MM:SS format
	var hours, minutes, seconds int
	_, err := fmt.Sscanf(timeStr, "%d:%d:%d", &hours, &minutes, &seconds)
	if err != nil {
		return 0, fmt.Errorf("invalid time format: %w", err)
	}

	// Calculate seconds since midnight (handles 24+ hour notation for overnight trips)
	return hours*3600 + minutes*60 + seconds, nil
}

// sortTripsByDepartureDateTime sorts trips by their departure datetime (already in ISO 8601 format)
func sortTripsByDepartureDateTime(trips []models.UpcomingTrip) {
	// Simple bubble sort since we typically have few trips
	for i := 0; i < len(trips); i++ {
		for j := i + 1; j < len(trips); j++ {
			if trips[j].DepartureDateTime < trips[i].DepartureDateTime {
				trips[i], trips[j] = trips[j], trips[i]
			}
		}
	}
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
// The serviceDate parameter (YYYYMMDD format) is used to normalize GTFS times to ISO 8601 datetimes.
func (db *DB) getTripGeometryFromSequence(tripID string, fromSequence int, routeID string, routeType int, shortName, longName, color, departureTime, headsign, serviceDate string) (*models.UpcomingTrip, []models.Stop) {
	// Get stops for this trip starting from the given sequence, including arrival/departure times
	stopsQuery := `
		SELECT s.stop_lat, s.stop_lon,
			st.arrival_time,
			st.departure_time,
			st.stop_sequence,
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
	var stopTimes []models.StopTime
	var lastStationName string
	var startStationID, startStationName string
	isFirst := true

	for stopRows.Next() {
		var stopLat, stopLon float64
		var arrivalTime, depTime string
		var stopSequence int
		var stationIDVal, stationName string
		var stationLat, stationLon float64

		if err := stopRows.Scan(&stopLat, &stopLon, &arrivalTime, &depTime, &stopSequence, &stationIDVal, &stationName, &stationLat, &stationLon); err != nil {
			continue
		}

		// Use parent station coordinates for the polyline so lines align with station markers
		coordinates = append(coordinates, models.Coordinate{Lat: stationLat, Lon: stationLon})

		// Track the first station as the start station
		if isFirst && stationIDVal != "" {
			startStationID = stationIDVal
			startStationName = stationName
			isFirst = false
		}

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

			// Normalize GTFS times to ISO 8601 datetimes
			arrivalDateTime, _ := timeutil.NormalizeGTFSTime(arrivalTime, serviceDate)
			departureDateTime, _ := timeutil.NormalizeGTFSTime(depTime, serviceDate)

			stopTimes = append(stopTimes, models.StopTime{
				StopID:            stationIDVal,
				StopName:          stationName,
				StopLat:           stationLat,
				StopLon:           stationLon,
				ArrivalDateTime:   arrivalDateTime,
				DepartureDateTime: departureDateTime,
				StopSequence:      stopSequence,
			})
		}
	}

	if len(coordinates) == 0 {
		return nil, nil
	}

	// If only 1 stop remains, this station is the final destination - exclude it
	// A departure board should only show trips that have somewhere to go
	if len(stopTimes) <= 1 {
		return nil, nil
	}

	// DisplayName: the short route name (e.g., "R27")
	displayName := strings.TrimSpace(shortName)

	// Destination: prefer route_long_name, fallback to final station name
	destination := strings.TrimSpace(longName)
	if destination == "" {
		destination = strings.TrimSpace(lastStationName)
	}

	// Normalize departure time to ISO 8601
	departureDateTime, _ := timeutil.NormalizeGTFSTime(departureTime, serviceDate)

	return &models.UpcomingTrip{
		TripID:            tripID,
		RouteID:           routeID,
		RouteType:         routeType,
		RouteColor:        color,
		DepartureDateTime: departureDateTime,
		Headsign:          headsign,
		DisplayName:       displayName,
		Destination:       destination,
		StartStationID:    startStationID,
		StartStationName:  startStationName,
		Coordinates:       coordinates,
		StopTimes:         stopTimes,
	}, stations
}

// GetTripDetails returns the full details of a trip including all stops.
// The serviceDate parameter (YYYYMMDD format) is used to normalize GTFS times to ISO 8601 datetimes.
func (db *DB) GetTripDetails(tripID string, serviceDate string) (*models.TripDetails, error) {
	// Get route info for this trip
	var routeID, routeShortName, routeLongName, routeColor, headsign string
	var routeType int
	err := db.conn.QueryRow(`
		SELECT t.route_id,
			r.route_type,
			COALESCE(r.route_short_name, '') as route_short_name,
			COALESCE(r.route_long_name, '') as route_long_name,
			COALESCE(r.route_color, '') as route_color,
			COALESCE(t.trip_headsign, '') as trip_headsign
		FROM trips t
		JOIN routes r ON r.route_id = t.route_id
		WHERE t.trip_id = ?
	`, tripID).Scan(&routeID, &routeType, &routeShortName, &routeLongName, &routeColor, &headsign)
	if err != nil {
		return nil, fmt.Errorf("trip not found: %w", err)
	}

	// Get all stops for this trip in sequence order
	stopsQuery := `
		SELECT
			st.arrival_time,
			st.departure_time,
			st.stop_sequence,
			COALESCE(parent.stop_id, s.stop_id) as station_id,
			COALESCE(parent.stop_name, s.stop_name) as station_name,
			COALESCE(parent.stop_lat, s.stop_lat) as station_lat,
			COALESCE(parent.stop_lon, s.stop_lon) as station_lon,
			COALESCE(s.platform_code, '') as platform_code
		FROM stop_times st
		JOIN stops s ON s.stop_id = st.stop_id
		LEFT JOIN stops parent ON parent.stop_id = s.parent_station AND parent.location_type = 1
		WHERE st.trip_id = ?
		ORDER BY st.stop_sequence
	`

	rows, err := db.conn.Query(stopsQuery, tripID)
	if err != nil {
		return nil, fmt.Errorf("stops query failed: %w", err)
	}
	defer rows.Close()

	var stopTimes []models.StopTime
	var lastStationName string

	for rows.Next() {
		var arrivalTime, depTime string
		var stopSequence int
		var stationIDVal, stationName string
		var stationLat, stationLon float64
		var platformCode string

		if err := rows.Scan(&arrivalTime, &depTime, &stopSequence, &stationIDVal, &stationName, &stationLat, &stationLon, &platformCode); err != nil {
			continue
		}

		if stationName != "" {
			lastStationName = stationName
		}

		if stationIDVal != "" {
			// Normalize GTFS times to ISO 8601 datetimes
			arrivalDateTime, _ := timeutil.NormalizeGTFSTime(arrivalTime, serviceDate)
			departureDateTime, _ := timeutil.NormalizeGTFSTime(depTime, serviceDate)

			stopTimes = append(stopTimes, models.StopTime{
				StopID:            stationIDVal,
				StopName:          stationName,
				StopLat:           stationLat,
				StopLon:           stationLon,
				ArrivalDateTime:   arrivalDateTime,
				DepartureDateTime: departureDateTime,
				StopSequence:      stopSequence,
				PlatformCode:      platformCode,
			})
		}
	}

	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("rows error: %w", err)
	}

	// DisplayName: the short route name
	displayName := strings.TrimSpace(routeShortName)

	// Destination: prefer route_long_name, fallback to final station name
	destination := strings.TrimSpace(routeLongName)
	if destination == "" {
		destination = strings.TrimSpace(lastStationName)
	}

	return &models.TripDetails{
		TripID:      tripID,
		RouteID:     routeID,
		RouteType:   routeType,
		RouteColor:  routeColor,
		DisplayName: displayName,
		Destination: destination,
		Headsign:    headsign,
		StopTimes:   stopTimes,
	}, nil
}

// GetRouteByID returns route details for a given route_id.
func (db *DB) GetRouteByID(routeID string) (*models.Route, error) {
	var route models.Route
	err := db.conn.QueryRow(`
		SELECT route_id,
			COALESCE(route_short_name, '') as route_short_name,
			COALESCE(route_long_name, '') as route_long_name,
			COALESCE(route_desc, '') as route_desc,
			route_type,
			COALESCE(route_color, '') as route_color,
			COALESCE(route_text_color, '') as route_text_color
		FROM routes
		WHERE route_id = ?
	`, routeID).Scan(
		&route.RouteID,
		&route.RouteShortName,
		&route.RouteLongName,
		&route.RouteDesc,
		&route.RouteType,
		&route.RouteColor,
		&route.RouteTextColor,
	)
	if err != nil {
		return nil, fmt.Errorf("route not found: %w", err)
	}
	return &route, nil
}
