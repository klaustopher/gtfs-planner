package main

import (
	"fmt"
	"os"
	"path/filepath"

	"gopkg.in/yaml.v3"
)

// Config holds the application configuration
type Config struct {
	// GTFS feed download URL
	FeedURL string `yaml:"feed_url"`
	// Path to download the GTFS zip file
	FeedPath string `yaml:"feed_path"`
	// Path to the SQLite database
	DatabasePath string `yaml:"database_path"`
}

// DefaultConfig returns the default configuration
func DefaultConfig() *Config {
	return &Config{
		FeedURL:      "https://download.gtfs.de/germany/nv_free/latest.zip",
		FeedPath:     "gtfs-data/feeds/latest.zip",
		DatabasePath: "gtfs-data/sqlite/gtfs.sqlite",
	}
}

// LoadConfig loads configuration from a file, or returns defaults if not found
func LoadConfig(configPath string) (*Config, error) {
	// If no config path specified, try default locations
	if configPath == "" {
		candidates := []string{
			"gtfs-config.yaml",
			"gtfs-config.yml",
		}
		for _, c := range candidates {
			if _, err := os.Stat(c); err == nil {
				configPath = c
				break
			}
		}
	}

	// If still no config file, return defaults
	if configPath == "" {
		return DefaultConfig(), nil
	}

	data, err := os.ReadFile(configPath)
	if err != nil {
		return nil, fmt.Errorf("failed to read config file: %w", err)
	}

	cfg := DefaultConfig()
	if err := yaml.Unmarshal(data, cfg); err != nil {
		return nil, fmt.Errorf("failed to parse config file: %w", err)
	}

	return cfg, nil
}

// EnsureDirectories creates the necessary directories for feed and database paths
func (c *Config) EnsureDirectories() error {
	feedDir := filepath.Dir(c.FeedPath)
	if err := os.MkdirAll(feedDir, 0755); err != nil {
		return fmt.Errorf("failed to create feed directory: %w", err)
	}

	dbDir := filepath.Dir(c.DatabasePath)
	if err := os.MkdirAll(dbDir, 0755); err != nil {
		return fmt.Errorf("failed to create database directory: %w", err)
	}

	return nil
}
