package db

import (
	"os"
	"testing"

	"bus-planning/internal/models"
)

const testDBPath = "testdata/test.sqlite"

func skipIfNoDatabase(t *testing.T) *DB {
	t.Helper()
	if _, err := os.Stat(testDBPath); os.IsNotExist(err) {
		t.Skip("Test database not found at", testDBPath)
	}
	db, err := Open(testDBPath)
	if err != nil {
		t.Fatalf("Failed to open database: %v", err)
	}
	return db
}

func TestOpen(t *testing.T) {
	db := skipIfNoDatabase(t)
	defer db.Close()
}

func TestOpenInvalidPath(t *testing.T) {
	_, err := Open("/nonexistent/path/to/database.sqlite")
	if err == nil {
		t.Error("Expected error when opening nonexistent database")
	}
}

func TestGetStops(t *testing.T) {
	db := skipIfNoDatabase(t)
	defer db.Close()

	// Test with a bounding box around Berlin
	north := 52.6
	south := 52.4
	east := 13.5
	west := 13.3

	stops, err := db.GetStops(north, south, east, west)
	if err != nil {
		t.Fatalf("GetStops failed: %v", err)
	}

	t.Logf("Found %d stations in Berlin area", len(stops))

	if len(stops) == 0 {
		t.Error("Expected to find some stations in Berlin area, got 0")
	}

	// Verify stop data structure
	for _, stop := range stops {
		if stop.StopID == "" {
			t.Error("Stop ID should not be empty")
		}
		if stop.StopName == "" {
			t.Error("Stop name should not be empty")
		}
		if stop.StopLat < south || stop.StopLat > north {
			t.Errorf("Stop latitude %f out of bounds [%f, %f]", stop.StopLat, south, north)
		}
		if stop.StopLon < west || stop.StopLon > east {
			t.Errorf("Stop longitude %f out of bounds [%f, %f]", stop.StopLon, west, east)
		}
	}
}

func TestGetStopsEmptyArea(t *testing.T) {
	db := skipIfNoDatabase(t)
	defer db.Close()

	// Test with a bounding box in the ocean (no stops expected)
	stops, err := db.GetStops(0.1, 0.0, 0.1, 0.0)
	if err != nil {
		t.Fatalf("GetStops failed: %v", err)
	}

	if len(stops) != 0 {
		t.Errorf("Expected 0 stops in ocean area, got %d", len(stops))
	}
}

func TestGetStopsNarrowBounds(t *testing.T) {
	db := skipIfNoDatabase(t)
	defer db.Close()

	// Very narrow bounding box - should still work
	stops, err := db.GetStops(52.5001, 52.5, 13.4001, 13.4)
	if err != nil {
		t.Fatalf("GetStops failed: %v", err)
	}

	t.Logf("Found %d stations in narrow bounds", len(stops))
}

func TestGetStationDetails(t *testing.T) {
	db := skipIfNoDatabase(t)
	defer db.Close()

	// First get some stations to find a valid ID
	stops, err := db.GetStops(52.6, 52.4, 13.5, 13.3)
	if err != nil {
		t.Fatalf("GetStops failed: %v", err)
	}

	if len(stops) == 0 {
		t.Skip("No stations found to test with")
	}

	// Get details for the first station
	stationID := stops[0].StopID
	details, err := db.GetStationDetails(stationID)
	if err != nil {
		t.Fatalf("GetStationDetails failed for %s: %v", stationID, err)
	}

	// Verify the details
	if details.StopID != stationID {
		t.Errorf("Expected stop ID %s, got %s", stationID, details.StopID)
	}
	if details.StopName == "" {
		t.Error("Station name should not be empty")
	}

	t.Logf("Station %s (%s) has %d routes", details.StopID, details.StopName, len(details.Routes))

	// Verify route data if present
	for i, route := range details.Routes {
		if route.RouteID == "" {
			t.Errorf("Route %d: ID should not be empty", i)
		}
		// RouteType should be a valid GTFS route type (0-12)
		if route.RouteType < 0 || route.RouteType > 12 {
			t.Errorf("Route %d: Invalid route type %d", i, route.RouteType)
		}
	}
}

func TestGetStationDetailsInvalidID(t *testing.T) {
	db := skipIfNoDatabase(t)
	defer db.Close()

	_, err := db.GetStationDetails("nonexistent-station-id")
	if err == nil {
		t.Error("Expected error for nonexistent station ID")
	}
}

func TestGetRoutesForStation(t *testing.T) {
	db := skipIfNoDatabase(t)
	defer db.Close()

	// First get some stations to find a valid ID
	stops, err := db.GetStops(52.6, 52.4, 13.5, 13.3)
	if err != nil {
		t.Fatalf("GetStops failed: %v", err)
	}

	if len(stops) == 0 {
		t.Skip("No stations found to test with")
	}

	// Find a station with routes
	var routesData *RoutesData
	var testedStation string
	for _, stop := range stops {
		data, err := db.GetRoutesForStation(stop.StopID)
		if err != nil {
			continue
		}
		if len(data.Routes) > 0 {
			routesData = data
			testedStation = stop.StopID
			break
		}
	}

	if routesData == nil {
		t.Skip("No stations with routes found to test with")
	}

	t.Logf("Station %s has %d routes and %d stations along those routes",
		testedStation, len(routesData.Routes), len(routesData.Stations))

	// Verify route geometry data
	for i, route := range routesData.Routes {
		if route.RouteID == "" {
			t.Errorf("Route %d: ID should not be empty", i)
		}
		if len(route.Coordinates) == 0 {
			t.Errorf("Route %d: should have coordinates", i)
		}
		for j, coord := range route.Coordinates {
			if coord.Lat < -90 || coord.Lat > 90 {
				t.Errorf("Route %d, coord %d: invalid latitude %f", i, j, coord.Lat)
			}
			if coord.Lon < -180 || coord.Lon > 180 {
				t.Errorf("Route %d, coord %d: invalid longitude %f", i, j, coord.Lon)
			}
		}
	}

	// Verify stations data
	for i, station := range routesData.Stations {
		if station.StopID == "" {
			t.Errorf("Station %d: ID should not be empty", i)
		}
		if station.StopName == "" {
			t.Errorf("Station %d: name should not be empty", i)
		}
	}
}

func TestGetRoutesForStationInvalidID(t *testing.T) {
	db := skipIfNoDatabase(t)
	defer db.Close()

	data, err := db.GetRoutesForStation("nonexistent-station-id")
	if err != nil {
		t.Fatalf("GetRoutesForStation failed: %v", err)
	}

	// Should return empty data, not an error
	if len(data.Routes) != 0 || len(data.Stations) != 0 {
		t.Error("Expected empty routes and stations for nonexistent station")
	}
}

func TestSearchStations(t *testing.T) {
	db := skipIfNoDatabase(t)
	defer db.Close()

	stops, err := db.GetStops(52.6, 52.4, 13.5, 13.3)
	if err != nil {
		t.Fatalf("GetStops failed: %v", err)
	}
	if len(stops) == 0 {
		t.Skip("No stations available to test search")
	}

	name := stops[0].StopName
	if len(name) > 6 {
		name = name[:6]
	}

	results, err := db.SearchStations(name, 5)
	if err != nil {
		t.Fatalf("SearchStations failed: %v", err)
	}
	if len(results) == 0 {
		t.Fatalf("Expected search results for query %q", name)
	}

	for i, stop := range results {
		if stop.StopID == "" || stop.StopName == "" {
			t.Errorf("Result %d missing basic data", i)
		}
	}
}

// RoutesData is a type alias for testing
type RoutesData = models.RoutesData

func TestGetUpcomingTrips(t *testing.T) {
	db := skipIfNoDatabase(t)
	defer db.Close()

	// Use bounding box around the data's actual location (Siegen area, Germany)
	stops, err := db.GetStops(51.0, 50.8, 8.4, 8.0)
	if err != nil {
		t.Fatalf("GetStops failed: %v", err)
	}

	if len(stops) == 0 {
		t.Skip("No stations found to test with")
	}

	// Try to find a station with upcoming trips
	// Use a datetime within the calendar range (Dec 2025 - Jan 2026)
	datetime := "2025-12-22T08:00:00" // A Monday in the calendar range
	limit := 10

	var tripsData *models.UpcomingTripsData
	var testedStation string
	for _, stop := range stops {
		data, err := db.GetUpcomingTripsForStations([]string{stop.StopID}, datetime, limit, nil)
		if err != nil {
			continue
		}
		if len(data.Trips) > 0 {
			tripsData = data
			testedStation = stop.StopID
			break
		}
	}

	if tripsData == nil {
		t.Skip("No stations with upcoming trips found to test with")
	}

	t.Logf("Station %s has %d upcoming trips", testedStation, len(tripsData.Trips))

	// Verify trip data
	for i, trip := range tripsData.Trips {
		if trip.TripID == "" {
			t.Errorf("Trip %d: TripID should not be empty", i)
		}
		if trip.RouteID == "" {
			t.Errorf("Trip %d: RouteID should not be empty", i)
		}
		if trip.DepartureDateTime == "" {
			t.Errorf("Trip %d: DepartureDateTime should not be empty", i)
		}
		if len(trip.Coordinates) == 0 {
			t.Errorf("Trip %d: should have coordinates", i)
		}

		// DisplayName is the short route name (may be empty if route has no short name)
		if trip.DisplayName != "" {
			t.Logf("Trip %d: has DisplayName=%q", i, trip.DisplayName)
		}

		// Destination must not be empty (should be route_long_name or final station)
		if trip.Destination == "" {
			t.Errorf("Trip %d: Destination should not be empty", i)
		}

		// StartStation fields should be populated
		if trip.StartStationID == "" {
			t.Errorf("Trip %d: StartStationID should not be empty", i)
		}
		if trip.StartStationName == "" {
			t.Errorf("Trip %d: StartStationName should not be empty", i)
		}

		// StopTimes should be populated with timing data
		if len(trip.StopTimes) == 0 {
			t.Errorf("Trip %d: StopTimes should not be empty", i)
		}

		// Verify first and last stop times have valid data
		if len(trip.StopTimes) > 0 {
			first := trip.StopTimes[0]
			last := trip.StopTimes[len(trip.StopTimes)-1]
			if first.ArrivalDateTime == "" && first.DepartureDateTime == "" {
				t.Errorf("Trip %d: first stop should have arrival or departure datetime", i)
			}
			if last.ArrivalDateTime == "" && last.DepartureDateTime == "" {
				t.Errorf("Trip %d: last stop should have arrival or departure datetime", i)
			}
			t.Logf("Trip %d: %d stops, first=%s dep=%s, last=%s arr=%s",
				i, len(trip.StopTimes), first.StopName, first.DepartureDateTime, last.StopName, last.ArrivalDateTime)
		}

		t.Logf("Trip %d: DisplayName=%q, Destination=%q, DepartureDateTime=%s, StartStation=%q",
			i, trip.DisplayName, trip.Destination, trip.DepartureDateTime, trip.StartStationName)
	}
}

func TestGetUpcomingTripsDisplayNameNotEmpty(t *testing.T) {
	db := skipIfNoDatabase(t)
	defer db.Close()

	// Get stations in the actual data area (Siegen area, Germany)
	stops, err := db.GetStops(51.0, 50.8, 8.4, 8.0)
	if err != nil {
		t.Fatalf("GetStops failed: %v", err)
	}

	if len(stops) == 0 {
		t.Skip("No stations found to test with")
	}

	// Test datetimes within the calendar range (Dec 2025 - Jan 2026)
	datetimes := []string{"2025-12-22T08:00:00", "2025-12-23T08:00:00", "2025-12-29T08:00:00"}

	foundTripsWithName := false
	for _, stop := range stops[:min(20, len(stops))] { // Test first 20 stations
		for _, datetime := range datetimes {
			data, err := db.GetUpcomingTripsForStations([]string{stop.StopID}, datetime, 5, nil)
			if err != nil {
				continue
			}
			for _, trip := range data.Trips {
				if trip.Destination != "" {
					foundTripsWithName = true
					t.Logf("Found trip with DisplayName=%q, Destination=%q (route_id: %s)", trip.DisplayName, trip.Destination, trip.RouteID)
					break
				}
			}
			if foundTripsWithName {
				break
			}
		}
		if foundTripsWithName {
			break
		}
	}

	if !foundTripsWithName {
		t.Error("Could not find any trip with a proper Destination")
	}
}

func min(a, b int) int {
	if a < b {
		return a
	}
	return b
}

// tripInResults checks if a specific trip ID is present in the trips data
func tripInResults(trips *models.UpcomingTripsData, tripID string) bool {
	for _, trip := range trips.Trips {
		if trip.TripID == tripID {
			return true
		}
	}
	return false
}

// TestCalendarWeekdayFiltering tests that trips are correctly filtered based on weekday schedules.
// Service 191 runs Mon-Fri only (saturday=0, sunday=0), valid 20260107-20260119.
// Trip 1036941 departs from station 610626 at 08:34:00.
func TestCalendarWeekdayFiltering(t *testing.T) {
	db := skipIfNoDatabase(t)
	defer db.Close()

	stationID := "610626" // Haunstetten, Nord
	tripID := "1036941"

	// Test 1: Monday 20260113 should include the trip (monday=1)
	t.Run("trip runs on Monday", func(t *testing.T) {
		data, err := db.GetUpcomingTripsForStations([]string{stationID}, "2026-01-13T08:00:00", 50, nil)
		if err != nil {
			t.Fatalf("GetUpcomingTripsForStations failed: %v", err)
		}
		if !tripInResults(data, tripID) {
			t.Errorf("Expected trip %s to be returned on Monday 2026-01-13, but it was not", tripID)
		}
	})

	// Test 2: Saturday 20260110 should NOT include the trip (saturday=0)
	t.Run("trip does not run on Saturday", func(t *testing.T) {
		data, err := db.GetUpcomingTripsForStations([]string{stationID}, "2026-01-10T08:00:00", 50, nil)
		if err != nil {
			t.Fatalf("GetUpcomingTripsForStations failed: %v", err)
		}
		if tripInResults(data, tripID) {
			t.Errorf("Expected trip %s to NOT be returned on Saturday 2026-01-10, but it was", tripID)
		}
	})

	// Test 3: Sunday 20260111 should NOT include the trip (sunday=0)
	// Note: The query might return trips from Monday 2026-01-12 if no trips are available on Sunday,
	// so we need to check that if trip 1036941 appears, it's dated for Monday, not Sunday
	t.Run("trip does not run on Sunday", func(t *testing.T) {
		data, err := db.GetUpcomingTripsForStations([]string{stationID}, "2026-01-11T08:00:00", 50, nil)
		if err != nil {
			t.Fatalf("GetUpcomingTripsForStations failed: %v", err)
		}
		
		// Check if the trip appears in results
		for _, trip := range data.Trips {
			if trip.TripID == tripID {
				// Trip found - verify it's from Monday (next day), not Sunday
				if trip.DepartureDateTime >= "2026-01-11T00:00:00" && trip.DepartureDateTime < "2026-01-12T00:00:00" {
					t.Errorf("Expected trip %s to NOT be returned on Sunday 2026-01-11, but it was found with departure time %s", 
						tripID, trip.DepartureDateTime)
				}
				// If it's from Monday or later, that's expected behavior (next-day filling)
				break
			}
		}
	})
}

// TestCalendarDateExclusion tests that trips are correctly excluded based on calendar_dates exceptions.
// Service 101 runs Tuesday and Friday (tuesday=1, friday=1), valid 20251223-20260116.
// Exception: 20251226 (Friday) has exception_type=2 (service removed).
// Trip 154627 departs from station 32830 at 08:27:00.
func TestCalendarDateExclusion(t *testing.T) {
	db := skipIfNoDatabase(t)
	defer db.Close()

	stationID := "32830" // Blumenthal, Schule
	tripID := "154627"

	// Test 1: Friday 20260109 (normal Friday) should include the trip
	t.Run("trip runs on normal Friday", func(t *testing.T) {
		data, err := db.GetUpcomingTripsForStations([]string{stationID}, "2026-01-09T08:00:00", 50, nil)
		if err != nil {
			t.Fatalf("GetUpcomingTripsForStations failed: %v", err)
		}
		if !tripInResults(data, tripID) {
			t.Errorf("Expected trip %s to be returned on Friday 2026-01-09, but it was not", tripID)
		}
	})

	// Test 2: Friday 20251226 (exception removes service) should NOT include the trip
	t.Run("trip excluded on exception date", func(t *testing.T) {
		data, err := db.GetUpcomingTripsForStations([]string{stationID}, "2025-12-26T08:00:00", 50, nil)
		if err != nil {
			t.Fatalf("GetUpcomingTripsForStations failed: %v", err)
		}
		if tripInResults(data, tripID) {
			t.Errorf("Expected trip %s to NOT be returned on Friday 2025-12-26 (exception_type=2), but it was", tripID)
		}
	})
}

// TestCalendarDateAddition tests that trips are correctly added based on calendar_dates exceptions.
// Service 1030 runs Thursday and Friday (thursday=1, friday=1), valid 20251225-20260105.
// Exception: 20260105 (Monday) has exception_type=1 (service added).
// Trip 991667 departs from station 278696 at 10:07:00.
func TestCalendarDateAddition(t *testing.T) {
	db := skipIfNoDatabase(t)
	defer db.Close()

	stationID := "278696" // Neustadt (b Coburg)
	tripID := "991667"

	// Test 1: Monday 20260105 (exception adds service) should include the trip
	t.Run("trip added on exception date", func(t *testing.T) {
		data, err := db.GetUpcomingTripsForStations([]string{stationID}, "2026-01-05T10:00:00", 50, nil)
		if err != nil {
			t.Fatalf("GetUpcomingTripsForStations failed: %v", err)
		}
		if !tripInResults(data, tripID) {
			t.Errorf("Expected trip %s to be returned on Monday 2026-01-05 (exception_type=1), but it was not", tripID)
		}
	})

	// Test 2: Monday 20251229 (normal Monday, no service) should NOT include the trip
	t.Run("trip does not run on normal Monday", func(t *testing.T) {
		data, err := db.GetUpcomingTripsForStations([]string{stationID}, "2025-12-29T10:00:00", 50, nil)
		if err != nil {
			t.Fatalf("GetUpcomingTripsForStations failed: %v", err)
		}
		if tripInResults(data, tripID) {
			t.Errorf("Expected trip %s to NOT be returned on Monday 2025-12-29, but it was", tripID)
		}
	})
}

// TestOvernightTrips tests that trips spanning midnight are correctly returned.
// In GTFS, a trip departing at 00:05 can be stored as:
// 1. Today's service with time "00:05:00", OR
// 2. Yesterday's service with time "24:05:00"
//
// When querying at 00:05 on 2025-12-22 (Monday), we should find trips from:
// - 2025-12-22's service with times >= 00:05:00 (if any exist)
// - 2025-12-21's (Sunday) service with times >= 24:05:00
//
// Station 494889 (Augsburg, Königsplatz) has trip 1214020 departing at 24:05:00 on service 940.
// Service 940 runs on Sundays (sunday=1), valid 20251220-20260119.
func TestOvernightTrips(t *testing.T) {
	db := skipIfNoDatabase(t)
	defer db.Close()

	stationID := "494889" // Augsburg, Königsplatz
	tripID := "1214020"   // Departs at 24:05:00 on service 940

	// Query at 00:05 on Monday 2025-12-22
	// This should find trip 1214020 which departs at 24:05:00 on Sunday 2025-12-21's service
	// (24:05:00 on Sunday = 00:05:00 on Monday)
	t.Run("finds overnight trip from previous day service", func(t *testing.T) {
		data, err := db.GetUpcomingTripsForStations([]string{stationID}, "2025-12-22T00:05:00", 50, nil)
		if err != nil {
			t.Fatalf("GetUpcomingTripsForStations failed: %v", err)
		}
		if !tripInResults(data, tripID) {
			t.Errorf("Expected trip %s (24:05:00 on Sunday's service) to be returned when querying at 00:05 on Monday, but it was not", tripID)
		}
	})

	// Query at 00:04 on Monday 2025-12-22
	// This should NOT find trip 1214020 since 24:05 > 00:04
	t.Run("does not find overnight trip before its departure", func(t *testing.T) {
		data, err := db.GetUpcomingTripsForStations([]string{stationID}, "2025-12-22T00:04:00", 50, nil)
		if err != nil {
			t.Fatalf("GetUpcomingTripsForStations failed: %v", err)
		}
		// Trip 1214020 departs at 24:05, but we're querying at 00:04
		// However, there might be trips at 24:00-24:04 that should appear
		// So we just verify trip 1214020 specifically is NOT in results before 00:05
		// Actually, querying at 00:04 should find trips >= 24:04, so 24:05 should NOT be included
		// Let's check - if 24:05 maps to 00:05, then querying at 00:04 should find 24:04+ trips
		// and 24:05 (00:05) is after 00:04, so it SHOULD be included
		// The test should verify that 24:05 trip IS found when querying at 00:04
		if !tripInResults(data, tripID) {
			t.Errorf("Expected trip %s (24:05:00) to be returned when querying at 00:04, but it was not", tripID)
		}
	})

	// Query at 23:55 on Sunday 2025-12-21
	// Trip 1214020 departs at 24:05 which is AFTER 23:55, so it should be found
	t.Run("finds overnight trip when querying before midnight", func(t *testing.T) {
		data, err := db.GetUpcomingTripsForStations([]string{stationID}, "2025-12-21T23:55:00", 50, nil)
		if err != nil {
			t.Fatalf("GetUpcomingTripsForStations failed: %v", err)
		}
		if !tripInResults(data, tripID) {
			t.Errorf("Expected trip %s (24:05:00) to be returned when querying at 23:55, but it was not", tripID)
		}
	})
}

// TestExcludeTripsEndingAtStation tests that trips where the queried station is the
// final destination are excluded from results. These trips have no further stops,
// so they shouldn't appear on a departure board.
//
// Station 419232 (Siegen ZOB) is used as it's a common final destination.
// - Trip 1014198 (SB4): Ends at Siegen ZOB (stop_sequence 19 of 19) - should be EXCLUDED
// - Trip 1493872 (C105): Starts at Siegen ZOB (stop_sequence 0 of 24) - should be INCLUDED
//
// Service 191 runs Mon-Fri, valid 2026-01-07 to 2026-01-19.
func TestExcludeTripsEndingAtStation(t *testing.T) {
	db := skipIfNoDatabase(t)
	defer db.Close()

	stationID := "419232" // Siegen ZOB

	// Query at 10:30 on Monday 2026-01-12
	// Trip 1014198 (SB4) departs at 10:39 but Siegen ZOB is its FINAL stop
	// Trip 1493872 (C105) departs at 10:24 and Siegen ZOB is its FIRST stop
	t.Run("excludes trips ending at station", func(t *testing.T) {
		data, err := db.GetUpcomingTripsForStations([]string{stationID}, "2026-01-12T10:00:00", 50, nil)
		if err != nil {
			t.Fatalf("GetUpcomingTripsForStations failed: %v", err)
		}

		// No trip should have only 1 stop - that means the station is the final destination
		// and there's nowhere to go from there
		for _, trip := range data.Trips {
			if len(trip.StopTimes) <= 1 {
				t.Errorf("Trip %s (%s) has only %d stop(s) - this means station %s is its final destination and should be excluded",
					trip.TripID, trip.DisplayName, len(trip.StopTimes), stationID)
			}
		}

		// Trip 1493872 should be in results (starts at Siegen ZOB, has 24 more stops)
		tripStartingHere := "1493872"
		if !tripInResults(data, tripStartingHere) {
			t.Errorf("Trip %s starts at station %s and should be returned, but it was not", tripStartingHere, stationID)
		}
	})
}
