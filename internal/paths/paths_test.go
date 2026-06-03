package paths

import (
	"path/filepath"
	"testing"
)

func TestDataDirHonorsOverride(t *testing.T) {
	override := t.TempDir()
	t.Setenv("BUS_PLANNING_DATA_DIR", override)

	dir, err := DataDir()
	if err != nil {
		t.Fatalf("DataDir() error: %v", err)
	}
	if dir != override {
		t.Fatalf("DataDir() = %q, want %q", dir, override)
	}
}

func TestDatabaseAndFeedPaths(t *testing.T) {
	override := t.TempDir()
	t.Setenv("BUS_PLANNING_DATA_DIR", override)

	dbPath, err := DatabasePath()
	if err != nil {
		t.Fatalf("DatabasePath() error: %v", err)
	}
	if want := filepath.Join(override, dbFile); dbPath != want {
		t.Fatalf("DatabasePath() = %q, want %q", dbPath, want)
	}

	feedPath, err := FeedPath()
	if err != nil {
		t.Fatalf("FeedPath() error: %v", err)
	}
	if want := filepath.Join(override, feedFile); feedPath != want {
		t.Fatalf("FeedPath() = %q, want %q", feedPath, want)
	}
}

func TestDataDirCreatesDirectory(t *testing.T) {
	parent := t.TempDir()
	target := filepath.Join(parent, "nested", "data")
	t.Setenv("BUS_PLANNING_DATA_DIR", target)

	dir, err := DataDir()
	if err != nil {
		t.Fatalf("DataDir() error: %v", err)
	}
	if dir != target {
		t.Fatalf("DataDir() = %q, want %q", dir, target)
	}
}
