package main

import (
	"os"
	"testing"
)

// sampleDBPath is the committed sample GTFS database used by the tests that
// exercise database-backed App methods.
const sampleDBPath = "internal/db/testdata/test.sqlite"

// TestMain points the App at the sample database (via the GTFS_DATABASE_PATH
// override) so app.startup() opens it instead of the production database
// configured in gtfs-config.yaml.
func TestMain(m *testing.M) {
	os.Setenv("GTFS_DATABASE_PATH", sampleDBPath)
	os.Exit(m.Run())
}
