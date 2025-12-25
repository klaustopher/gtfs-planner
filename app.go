package main

import (
	"context"
	"fmt"

	"bus-planning/internal/db"
	"bus-planning/internal/models"
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
