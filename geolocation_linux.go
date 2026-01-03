//go:build linux
// +build linux

package main

import (
	"fmt"
)

// Linux location services via GeoClue2 require D-Bus integration
// This is complex and distribution-dependent
// For now, we rely on IP-based fallback
func getNativeLocation() (LocationResult, error) {
	// GeoClue2 D-Bus implementation would go here
	// This requires github.com/godbus/dbus package and is quite complex

	return LocationResult{}, fmt.Errorf("native Linux location API not implemented, using IP fallback")
}
