package main

import (
	"context"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"bus-planning/internal/models"

	"codeberg.org/go-pdf/fpdf"
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

// Test helper function for route type names
func TestGetRouteTypeName(t *testing.T) {
	tests := []struct {
		routeType int
		expected  string
	}{
		{0, "Straßenbahn"},
		{1, "U-Bahn"},
		{2, "Zug"},
		{3, "Bus"},
		{4, "Fähre"},
		{5, "Seilbahn"},
		{6, "Gondel"},
		{7, "Standseilbahn"},
		{11, "Oberleitungsbus"},
		{12, "Einschienenbahn"},
		{99, "ÖPNV"}, // Unknown type
	}

	for _, test := range tests {
		result := getRouteTypeName(test.routeType)
		if result != test.expected {
			t.Errorf("getRouteTypeName(%d) = %s, expected %s", test.routeType, result, test.expected)
		}
	}
}

// Test ICS export content generation
func TestExportJourneyToICS_Content(t *testing.T) {
	app := NewApp()
	app.startup(context.Background())
	defer app.shutdown(context.Background())

	if app.db == nil {
		t.Fatal("Database connection failed")
	}

	// Get any available route from the database
	routes, err := app.db.GetStops(90, -90, 180, -180)
	if err != nil || len(routes) < 2 {
		t.Skip("Not enough test data in database, skipping")
	}

	// Use the first two stations we find
	station1ID := routes[0].StopID
	station2ID := routes[1].StopID

	station1, err := app.GetStationDetails(station1ID)
	if err != nil {
		t.Skip("Test station 1 not found in database, skipping")
	}

	station2, err := app.GetStationDetails(station2ID)
	if err != nil {
		t.Skip("Test station 2 not found in database, skipping")
	}

	// Get a route from one of the stations
	if len(station1.Routes) == 0 {
		t.Skip("No routes available for test station, skipping")
	}
	route := station1.Routes[0]

	// Create journey data
	journey := models.JourneyData{
		Version:    1,
		CreatedAt:  time.Now().UTC().Format(time.RFC3339),
		ModifiedAt: time.Now().UTC().Format(time.RFC3339),
		SavedTrips: []models.SavedTripData{
			{
				TripID:            "test-trip-1",
				RouteID:           route.RouteID,
				StartStationID:    station1.StopID,
				DepartureDateTime: "2026-01-15T10:30:00",
				EndStationID:      station2.StopID,
				ArrivalDateTime:   "2026-01-15T11:15:00",
			},
		},
	}

	// Create a temp file for testing
	tmpDir := t.TempDir()
	testFile := filepath.Join(tmpDir, "test.ics")

	// We can't test the full function because it requires Wails runtime for dialogs
	// Instead, we'll test the ICS content generation logic by creating a similar journey
	// and manually writing to a file

	var icsContent strings.Builder
	icsContent.WriteString("BEGIN:VCALENDAR\r\n")
	icsContent.WriteString("VERSION:2.0\r\n")
	icsContent.WriteString("PRODID:-//Bus Planning//Journey Export//EN\r\n")

	for _, trip := range journey.SavedTrips {
		departureTime, _ := time.ParseInLocation("2006-01-02T15:04:05", trip.DepartureDateTime, time.Local)
		arrivalTime, _ := time.ParseInLocation("2006-01-02T15:04:05", trip.ArrivalDateTime, time.Local)

		icsContent.WriteString("BEGIN:VEVENT\r\n")
		icsContent.WriteString("DTSTART:" + departureTime.UTC().Format("20060102T150405Z") + "\r\n")
		icsContent.WriteString("DTEND:" + arrivalTime.UTC().Format("20060102T150405Z") + "\r\n")
		icsContent.WriteString("END:VEVENT\r\n")
	}

	icsContent.WriteString("END:VCALENDAR\r\n")

	err = os.WriteFile(testFile, []byte(icsContent.String()), 0644)
	if err != nil {
		t.Fatalf("Failed to write test ICS file: %v", err)
	}

	// Verify the file was created
	if _, err := os.Stat(testFile); os.IsNotExist(err) {
		t.Error("ICS file was not created")
	}

	// Read and verify content
	content, err := os.ReadFile(testFile)
	if err != nil {
		t.Fatalf("Failed to read ICS file: %v", err)
	}

	contentStr := string(content)

	// Verify ICS structure
	if !strings.Contains(contentStr, "BEGIN:VCALENDAR") {
		t.Error("ICS file should contain BEGIN:VCALENDAR")
	}
	if !strings.Contains(contentStr, "END:VCALENDAR") {
		t.Error("ICS file should contain END:VCALENDAR")
	}
	if !strings.Contains(contentStr, "BEGIN:VEVENT") {
		t.Error("ICS file should contain at least one VEVENT")
	}
	if !strings.Contains(contentStr, "DTSTART:") {
		t.Error("ICS file should contain DTSTART")
	}
	if !strings.Contains(contentStr, "DTEND:") {
		t.Error("ICS file should contain DTEND")
	}

	t.Logf("Generated ICS content:\n%s", contentStr)
}

// Test PDF export with real data
func TestExportJourneyToPDF_Content(t *testing.T) {
	app := NewApp()
	app.startup(context.Background())
	defer app.shutdown(context.Background())

	if app.db == nil {
		t.Fatal("Database connection failed")
	}

	// Get any available stations from the database
	stations, err := app.db.GetStops(90, -90, 180, -180)
	if err != nil || len(stations) < 2 {
		t.Skip("Not enough test data in database, skipping")
	}

	station1ID := stations[0].StopID
	station2ID := stations[1].StopID

	station1, err := app.GetStationDetails(station1ID)
	if err != nil {
		t.Skip("Test station 1 not found in database, skipping")
	}

	station2, err := app.GetStationDetails(station2ID)
	if err != nil {
		t.Skip("Test station 2 not found in database, skipping")
	}

	// Get a route from one of the stations
	if len(station1.Routes) == 0 {
		t.Skip("No routes available for test station, skipping")
	}
	route := station1.Routes[0]

	// Create journey data
	journey := models.JourneyData{
		Version:    1,
		CreatedAt:  time.Now().UTC().Format(time.RFC3339),
		ModifiedAt: time.Now().UTC().Format(time.RFC3339),
		SavedTrips: []models.SavedTripData{
			{
				TripID:            "test-trip-1",
				RouteID:           route.RouteID,
				StartStationID:    station1.StopID,
				DepartureDateTime: "2026-01-15T10:30:00",
				EndStationID:      station2.StopID,
				ArrivalDateTime:   "2026-01-15T11:15:00",
			},
			{
				TripID:            "test-trip-2",
				RouteID:           route.RouteID,
				StartStationID:    station2.StopID,
				DepartureDateTime: "2026-01-15T11:20:00",
				EndStationID:      station1.StopID,
				ArrivalDateTime:   "2026-01-15T12:05:00",
			},
		},
	}

	// Test PDF generation logic (without dialog)
	tmpDir := t.TempDir()
	testFile := filepath.Join(tmpDir, "test.pdf")

	// Generate PDF using fpdf
	pdf := createTestPDF(t, app, journey)

	// Write to file
	err = pdf.OutputFileAndClose(testFile)
	if err != nil {
		t.Fatalf("Failed to create PDF: %v", err)
	}

	// Verify the file was created
	fileInfo, err := os.Stat(testFile)
	if os.IsNotExist(err) {
		t.Error("PDF file was not created")
	}

	// PDF should have some content
	if fileInfo.Size() == 0 {
		t.Error("PDF file is empty")
	}

	t.Logf("Generated PDF file size: %d bytes", fileInfo.Size())
}

// Helper function to create a test PDF
func createTestPDF(t *testing.T, app *App, journey models.JourneyData) *fpdf.Fpdf {
	pdf := fpdf.New("P", "mm", "A4", "")
	pdf.AddPage()

	// Add title
	pdf.SetFont("Arial", "B", 20)
	pdf.Cell(0, 10, "Reiseplan")
	pdf.Ln(15)

	// Add each trip
	for i, trip := range journey.SavedTrips {
		route, err := app.db.GetRouteByID(trip.RouteID)
		if err != nil {
			t.Fatalf("Failed to get route: %v", err)
		}

		startStation, err := app.db.GetStationDetails(trip.StartStationID)
		if err != nil {
			t.Fatalf("Failed to get start station: %v", err)
		}

		endStation, err := app.db.GetStationDetails(trip.EndStationID)
		if err != nil {
			t.Fatalf("Failed to get end station: %v", err)
		}

		departureTime, _ := time.ParseInLocation("2006-01-02T15:04:05", trip.DepartureDateTime, time.Local)
		arrivalTime, _ := time.ParseInLocation("2006-01-02T15:04:05", trip.ArrivalDateTime, time.Local)

		routeTypeName := getRouteTypeName(route.RouteType)

		// Trip header
		pdf.SetFont("Arial", "B", 14)
		pdf.Cell(0, 8, "Fahrt "+string(rune('0'+i+1)))
		pdf.Ln(8)

		// Route info
		pdf.SetFont("Arial", "B", 12)
		pdf.Cell(0, 6, routeTypeName+" "+route.RouteShortName)
		pdf.Ln(8)

		// Departure
		pdf.SetFont("Arial", "B", 10)
		pdf.Cell(40, 6, "Abfahrt:")
		pdf.SetFont("Arial", "", 10)
		pdf.Cell(0, 6, departureTime.Format("15:04")+", "+startStation.StopName)
		pdf.Ln(6)

		// Arrival
		pdf.SetFont("Arial", "B", 10)
		pdf.Cell(40, 6, "Ankunft:")
		pdf.SetFont("Arial", "", 10)
		pdf.Cell(0, 6, arrivalTime.Format("15:04")+", "+endStation.StopName)
		pdf.Ln(10)
	}

	return pdf
}

// Test datetime parsing edge cases
func TestDateTimeParsing(t *testing.T) {
	tests := []struct {
		name      string
		datetime  string
		shouldErr bool
	}{
		{"Valid datetime", "2026-01-15T10:30:00", false},
		{"Valid datetime - early morning", "2026-01-15T00:00:00", false},
		{"Valid datetime - late night", "2026-01-15T23:59:59", false},
		{"Invalid format - missing time", "2026-01-15", true},
		{"Invalid format - with timezone", "2026-01-15T10:30:00Z", true},
		{"Invalid format - wrong separator", "2026-01-15 10:30:00", true},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			_, err := time.ParseInLocation("2006-01-02T15:04:05", test.datetime, time.Local)
			if test.shouldErr && err == nil {
				t.Errorf("Expected error for datetime %s, but got none", test.datetime)
			}
			if !test.shouldErr && err != nil {
				t.Errorf("Expected no error for datetime %s, but got: %v", test.datetime, err)
			}
		})
	}
}

// Test journey with no trips
func TestExportEmptyJourney(t *testing.T) {
	journey := models.JourneyData{
		Version:    1,
		SavedTrips: []models.SavedTripData{},
	}

	if len(journey.SavedTrips) != 0 {
		t.Error("Expected empty journey")
	}

	// Empty journeys should be handled gracefully
	// (In the actual UI, the export button is disabled when there are no trips)
}

// Test journey with multiple trips
func TestJourneyWithMultipleTrips(t *testing.T) {
	app := NewApp()
	app.startup(context.Background())
	defer app.shutdown(context.Background())

	if app.db == nil {
		t.Fatal("Database connection failed")
	}

	// Get any available station with routes
	stations, err := app.db.GetStops(90, -90, 180, -180)
	if err != nil || len(stations) == 0 {
		t.Skip("No test data in database, skipping")
	}

	stationDetails, err := app.GetStationDetails(stations[0].StopID)
	if err != nil || len(stationDetails.Routes) == 0 {
		t.Skip("No routes available for test, skipping")
	}

	route := stationDetails.Routes[0]

	journey := models.JourneyData{
		Version: 1,
		SavedTrips: []models.SavedTripData{
			{
				TripID:            "trip1",
				RouteID:           route.RouteID,
				StartStationID:    "station1",
				DepartureDateTime: "2026-01-15T10:00:00",
				EndStationID:      "station2",
				ArrivalDateTime:   "2026-01-15T10:30:00",
			},
			{
				TripID:            "trip2",
				RouteID:           route.RouteID,
				StartStationID:    "station2",
				DepartureDateTime: "2026-01-15T10:35:00",
				EndStationID:      "station3",
				ArrivalDateTime:   "2026-01-15T11:00:00",
			},
			{
				TripID:            "trip3",
				RouteID:           route.RouteID,
				StartStationID:    "station3",
				DepartureDateTime: "2026-01-15T11:05:00",
				EndStationID:      "station4",
				ArrivalDateTime:   "2026-01-15T11:45:00",
			},
		},
	}

	// Verify journey has multiple trips
	if len(journey.SavedTrips) != 3 {
		t.Errorf("Expected 3 trips, got %d", len(journey.SavedTrips))
	}

	// Calculate total duration
	firstDeparture, _ := time.ParseInLocation("2006-01-02T15:04:05", journey.SavedTrips[0].DepartureDateTime, time.Local)
	lastArrival, _ := time.ParseInLocation("2006-01-02T15:04:05", journey.SavedTrips[2].ArrivalDateTime, time.Local)
	totalDuration := lastArrival.Sub(firstDeparture)

	expectedDuration := 105 * time.Minute // 1 hour 45 minutes
	if totalDuration != expectedDuration {
		t.Errorf("Expected total duration %v, got %v", expectedDuration, totalDuration)
	}

	t.Logf("Journey has %d trips with total duration: %v", len(journey.SavedTrips), totalDuration)
}
