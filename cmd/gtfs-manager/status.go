package main

import (
	"database/sql"
	"fmt"
	"os"
	"time"

	"github.com/charmbracelet/lipgloss"
	_ "github.com/mattn/go-sqlite3"
	"github.com/spf13/cobra"
)

var (
	titleStyle = lipgloss.NewStyle().
			Bold(true).
			Foreground(lipgloss.Color("63")).
			MarginBottom(1)

	infoStyle = lipgloss.NewStyle().
			Foreground(lipgloss.Color("252"))

	successStyle = lipgloss.NewStyle().
			Foreground(lipgloss.Color("42")).
			Bold(true)

	warningStyle = lipgloss.NewStyle().
			Foreground(lipgloss.Color("214")).
			Bold(true)

	errorStyle = lipgloss.NewStyle().
			Foreground(lipgloss.Color("196")).
			Bold(true)

	labelStyle = lipgloss.NewStyle().
			Foreground(lipgloss.Color("245")).
			Width(20)

	valueStyle = lipgloss.NewStyle().
			Foreground(lipgloss.Color("255"))

	boxStyle = lipgloss.NewStyle().
			Border(lipgloss.RoundedBorder()).
			BorderForeground(lipgloss.Color("63")).
			Padding(1, 2).
			MarginTop(1)

	// Route type to human-readable name mapping (GTFS specification)
	routeTypeNames = map[int]string{
		0:  "Tram/Streetcar/Light rail",
		1:  "Subway/Metro",
		2:  "Rail",
		3:  "Bus",
		4:  "Ferry",
		5:  "Cable tram",
		6:  "Aerial lift/Gondola",
		7:  "Funicular",
		11: "Trolleybus",
		12: "Monorail",
	}
)

var statusCmd = &cobra.Command{
	Use:   "status",
	Short: "Check GTFS database status and data availability",
	Long:  `Displays the minimum and maximum trip dates in the database and warns if less than 2 weeks of data is available.`,
	Run:   runStatus,
}

func runStatus(cmd *cobra.Command, args []string) {
	cfg, err := LoadConfig(cfgFile)
	if err != nil {
		fmt.Println(errorStyle.Render("Error loading config: " + err.Error()))
		os.Exit(1)
	}

	fmt.Println(titleStyle.Render("GTFS Database Status"))

	// Check if database exists
	if _, err := os.Stat(cfg.DatabasePath); os.IsNotExist(err) {
		fmt.Println(errorStyle.Render("Database not found: " + cfg.DatabasePath))
		fmt.Println(infoStyle.Render("\nRun 'gtfs-manager download' and 'gtfs-manager import' to create the database."))
		os.Exit(1)
	}

	// Open database
	db, err := sql.Open("sqlite3", cfg.DatabasePath+"?mode=ro")
	if err != nil {
		fmt.Println(errorStyle.Render("Failed to open database: " + err.Error()))
		os.Exit(1)
	}
	defer db.Close()

	// Get date range from calendar and calendar_dates tables
	minDate, maxDate, err := getTripDateRange(db)
	if err != nil {
		fmt.Println(errorStyle.Render("Failed to query date range: " + err.Error()))
		os.Exit(1)
	}

	// Get available route types
	routeTypes, err := getRouteTypes(db)
	if err != nil {
		fmt.Println(errorStyle.Render("Failed to query route types: " + err.Error()))
		os.Exit(1)
	}

	// Parse dates
	minTime, err := time.Parse("20060102", minDate)
	if err != nil {
		fmt.Println(errorStyle.Render("Failed to parse min date: " + err.Error()))
		os.Exit(1)
	}
	maxTime, err := time.Parse("20060102", maxDate)
	if err != nil {
		fmt.Println(errorStyle.Render("Failed to parse max date: " + err.Error()))
		os.Exit(1)
	}

	// Calculate days of data
	today := time.Now().Truncate(24 * time.Hour)
	daysFromNow := int(maxTime.Sub(today).Hours() / 24)
	totalDays := int(maxTime.Sub(minTime).Hours()/24) + 1

	// Format dates for display
	minDateFmt := minTime.Format("Mon, 02 Jan 2006")
	maxDateFmt := maxTime.Format("Mon, 02 Jan 2006")

	// Build status info
	var content string
	content += labelStyle.Render("Database:") + valueStyle.Render(cfg.DatabasePath) + "\n"
	content += labelStyle.Render("First trip date:") + valueStyle.Render(minDateFmt) + "\n"
	content += labelStyle.Render("Last trip date:") + valueStyle.Render(maxDateFmt) + "\n"
	content += labelStyle.Render("Total days:") + valueStyle.Render(fmt.Sprintf("%d days", totalDays)) + "\n"
	content += labelStyle.Render("Days remaining:") + valueStyle.Render(fmt.Sprintf("%d days", daysFromNow)) + "\n"
	content += "\n"
	content += labelStyle.Render("Transport modes:")
	for _, rt := range routeTypes {
		content += "\n  • " + valueStyle.Render(getRouteTypeName(rt))
	}

	fmt.Println(boxStyle.Render(content))

	// Warning if less than 2 weeks of data remaining
	if daysFromNow < 14 {
		fmt.Println()
		if daysFromNow < 0 {
			fmt.Println(errorStyle.Render("⚠ WARNING: All trip data has expired!"))
			fmt.Println(infoStyle.Render("  Run 'gtfs-manager download' and 'gtfs-manager import' to update the database."))
		} else if daysFromNow < 7 {
			fmt.Println(errorStyle.Render(fmt.Sprintf("⚠ WARNING: Only %d days of trip data remaining!", daysFromNow)))
			fmt.Println(infoStyle.Render("  Run 'gtfs-manager download' and 'gtfs-manager import' to update the database."))
		} else {
			fmt.Println(warningStyle.Render(fmt.Sprintf("⚠ WARNING: Less than 2 weeks of trip data remaining (%d days).", daysFromNow)))
			fmt.Println(infoStyle.Render("  Consider updating the database soon."))
		}
	} else {
		fmt.Println()
		fmt.Println(successStyle.Render(fmt.Sprintf("✓ Database has %d days of trip data remaining.", daysFromNow)))
	}
}

// getRouteTypes returns the distinct route types present in the database
func getRouteTypes(db *sql.DB) ([]int, error) {
	query := `SELECT DISTINCT route_type FROM routes ORDER BY route_type`

	rows, err := db.Query(query)
	if err != nil {
		return nil, fmt.Errorf("query failed: %w", err)
	}
	defer rows.Close()

	var types []int
	for rows.Next() {
		var routeType int
		if err := rows.Scan(&routeType); err != nil {
			return nil, fmt.Errorf("scan failed: %w", err)
		}
		types = append(types, routeType)
	}

	return types, rows.Err()
}

// getRouteTypeName returns the human-readable name for a route type
func getRouteTypeName(routeType int) string {
	if name, ok := routeTypeNames[routeType]; ok {
		return name
	}
	return fmt.Sprintf("Unknown (%d)", routeType)
}

// getTripDateRange returns the minimum and maximum service dates from the database
func getTripDateRange(db *sql.DB) (string, string, error) {
	// Get date range from calendar table (regular service patterns)
	// and calendar_dates table (service exceptions)
	query := `
		SELECT
			MIN(min_date) as min_date,
			MAX(max_date) as max_date
		FROM (
			SELECT MIN(start_date) as min_date, MAX(end_date) as max_date FROM calendar
			UNION ALL
			SELECT MIN(date) as min_date, MAX(date) as max_date FROM calendar_dates
		)
	`

	var minDate, maxDate sql.NullString
	err := db.QueryRow(query).Scan(&minDate, &maxDate)
	if err != nil {
		return "", "", fmt.Errorf("query failed: %w", err)
	}

	if !minDate.Valid || !maxDate.Valid {
		return "", "", fmt.Errorf("no service dates found in database")
	}

	return minDate.String, maxDate.String, nil
}
