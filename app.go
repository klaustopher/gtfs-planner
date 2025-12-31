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
