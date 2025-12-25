package main

import (
	"context"
	"testing"
)

func TestGetStops(t *testing.T) {
	app := NewApp()
	app.startup(context.Background())
	defer app.shutdown(context.Background())

	if app.db == nil {
		t.Fatal("Database connection failed")
	}

	// Test with a bounding box around Berlin
	north := 52.6
	south := 52.4
	east := 13.5
	west := 13.3

	stops, err := app.GetStops(north, south, east, west)
	if err != nil {
		t.Fatalf("GetStops failed: %v", err)
	}

	t.Logf("Found %d stations in Berlin area", len(stops))

	if len(stops) == 0 {
		t.Error("Expected to find some stations in Berlin area, got 0")
	}

	// Verify stop data structure
	if len(stops) > 0 {
		stop := stops[0]
		t.Logf("First stop: ID=%s, Name=%s, Lat=%f, Lon=%f",
			stop.StopID, stop.StopName, stop.StopLat, stop.StopLon)

		if stop.StopID == "" {
			t.Error("Stop ID should not be empty")
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
	app := NewApp()
	app.startup(context.Background())
	defer app.shutdown(context.Background())

	if app.db == nil {
		t.Fatal("Database connection failed")
	}

	// Test with a bounding box in the ocean (no stops expected)
	north := 0.1
	south := 0.0
	east := 0.1
	west := 0.0

	stops, err := app.GetStops(north, south, east, west)
	if err != nil {
		t.Fatalf("GetStops failed: %v", err)
	}

	t.Logf("Found %d stops in ocean area", len(stops))
}

func TestGetStopsWithoutDatabase(t *testing.T) {
	app := NewApp()
	// Don't call startup - database should be nil

	_, err := app.GetStops(52.6, 52.4, 13.5, 13.3)
	if err == nil {
		t.Error("Expected error when database is not connected")
	}
}
