// Package models contains the data types used throughout the application.
package models

// Stop represents a GTFS stop
type Stop struct {
	StopID   string  `json:"stop_id" db:"stop_id"`
	StopName string  `json:"stop_name" db:"stop_name"`
	StopLat  float64 `json:"stop_lat" db:"stop_lat"`
	StopLon  float64 `json:"stop_lon" db:"stop_lon"`
}

// Route represents a GTFS route
type Route struct {
	RouteID        string `json:"route_id"`
	RouteShortName string `json:"route_short_name"`
	RouteLongName  string `json:"route_long_name"`
	RouteDesc      string `json:"route_desc"`
	RouteType      int    `json:"route_type"`
	RouteColor     string `json:"route_color"`
	RouteTextColor string `json:"route_text_color"`
}

// StationDetails contains station info and its routes
type StationDetails struct {
	StopID   string  `json:"stop_id"`
	StopName string  `json:"stop_name"`
	StopLat  float64 `json:"stop_lat"`
	StopLon  float64 `json:"stop_lon"`
	Routes   []Route `json:"routes"`
}

// Coordinate represents a lat/lon point
type Coordinate struct {
	Lat float64 `json:"lat"`
	Lon float64 `json:"lon"`
}

// RouteGeometry contains the route info and its path
type RouteGeometry struct {
	RouteID        string       `json:"route_id"`
	RouteShortName string       `json:"route_short_name"`
	RouteLongName  string       `json:"route_long_name"`
	RouteColor     string       `json:"route_color"`
	Coordinates    []Coordinate `json:"coordinates"`
}

// RoutesData contains all route geometries and stations for display
type RoutesData struct {
	Routes   []RouteGeometry `json:"routes"`
	Stations []Stop          `json:"stations"`
}

// StopTime represents arrival and departure times at a specific stop along a trip
type StopTime struct {
	StopID            string  `json:"stop_id"`
	StopName          string  `json:"stop_name"`
	StopLat           float64 `json:"stop_lat"`
	StopLon           float64 `json:"stop_lon"`
	ArrivalDateTime   string  `json:"arrival_datetime"`
	DepartureDateTime string  `json:"departure_datetime"`
	StopSequence      int     `json:"stop_sequence"`
	PlatformCode      string  `json:"platform_code"`
}

// UpcomingTrip represents a single trip departing from a station
type UpcomingTrip struct {
	TripID            string       `json:"trip_id"`
	RouteID           string       `json:"route_id"`
	RouteType         int          `json:"route_type"`
	RouteColor        string       `json:"route_color"`
	DepartureDateTime string       `json:"departure_datetime"`
	Headsign          string       `json:"headsign"`
	DisplayName       string       `json:"display_name"`
	Destination       string       `json:"destination"`
	StartStationID    string       `json:"start_station_id"`
	StartStationName  string       `json:"start_station_name"`
	Coordinates       []Coordinate `json:"coordinates"`
	StopTimes         []StopTime   `json:"stop_times"`
}

// UpcomingTripsData contains upcoming trips and all stations along those trips
type UpcomingTripsData struct {
	Trips    []UpcomingTrip `json:"trips"`
	Stations []Stop         `json:"stations"`
}

// TripDetails contains the full details of a trip including all stops
type TripDetails struct {
	TripID      string     `json:"trip_id"`
	RouteID     string     `json:"route_id"`
	RouteType   int        `json:"route_type"`
	RouteColor  string     `json:"route_color"`
	DisplayName string     `json:"display_name"`
	Destination string     `json:"destination"`
	Headsign    string     `json:"headsign"`
	StopTimes   []StopTime `json:"stop_times"`
}

// SavedTripData stores only IDs and times for journey persistence.
// Station names and route details are fetched from the database on load.
type SavedTripData struct {
	TripID            string `json:"tripId"`
	RouteID           string `json:"routeId"`
	StartStationID    string `json:"startStationId"`
	DepartureDateTime string `json:"departureDateTime"`
	EndStationID      string `json:"endStationId"`
	ArrivalDateTime   string `json:"arrivalDateTime"`
}

// MapView represents the map viewport state for journey persistence
type MapView struct {
	Longitude float64 `json:"longitude"`
	Latitude  float64 `json:"latitude"`
	Zoom      float64 `json:"zoom"`
}

// JourneyData represents a complete journey for file persistence
type JourneyData struct {
	Version           int             `json:"version"`
	CreatedAt         string          `json:"createdAt"`
	ModifiedAt        string          `json:"modifiedAt"`
	SavedTrips        []SavedTripData `json:"savedTrips"`
	SelectedStationID string          `json:"selectedStationId,omitempty"`
	CurrentDateTime   string          `json:"currentDateTime"`
	MapView           *MapView        `json:"mapView,omitempty"`
}
