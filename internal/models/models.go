// Package models contains the data types used throughout the application.
package models

// Stop represents a GTFS stop
type Stop struct {
	StopID   string  `json:"stop_id"`
	StopName string  `json:"stop_name"`
	StopLat  float64 `json:"stop_lat"`
	StopLon  float64 `json:"stop_lon"`
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
	StopID        string  `json:"stop_id"`
	StopName      string  `json:"stop_name"`
	StopLat       float64 `json:"stop_lat"`
	StopLon       float64 `json:"stop_lon"`
	ArrivalTime   string  `json:"arrival_time"`
	DepartureTime string  `json:"departure_time"`
	StopSequence  int     `json:"stop_sequence"`
}

// UpcomingTrip represents a single trip departing from a station
type UpcomingTrip struct {
	TripID           string       `json:"trip_id"`
	RouteID          string       `json:"route_id"`
	RouteColor       string       `json:"route_color"`
	DepartureTime    string       `json:"departure_time"`
	Headsign         string       `json:"headsign"`
	DisplayName      string       `json:"display_name"`
	Destination      string       `json:"destination"`
	StartStationID   string       `json:"start_station_id"`
	StartStationName string       `json:"start_station_name"`
	Coordinates      []Coordinate `json:"coordinates"`
	StopTimes        []StopTime   `json:"stop_times"`
}

// UpcomingTripsData contains upcoming trips and all stations along those trips
type UpcomingTripsData struct {
	Trips    []UpcomingTrip `json:"trips"`
	Stations []Stop         `json:"stations"`
}
