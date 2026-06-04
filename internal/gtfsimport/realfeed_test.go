package gtfsimport

import (
	"context"
	"database/sql"
	"fmt"
	"os"
	"path/filepath"
	"testing"
	"time"

	_ "github.com/mattn/go-sqlite3"
)

// TestRealFeedSmoke imports a real GTFS feed and prints plausibility stats.
// It is skipped unless GTFS_SMOKE_ZIP points at a feed zip, e.g.:
//
//	GTFS_SMOKE_ZIP=~/Downloads/opendata-oepnv-de-feed.zip \
//	  go test -run TestRealFeedSmoke -timeout 30m -v ./internal/gtfsimport/
func TestRealFeedSmoke(t *testing.T) {
	zipPath := os.Getenv("GTFS_SMOKE_ZIP")
	if zipPath == "" {
		t.Skip("set GTFS_SMOKE_ZIP to run the real-feed smoke test")
	}

	dbPath := filepath.Join(t.TempDir(), "smoke.sqlite")
	start := time.Now()
	if err := New(nil).Import(context.Background(), zipPath, dbPath); err != nil {
		t.Fatalf("import: %v", err)
	}
	t.Logf("imported %s in %s", filepath.Base(zipPath), time.Since(start).Round(time.Second))

	conn, err := sql.Open("sqlite3", "file:"+dbPath+"?mode=ro")
	if err != nil {
		t.Fatalf("open: %v", err)
	}
	defer conn.Close()

	for _, table := range []string{"stops", "routes", "trips", "stop_times", "calendar", "calendar_dates"} {
		var n int64
		if err := conn.QueryRow("SELECT COUNT(*) FROM " + table).Scan(&n); err != nil {
			t.Fatalf("count %s: %v", table, err)
		}
		t.Logf("%-15s %d rows", table, n)
		if table == "stops" || table == "stop_times" {
			if n == 0 {
				t.Errorf("%s is empty", table)
			}
		}
	}

	var pins int64
	if err := conn.QueryRow("SELECT COUNT(*) FROM stops WHERE location_type = 1").Scan(&pins); err != nil {
		t.Fatalf("count pins: %v", err)
	}
	t.Logf("map pins (location_type=1): %d", pins)
	if pins < 1000 {
		t.Errorf("only %d map pins — normalization likely wrong", pins)
	}

	if fi, err := os.Stat(dbPath); err == nil {
		t.Logf("database size: %.1f MB", float64(fi.Size())/(1024*1024))
	}

	// DELFI-specific: Frankfurt Hbf grouped as one station with platform children.
	var hbfType sql.NullInt64
	conn.QueryRow(`SELECT location_type FROM stops WHERE stop_id='de:06412:10'`).Scan(&hbfType)
	if hbfType.Valid {
		var platforms int64
		conn.QueryRow(`SELECT COUNT(*) FROM stops WHERE parent_station='de:06412:10' AND platform_code IS NOT NULL AND platform_code != ''`).Scan(&platforms)
		t.Logf("Frankfurt Hbf (de:06412:10): location_type=%d, %d platforms with Gleis numbers", hbfType.Int64, platforms)
		if hbfType.Int64 != 1 {
			t.Errorf("Frankfurt Hbf should be a location_type=1 station")
		}
	}

	fmt.Println() // separate consecutive runs in -v output
}
