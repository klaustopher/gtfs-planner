package main

import (
	"encoding/json"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"

	"github.com/spf13/cobra"
)

var importCmd = &cobra.Command{
	Use:   "import",
	Short: "Import GTFS feed into SQLite database",
	Long:  `Parses the downloaded GTFS ZIP file and imports it into a SQLite database using gtfs-import from the gtfs npm package.`,
	Run:   runImport,
}

// gtfsConfig is the configuration structure for gtfs-import
type gtfsConfig struct {
	Agencies   []gtfsAgency `json:"agencies"`
	SQLitePath string       `json:"sqlitePath"`
}

type gtfsAgency struct {
	Path string `json:"path"`
}

func runImport(cmd *cobra.Command, args []string) {
	cfg, err := LoadConfig(cfgFile)
	if err != nil {
		fmt.Println(errorStyle.Render("Error loading config: " + err.Error()))
		os.Exit(1)
	}

	fmt.Println(titleStyle.Render("GTFS Import"))
	fmt.Println()

	// Check if feed file exists
	if _, err := os.Stat(cfg.FeedPath); os.IsNotExist(err) {
		fmt.Println(errorStyle.Render("Feed file not found: " + cfg.FeedPath))
		fmt.Println(infoStyle.Render("\nRun 'gtfs-manager download' first to download the feed."))
		os.Exit(1)
	}

	// Check if npx is available
	if _, err := exec.LookPath("npx"); err != nil {
		fmt.Println(errorStyle.Render("npx not found. Please install Node.js and npm."))
		os.Exit(1)
	}

	// Ensure database directory exists
	if err := cfg.EnsureDirectories(); err != nil {
		fmt.Println(errorStyle.Render("Error creating directories: " + err.Error()))
		os.Exit(1)
	}

	// Get absolute paths
	feedPathAbs, err := filepath.Abs(cfg.FeedPath)
	if err != nil {
		fmt.Println(errorStyle.Render("Error resolving feed path: " + err.Error()))
		os.Exit(1)
	}

	dbPathAbs, err := filepath.Abs(cfg.DatabasePath)
	if err != nil {
		fmt.Println(errorStyle.Render("Error resolving database path: " + err.Error()))
		os.Exit(1)
	}

	// Create temporary config file for gtfs-import
	gtfsCfg := gtfsConfig{
		Agencies: []gtfsAgency{
			{Path: feedPathAbs},
		},
		SQLitePath: dbPathAbs,
	}

	configJSON, err := json.MarshalIndent(gtfsCfg, "", "  ")
	if err != nil {
		fmt.Println(errorStyle.Render("Error creating config: " + err.Error()))
		os.Exit(1)
	}

	// Write temp config file
	tmpConfig, err := os.CreateTemp("", "gtfs-config-*.json")
	if err != nil {
		fmt.Println(errorStyle.Render("Error creating temp config: " + err.Error()))
		os.Exit(1)
	}
	tmpConfigPath := tmpConfig.Name()
	defer os.Remove(tmpConfigPath)

	if _, err := tmpConfig.Write(configJSON); err != nil {
		tmpConfig.Close()
		fmt.Println(errorStyle.Render("Error writing temp config: " + err.Error()))
		os.Exit(1)
	}
	tmpConfig.Close()

	// Show config info
	fmt.Println(labelStyle.Render("Feed file:") + valueStyle.Render(feedPathAbs))
	fmt.Println(labelStyle.Render("Database:") + valueStyle.Render(dbPathAbs))
	fmt.Println()
	fmt.Println(infoStyle.Render("Running gtfs-import (this may take a while)..."))
	fmt.Println()

	// Run gtfs-import using npx
	execCmd := exec.Command("npx", "--package=gtfs", "--", "gtfs-import", "--configPath", tmpConfigPath)
	execCmd.Stdout = os.Stdout
	execCmd.Stderr = os.Stderr

	if err := execCmd.Run(); err != nil {
		fmt.Println()
		fmt.Println(errorStyle.Render("Import failed: " + err.Error()))
		os.Exit(1)
	}

	fmt.Println()
	fmt.Println(successStyle.Render("✓ Import complete!"))
	fmt.Println()
	fmt.Println(infoStyle.Render("Run 'gtfs-manager status' to check the imported data."))
}
