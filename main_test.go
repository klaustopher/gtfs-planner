package main

import (
	"os"
	"testing"
)

// sampleDBPath is the committed sample GTFS database used by the tests that
// exercise database-backed App methods.
const sampleDBPath = "internal/db/testdata/test.sqlite"

// TestMain points the App at the sample database (via the GTFS_DATABASE_PATH
// override) so app.ServiceStartup() opens it instead of the production database.
func TestMain(m *testing.M) {
	os.Setenv("GTFS_DATABASE_PATH", sampleDBPath)
	os.Exit(m.Run())
}
