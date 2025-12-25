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
