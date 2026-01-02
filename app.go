package main

import (
	"context"
	"encoding/json"
	"fmt"
	"os"
	"strings"
	"time"

	"bus-planning/internal/db"
	"bus-planning/internal/models"

	"codeberg.org/go-pdf/fpdf"
	"github.com/wailsapp/wails/v2/pkg/runtime"
)

// App struct
type App struct {
	ctx context.Context
	db  *db.DB
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
	database, err := db.Open("gtfs-data/sqlite/gtfs.sqlite")
	if err != nil {
		fmt.Printf("Failed to open database: %v\n", err)
		return
	}
	a.db = database
}

// shutdown is called when the app is closing
func (a *App) shutdown(ctx context.Context) {
	if a.db != nil {
		a.db.Close()
	}
}

// GetStops returns all stops within the given bounding box
func (a *App) GetStops(north, south, east, west float64) ([]models.Stop, error) {
	if a.db == nil {
		return nil, fmt.Errorf("database not connected")
	}
	return a.db.GetStops(north, south, east, west)
}

// GetStationDetails returns details about a station including its routes
func (a *App) GetStationDetails(stopID string) (*models.StationDetails, error) {
	if a.db == nil {
		return nil, fmt.Errorf("database not connected")
	}
	return a.db.GetStationDetails(stopID)
}

// GetRoutesForStation returns route geometries and all stations for routes serving a station
func (a *App) GetRoutesForStation(stopID string) (*models.RoutesData, error) {
	if a.db == nil {
		return nil, fmt.Errorf("database not connected")
	}
	return a.db.GetRoutesForStation(stopID)
}

// SearchStations returns stations that loosely match the provided query text.
func (a *App) SearchStations(query string, limit int) ([]models.Stop, error) {
	if a.db == nil {
		return nil, fmt.Errorf("database not connected")
	}
	return a.db.SearchStations(query, limit)
}

// GetUpcomingTrips returns the next trips departing from a station at or after the given datetime.
// datetime should be in ISO 8601 format: "2006-01-02T15:04:05".
func (a *App) GetUpcomingTrips(stopID string, datetime string, limit int) (*models.UpcomingTripsData, error) {
	if a.db == nil {
		return nil, fmt.Errorf("database not connected")
	}
	return a.db.GetUpcomingTrips(stopID, datetime, limit)
}

// GetNearbyStations returns all parent stations within radiusMeters of the given station.
// radiusMeters should be between 0 and 200.
func (a *App) GetNearbyStations(stopID string, radiusMeters float64) ([]models.Stop, error) {
	if a.db == nil {
		return nil, fmt.Errorf("database not connected")
	}
	return a.db.GetNearbyStations(stopID, radiusMeters)
}

// GetUpcomingTripsWithNearby returns upcoming trips from a station and nearby stations.
// datetime should be in ISO 8601 format: "2006-01-02T15:04:05".
// radiusMeters should be between 0 and 200 (0 means no nearby stations).
func (a *App) GetUpcomingTripsWithNearby(stopID string, radiusMeters float64, datetime string, limit int) (*models.UpcomingTripsData, error) {
	if a.db == nil {
		return nil, fmt.Errorf("database not connected")
	}
	// If radius is 0, use the standard method
	if radiusMeters <= 0 {
		return a.db.GetUpcomingTrips(stopID, datetime, limit)
	}
	return a.db.GetUpcomingTripsWithNearby(stopID, radiusMeters, datetime, limit)
}

// GetTripDetails returns the full details of a trip including all stops.
// tripID is the GTFS trip_id and serviceDate should be in YYYYMMDD format.
func (a *App) GetTripDetails(tripID string, serviceDate string) (*models.TripDetails, error) {
	if a.db == nil {
		return nil, fmt.Errorf("database not connected")
	}
	return a.db.GetTripDetails(tripID, serviceDate)
}

// Greet returns a greeting for the given name
func (a *App) Greet(name string) string {
	return fmt.Sprintf("Hello %s, It's show time!", name)
}

// GetRouteByID returns route details for a given route_id.
func (a *App) GetRouteByID(routeID string) (*models.Route, error) {
	if a.db == nil {
		return nil, fmt.Errorf("database not connected")
	}
	return a.db.GetRouteByID(routeID)
}

// SaveJourney opens a save file dialog and writes journey data to the selected file.
// Returns the saved file path, or empty string if cancelled.
func (a *App) SaveJourney(journey models.JourneyData) (string, error) {
	// Update timestamps
	now := time.Now().UTC().Format(time.RFC3339)
	if journey.CreatedAt == "" {
		journey.CreatedAt = now
	}
	journey.ModifiedAt = now
	journey.Version = 1

	// Show save dialog
	filePath, err := runtime.SaveFileDialog(a.ctx, runtime.SaveDialogOptions{
		Title:           "Reise speichern",
		DefaultFilename: "journey.journey",
		Filters: []runtime.FileFilter{
			{
				DisplayName: "Journey Files (*.journey)",
				Pattern:     "*.journey",
			},
		},
	})
	if err != nil {
		return "", fmt.Errorf("dialog error: %w", err)
	}

	// User cancelled
	if filePath == "" {
		return "", nil
	}

	// Ensure .journey extension
	if !strings.HasSuffix(filePath, ".journey") {
		filePath += ".journey"
	}

	// Marshal to JSON with indentation for readability
	data, err := json.MarshalIndent(journey, "", "  ")
	if err != nil {
		return "", fmt.Errorf("failed to serialize journey: %w", err)
	}

	// Write to file
	if err := os.WriteFile(filePath, data, 0644); err != nil {
		return "", fmt.Errorf("failed to write file: %w", err)
	}

	return filePath, nil
}

// LoadJourneyResult is the return type for LoadJourney to work with Wails bindings
type LoadJourneyResult struct {
	Journey  *models.JourneyData `json:"journey"`
	FilePath string              `json:"filePath"`
}

// LoadJourney opens a file dialog and reads journey data from the selected file.
// Returns nil journey and empty path if cancelled.
func (a *App) LoadJourney() (*LoadJourneyResult, error) {
	// Show open dialog
	filePath, err := runtime.OpenFileDialog(a.ctx, runtime.OpenDialogOptions{
		Title: "Reise laden",
		Filters: []runtime.FileFilter{
			{
				DisplayName: "Journey Files (*.journey)",
				Pattern:     "*.journey",
			},
		},
	})
	if err != nil {
		return nil, fmt.Errorf("dialog error: %w", err)
	}

	// User cancelled
	if filePath == "" {
		return &LoadJourneyResult{}, nil
	}

	// Read file
	data, err := os.ReadFile(filePath)
	if err != nil {
		return nil, fmt.Errorf("failed to read file: %w", err)
	}

	// Parse JSON
	var journey models.JourneyData
	if err := json.Unmarshal(data, &journey); err != nil {
		return nil, fmt.Errorf("failed to parse journey file: %w", err)
	}

	// Version check for future compatibility
	if journey.Version > 1 {
		return nil, fmt.Errorf("journey file version %d is not supported (max: 1)", journey.Version)
	}

	return &LoadJourneyResult{
		Journey:  &journey,
		FilePath: filePath,
	}, nil
}

// ShowConfirmDialog shows a confirmation dialog with Yes/No buttons.
// Returns true if user clicked Yes, false otherwise.
func (a *App) ShowConfirmDialog(title, message string) (bool, error) {
	result, err := runtime.MessageDialog(a.ctx, runtime.MessageDialogOptions{
		Type:          runtime.QuestionDialog,
		Title:         title,
		Message:       message,
		Buttons:       []string{"Ja", "Nein"},
		DefaultButton: "Nein",
		CancelButton:  "Nein",
	})
	if err != nil {
		return false, err
	}
	return result == "Ja", nil
}

// ExportJourneyToICS exports the journey as an ICS (iCalendar) file.
// Each trip becomes a separate event with full details.
// Returns the saved file path, or empty string if cancelled.
func (a *App) ExportJourneyToICS(journey models.JourneyData) (string, error) {
	// Show save dialog
	filePath, err := runtime.SaveFileDialog(a.ctx, runtime.SaveDialogOptions{
		Title:           "Reise als ICS exportieren",
		DefaultFilename: "journey.ics",
		Filters: []runtime.FileFilter{
			{
				DisplayName: "iCalendar Files (*.ics)",
				Pattern:     "*.ics",
			},
		},
	})
	if err != nil {
		return "", fmt.Errorf("dialog error: %w", err)
	}

	// User cancelled
	if filePath == "" {
		return "", nil
	}

	// Ensure .ics extension
	if !strings.HasSuffix(filePath, ".ics") {
		filePath += ".ics"
	}

	// Generate ICS content
	var icsContent strings.Builder
	icsContent.WriteString("BEGIN:VCALENDAR\r\n")
	icsContent.WriteString("VERSION:2.0\r\n")
	icsContent.WriteString("PRODID:-//Bus Planning//Journey Export//EN\r\n")
	icsContent.WriteString("CALSCALE:GREGORIAN\r\n")
	icsContent.WriteString("METHOD:PUBLISH\r\n")

	// Add each trip as a separate event
	for i, trip := range journey.SavedTrips {
		// Fetch route and station details from database
		route, err := a.db.GetRouteByID(trip.RouteID)
		if err != nil {
			return "", fmt.Errorf("failed to get route details: %w", err)
		}

		startStation, err := a.db.GetStationDetails(trip.StartStationID)
		if err != nil {
			return "", fmt.Errorf("failed to get start station: %w", err)
		}

		endStation, err := a.db.GetStationDetails(trip.EndStationID)
		if err != nil {
			return "", fmt.Errorf("failed to get end station: %w", err)
		}

		// Parse times (ISO 8601 format without timezone, assume local time)
		departureTime, err := time.ParseInLocation("2006-01-02T15:04:05", trip.DepartureDateTime, time.Local)
		if err != nil {
			return "", fmt.Errorf("failed to parse departure time: %w", err)
		}

		arrivalTime, err := time.ParseInLocation("2006-01-02T15:04:05", trip.ArrivalDateTime, time.Local)
		if err != nil {
			return "", fmt.Errorf("failed to parse arrival time: %w", err)
		}

		// Format times for ICS (YYYYMMDDTHHMMSSZ)
		formatICSTime := func(t time.Time) string {
			return t.UTC().Format("20060102T150405Z")
		}

		// Create unique ID
		uid := fmt.Sprintf("%s-%s-%d@bus-planning", trip.TripID, trip.StartStationID, i)

		// Get route type name
		routeTypeName := getRouteTypeName(route.RouteType)

		// Build event
		icsContent.WriteString("BEGIN:VEVENT\r\n")
		icsContent.WriteString(fmt.Sprintf("UID:%s\r\n", uid))
		icsContent.WriteString(fmt.Sprintf("DTSTAMP:%s\r\n", formatICSTime(time.Now())))
		icsContent.WriteString(fmt.Sprintf("DTSTART:%s\r\n", formatICSTime(departureTime)))
		icsContent.WriteString(fmt.Sprintf("DTEND:%s\r\n", formatICSTime(arrivalTime)))
		icsContent.WriteString(fmt.Sprintf("SUMMARY:%s %s → %s\r\n",
			route.RouteShortName, startStation.StopName, endStation.StopName))

		// Build description with all details
		description := fmt.Sprintf(
			"Verkehrsmittel: %s %s\\n"+
				"Abfahrt: %s um %s\\n"+
				"Ankunft: %s um %s\\n"+
				"Trip ID: %s",
			routeTypeName,
			route.RouteShortName,
			startStation.StopName,
			departureTime.Format("15:04"),
			endStation.StopName,
			arrivalTime.Format("15:04"),
			trip.TripID,
		)
		icsContent.WriteString(fmt.Sprintf("DESCRIPTION:%s\r\n", description))
		icsContent.WriteString(fmt.Sprintf("LOCATION:%s\r\n", startStation.StopName))
		icsContent.WriteString(fmt.Sprintf("SEQUENCE:%d\r\n", i))
		icsContent.WriteString("END:VEVENT\r\n")
	}

	icsContent.WriteString("END:VCALENDAR\r\n")

	// Write to file
	if err := os.WriteFile(filePath, []byte(icsContent.String()), 0644); err != nil {
		return "", fmt.Errorf("failed to write file: %w", err)
	}

	return filePath, nil
}

// ExportJourneyToPDF exports the journey as a PDF file.
// Returns the saved file path, or empty string if cancelled.
func (a *App) ExportJourneyToPDF(journey models.JourneyData) (string, error) {
	// Show save dialog
	filePath, err := runtime.SaveFileDialog(a.ctx, runtime.SaveDialogOptions{
		Title:           "Reise als PDF exportieren",
		DefaultFilename: "journey.pdf",
		Filters: []runtime.FileFilter{
			{
				DisplayName: "PDF Files (*.pdf)",
				Pattern:     "*.pdf",
			},
		},
	})
	if err != nil {
		return "", fmt.Errorf("dialog error: %w", err)
	}

	// User cancelled
	if filePath == "" {
		return "", nil
	}

	// Ensure .pdf extension
	if !strings.HasSuffix(filePath, ".pdf") {
		filePath += ".pdf"
	}

	// Create PDF
	pdf := fpdf.New("P", "mm", "A4", "")
	pdf.AddPage()

	// Add title
	pdf.SetFont("Arial", "B", 20)
	pdf.Cell(0, 10, "Reiseplan")
	pdf.Ln(15)

	// Add journey metadata
	pdf.SetFont("Arial", "", 10)
	if journey.CreatedAt != "" {
		createdTime, err := time.Parse(time.RFC3339, journey.CreatedAt)
		if err == nil {
			pdf.Cell(0, 6, fmt.Sprintf("Erstellt: %s", createdTime.Format("02.01.2006 15:04")))
			pdf.Ln(6)
		}
	}
	pdf.Ln(5)

	// Add each trip
	for i, trip := range journey.SavedTrips {
		// Fetch route and station details from database
		route, err := a.db.GetRouteByID(trip.RouteID)
		if err != nil {
			return "", fmt.Errorf("failed to get route details: %w", err)
		}

		startStation, err := a.db.GetStationDetails(trip.StartStationID)
		if err != nil {
			return "", fmt.Errorf("failed to get start station: %w", err)
		}

		endStation, err := a.db.GetStationDetails(trip.EndStationID)
		if err != nil {
			return "", fmt.Errorf("failed to get end station: %w", err)
		}

		// Parse times (ISO 8601 format without timezone, assume local time)
		departureTime, err := time.ParseInLocation("2006-01-02T15:04:05", trip.DepartureDateTime, time.Local)
		if err != nil {
			return "", fmt.Errorf("failed to parse departure time: %w", err)
		}

		arrivalTime, err := time.ParseInLocation("2006-01-02T15:04:05", trip.ArrivalDateTime, time.Local)
		if err != nil {
			return "", fmt.Errorf("failed to parse arrival time: %w", err)
		}

		// Get route type name
		routeTypeName := getRouteTypeName(route.RouteType)

		// Trip header with number
		pdf.SetFont("Arial", "B", 14)
		pdf.SetFillColor(240, 240, 240)
		pdf.CellFormat(0, 8, fmt.Sprintf("Fahrt %d", i+1), "0", 1, "L", true, 0, "")
		pdf.Ln(3)

		// Route info
		pdf.SetFont("Arial", "B", 12)
		pdf.Cell(0, 6, fmt.Sprintf("%s %s", routeTypeName, route.RouteShortName))
		pdf.Ln(8)

		// Departure
		pdf.SetFont("Arial", "B", 10)
		pdf.Cell(40, 6, "Abfahrt:")
		pdf.SetFont("Arial", "", 10)
		pdf.Cell(0, 6, fmt.Sprintf("%s, %s", departureTime.Format("15:04"), startStation.StopName))
		pdf.Ln(6)

		// Arrival
		pdf.SetFont("Arial", "B", 10)
		pdf.Cell(40, 6, "Ankunft:")
		pdf.SetFont("Arial", "", 10)
		pdf.Cell(0, 6, fmt.Sprintf("%s, %s", arrivalTime.Format("15:04"), endStation.StopName))
		pdf.Ln(6)

		// Duration
		duration := arrivalTime.Sub(departureTime)
		pdf.SetFont("Arial", "B", 10)
		pdf.Cell(40, 6, "Dauer:")
		pdf.SetFont("Arial", "", 10)
		hours := int(duration.Hours())
		minutes := int(duration.Minutes()) % 60
		if hours > 0 {
			pdf.Cell(0, 6, fmt.Sprintf("%d Std. %d Min.", hours, minutes))
		} else {
			pdf.Cell(0, 6, fmt.Sprintf("%d Min.", minutes))
		}
		pdf.Ln(10)

		// Add some spacing between trips
		if i < len(journey.SavedTrips)-1 {
			pdf.Ln(5)
		}
	}

	// Add footer with total journey info
	if len(journey.SavedTrips) > 0 {
		firstTrip := journey.SavedTrips[0]
		lastTrip := journey.SavedTrips[len(journey.SavedTrips)-1]

		departureTime, _ := time.ParseInLocation("2006-01-02T15:04:05", firstTrip.DepartureDateTime, time.Local)
		arrivalTime, _ := time.ParseInLocation("2006-01-02T15:04:05", lastTrip.ArrivalDateTime, time.Local)
		totalDuration := arrivalTime.Sub(departureTime)

		pdf.Ln(10)
		pdf.SetFont("Arial", "B", 12)
		pdf.SetFillColor(220, 220, 220)
		pdf.CellFormat(0, 8, "Gesamt", "0", 1, "L", true, 0, "")
		pdf.Ln(3)

		pdf.SetFont("Arial", "", 10)
		pdf.Cell(0, 6, fmt.Sprintf("Anzahl Fahrten: %d", len(journey.SavedTrips)))
		pdf.Ln(6)

		hours := int(totalDuration.Hours())
		minutes := int(totalDuration.Minutes()) % 60
		if hours > 0 {
			pdf.Cell(0, 6, fmt.Sprintf("Gesamtdauer: %d Std. %d Min.", hours, minutes))
		} else {
			pdf.Cell(0, 6, fmt.Sprintf("Gesamtdauer: %d Min.", minutes))
		}
	}

	// Write to file
	if err := pdf.OutputFileAndClose(filePath); err != nil {
		return "", fmt.Errorf("failed to write PDF: %w", err)
	}

	return filePath, nil
}

// getRouteTypeName returns the German name for a GTFS route type
func getRouteTypeName(routeType int) string {
	switch routeType {
	case 0:
		return "Straßenbahn"
	case 1:
		return "U-Bahn"
	case 2:
		return "Zug"
	case 3:
		return "Bus"
	case 4:
		return "Fähre"
	case 5:
		return "Seilbahn"
	case 6:
		return "Gondel"
	case 7:
		return "Standseilbahn"
	case 11:
		return "Oberleitungsbus"
	case 12:
		return "Einschienenbahn"
	default:
		return "ÖPNV"
	}
}
