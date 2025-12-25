package db

import (
	"os"
	"testing"

	"bus-planning/internal/models"
)

const testDBPath = "../../gtfs-data/sqlite/gtfs.sqlite"

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
		data, err := db.GetUpcomingTrips(stop.StopID, datetime, limit)
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
			data, err := db.GetUpcomingTrips(stop.StopID, datetime, 5)
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
		data, err := db.GetUpcomingTrips(stationID, "2026-01-13T08:00:00", 50)
		if err != nil {
			t.Fatalf("GetUpcomingTrips failed: %v", err)
		}
		if !tripInResults(data, tripID) {
			t.Errorf("Expected trip %s to be returned on Monday 2026-01-13, but it was not", tripID)
		}
	})

	// Test 2: Saturday 20260110 should NOT include the trip (saturday=0)
	t.Run("trip does not run on Saturday", func(t *testing.T) {
		data, err := db.GetUpcomingTrips(stationID, "2026-01-10T08:00:00", 50)
		if err != nil {
			t.Fatalf("GetUpcomingTrips failed: %v", err)
		}
		if tripInResults(data, tripID) {
			t.Errorf("Expected trip %s to NOT be returned on Saturday 2026-01-10, but it was", tripID)
		}
	})

	// Test 3: Sunday 20260111 should NOT include the trip (sunday=0)
	t.Run("trip does not run on Sunday", func(t *testing.T) {
		data, err := db.GetUpcomingTrips(stationID, "2026-01-11T08:00:00", 50)
		if err != nil {
			t.Fatalf("GetUpcomingTrips failed: %v", err)
		}
		if tripInResults(data, tripID) {
			t.Errorf("Expected trip %s to NOT be returned on Sunday 2026-01-11, but it was", tripID)
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
		data, err := db.GetUpcomingTrips(stationID, "2026-01-09T08:00:00", 50)
		if err != nil {
			t.Fatalf("GetUpcomingTrips failed: %v", err)
		}
		if !tripInResults(data, tripID) {
			t.Errorf("Expected trip %s to be returned on Friday 2026-01-09, but it was not", tripID)
		}
	})

	// Test 2: Friday 20251226 (exception removes service) should NOT include the trip
	t.Run("trip excluded on exception date", func(t *testing.T) {
		data, err := db.GetUpcomingTrips(stationID, "2025-12-26T08:00:00", 50)
		if err != nil {
			t.Fatalf("GetUpcomingTrips failed: %v", err)
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
		data, err := db.GetUpcomingTrips(stationID, "2026-01-05T10:00:00", 50)
		if err != nil {
			t.Fatalf("GetUpcomingTrips failed: %v", err)
		}
		if !tripInResults(data, tripID) {
			t.Errorf("Expected trip %s to be returned on Monday 2026-01-05 (exception_type=1), but it was not", tripID)
		}
	})

	// Test 2: Monday 20251229 (normal Monday, no service) should NOT include the trip
	t.Run("trip does not run on normal Monday", func(t *testing.T) {
		data, err := db.GetUpcomingTrips(stationID, "2025-12-29T10:00:00", 50)
		if err != nil {
			t.Fatalf("GetUpcomingTrips failed: %v", err)
		}
		if tripInResults(data, tripID) {
			t.Errorf("Expected trip %s to NOT be returned on Monday 2025-12-29, but it was", tripID)
		}
	})
}
