package main

import (
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
	"time"
)

// LocationResult represents a geographical location
type LocationResult struct {
	Latitude  float64 `json:"latitude"`
	Longitude float64 `json:"longitude"`
	Source    string  `json:"source"` // "native", "ip", "default"
	City      string  `json:"city,omitempty"`
	Country   string  `json:"country,omitempty"`
	Error     string  `json:"error,omitempty"`
}

// GetUserLocation attempts to get the user's location using multiple methods
func (a *App) GetUserLocation() LocationResult {
	// Try platform-specific native location first
	if loc, err := getNativeLocation(); err == nil {
		loc.Source = "native"
		return loc
	}

	// Fallback to IP-based geolocation
	if loc, err := getLocationFromIP(); err == nil {
		loc.Source = "ip"
		return loc
	}

	// Final fallback: Center of Germany
	return LocationResult{
		Latitude:  51.1657,
		Longitude: 10.4515,
		Source:    "default",
	}
}

// getLocationFromIP uses IP-based geolocation as fallback
func getLocationFromIP() (LocationResult, error) {
	client := &http.Client{
		Timeout: 5 * time.Second,
	}

	resp, err := client.Get("https://ipinfo.io/json")
	if err != nil {
		return LocationResult{}, err
	}
	defer resp.Body.Close()

	var info struct {
		Loc     string `json:"loc"`
		City    string `json:"city"`
		Country string `json:"country"`
	}

	if err := json.NewDecoder(resp.Body).Decode(&info); err != nil {
		return LocationResult{}, err
	}

	// Parse "latitude,longitude"
	parts := strings.Split(info.Loc, ",")
	if len(parts) != 2 {
		return LocationResult{}, fmt.Errorf("invalid location format: %s", info.Loc)
	}

	var lat, lon float64
	if _, err := fmt.Sscanf(parts[0], "%f", &lat); err != nil {
		return LocationResult{}, err
	}
	if _, err := fmt.Sscanf(parts[1], "%f", &lon); err != nil {
		return LocationResult{}, err
	}

	return LocationResult{
		Latitude:  lat,
		Longitude: lon,
		City:      info.City,
		Country:   info.Country,
	}, nil
}
