// Package paths resolves the platform-appropriate location for application data
// (the generated GTFS SQLite database and the downloaded feed).
package paths

import (
	"fmt"
	"os"
	"path/filepath"
	"runtime"
)

const appDir = "gtfs-planner"

// dbFile is the filename of the generated SQLite database.
const dbFile = "gtfs.sqlite"

// feedFile is the filename of the downloaded GTFS feed, kept between the
// download and import steps.
const feedFile = "feed.zip"

// DataDir returns the directory where the app stores its data, creating it if
// necessary. The base directory is platform-specific:
//
//	Linux/other: $XDG_DATA_HOME or ~/.local/share
//	macOS:       ~/Library/Application Support
//	Windows:     %LocalAppData% (deliberately not Roaming — the DB is large
//	             and must not be synced)
//
// GTFS_PLANNING_DATA_DIR overrides the resolved directory (used by tests).
func DataDir() (string, error) {
	if override := os.Getenv("GTFS_PLANNING_DATA_DIR"); override != "" {
		if err := os.MkdirAll(override, 0o755); err != nil {
			return "", fmt.Errorf("failed to create data dir: %w", err)
		}
		return override, nil
	}

	base, err := baseDir()
	if err != nil {
		return "", err
	}

	dir := filepath.Join(base, appDir)
	if err := os.MkdirAll(dir, 0o755); err != nil {
		return "", fmt.Errorf("failed to create data dir: %w", err)
	}
	return dir, nil
}

// baseDir returns the platform base directory (without the app subdirectory).
func baseDir() (string, error) {
	switch runtime.GOOS {
	case "windows":
		if local := os.Getenv("LocalAppData"); local != "" {
			return local, nil
		}
		return "", fmt.Errorf("LocalAppData environment variable not set")
	case "darwin":
		home, err := os.UserHomeDir()
		if err != nil {
			return "", err
		}
		return filepath.Join(home, "Library", "Application Support"), nil
	default: // linux and others follow the XDG base directory spec
		if xdg := os.Getenv("XDG_DATA_HOME"); xdg != "" {
			return xdg, nil
		}
		home, err := os.UserHomeDir()
		if err != nil {
			return "", err
		}
		return filepath.Join(home, ".local", "share"), nil
	}
}

// DatabasePath returns the full path to the SQLite database file.
func DatabasePath() (string, error) {
	dir, err := DataDir()
	if err != nil {
		return "", err
	}
	return filepath.Join(dir, dbFile), nil
}

// FeedPath returns the full path to the downloaded GTFS feed zip.
func FeedPath() (string, error) {
	dir, err := DataDir()
	if err != nil {
		return "", err
	}
	return filepath.Join(dir, feedFile), nil
}
