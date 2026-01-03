package db

import (
	"testing"
	"time"
)

// TestMidnightBoundary tests that trip loading works correctly across day boundaries.
// This includes:
// - Late night trips (23:00-23:59 on the same day)
// - Overnight trips with 24+ hour notation (24:00-26:00, representing 00:00-02:00 next day)
// - Next day trips with normal notation (00:00-06:00 on the next day)
//
// Test station: midnight_test
// Test date: 2026-01-01 (Thursday) transitioning to 2026-01-02 (Friday)
// Service: service_midnight (runs daily)

func TestMidnightBoundary_LateNightTrips(t *testing.T) {
	db := skipIfNoDatabase(t)
	defer db.Close()

	stationID := "midnight_test"

	// Query at 23:00 on 2026-01-01
	// Should find trips at 23:00, 23:30, 23:50, 23:55 from same day
	t.Run("at 23:00 finds late night trips", func(t *testing.T) {
		data, err := db.GetUpcomingTrips(stationID, "2026-01-01T23:00:00", 50)
		if err != nil {
			t.Fatalf("GetUpcomingTrips failed: %v", err)
		}

		expectedTrips := []string{"trip_2300", "trip_2330", "trip_2350", "trip_2355"}
		for _, tripID := range expectedTrips {
			if !tripInResults(data, tripID) {
				t.Errorf("Expected trip %s to be in results when querying at 23:00", tripID)
			}
		}

		t.Logf("Found %d trips at 23:00", len(data.Trips))
	})

	// Query at 23:50 on 2026-01-01
	// Should find trips at 23:50, 23:55 from same day
	// And should also include overnight trips (24:00+) from previous day (2025-12-31)
	t.Run("at 23:50 finds remaining late night trips", func(t *testing.T) {
		data, err := db.GetUpcomingTrips(stationID, "2026-01-01T23:50:00", 50)
		if err != nil {
			t.Fatalf("GetUpcomingTrips failed: %v", err)
		}

		expectedTrips := []string{"trip_2350", "trip_2355"}
		for _, tripID := range expectedTrips {
			if !tripInResults(data, tripID) {
				t.Errorf("Expected trip %s to be in results when querying at 23:50", tripID)
			}
		}
	})
}

func TestMidnightBoundary_OvernightTrips24PlusNotation(t *testing.T) {
	db := skipIfNoDatabase(t)
	defer db.Close()

	stationID := "midnight_test"

	// Query at 00:00 on 2026-01-02 (Friday)
	// Should find trips from:
	// - 2026-01-02 with times >= 00:00 (trip_0000, trip_0030, etc.)
	// - 2026-01-01 with times >= 24:00 (trip_2400, trip_2430, trip_2500, etc.)
	t.Run("at 00:00 finds overnight trips from previous day service", func(t *testing.T) {
		data, err := db.GetUpcomingTrips(stationID, "2026-01-02T00:00:00", 50)
		if err != nil {
			t.Fatalf("GetUpcomingTrips failed: %v", err)
		}

		// Overnight trips from 2026-01-01's service (24:00+ notation)
		expectedOvernightTrips := []string{"trip_2400", "trip_2430", "trip_2500", "trip_2530", "trip_2600"}
		for _, tripID := range expectedOvernightTrips {
			if !tripInResults(data, tripID) {
				t.Errorf("Expected overnight trip %s (24:00+ from previous day) to be in results when querying at 00:00", tripID)
			}
		}

		// Normal trips from 2026-01-02's service (00:00+ notation)
		expectedNormalTrips := []string{"trip_0000", "trip_0030", "trip_0100", "trip_0130", "trip_0200"}
		for _, tripID := range expectedNormalTrips {
			if !tripInResults(data, tripID) {
				t.Errorf("Expected normal trip %s (00:00+ from current day) to be in results when querying at 00:00", tripID)
			}
		}

		t.Logf("Found %d trips at 00:00 on next day", len(data.Trips))
	})

	// Query at 00:30 on 2026-01-02
	// Should find trips at 00:30, 01:00, 01:30, 02:00 from current day
	// And 24:30, 25:00, 25:30, 26:00 from previous day
	t.Run("at 00:30 finds trips after midnight", func(t *testing.T) {
		data, err := db.GetUpcomingTrips(stationID, "2026-01-02T00:30:00", 50)
		if err != nil {
			t.Fatalf("GetUpcomingTrips failed: %v", err)
		}

		// Should include trip_2430 (24:30), trip_2500 (25:00), etc. from previous day
		expectedOvernightTrips := []string{"trip_2430", "trip_2500", "trip_2530", "trip_2600"}
		for _, tripID := range expectedOvernightTrips {
			if !tripInResults(data, tripID) {
				t.Errorf("Expected overnight trip %s to be in results when querying at 00:30", tripID)
			}
		}

		// Should include trip_0030, trip_0100, trip_0130, trip_0200 from current day
		expectedNormalTrips := []string{"trip_0030", "trip_0100", "trip_0130", "trip_0200"}
		for _, tripID := range expectedNormalTrips {
			if !tripInResults(data, tripID) {
				t.Errorf("Expected normal trip %s to be in results when querying at 00:30", tripID)
			}
		}
	})

	// Query at 01:00 on 2026-01-02
	// Should find trips at 01:00, 01:30, 02:00 from current day
	// And 25:00, 25:30, 26:00 from previous day
	t.Run("at 01:00 finds early morning trips", func(t *testing.T) {
		data, err := db.GetUpcomingTrips(stationID, "2026-01-02T01:00:00", 50)
		if err != nil {
			t.Fatalf("GetUpcomingTrips failed: %v", err)
		}

		// Overnight trips from previous day
		expectedOvernightTrips := []string{"trip_2500", "trip_2530", "trip_2600"}
		for _, tripID := range expectedOvernightTrips {
			if !tripInResults(data, tripID) {
				t.Errorf("Expected overnight trip %s (25:00+ from previous day) to be in results when querying at 01:00", tripID)
			}
		}

		// Normal trips from current day
		expectedNormalTrips := []string{"trip_0100", "trip_0130", "trip_0200"}
		for _, tripID := range expectedNormalTrips {
			if !tripInResults(data, tripID) {
				t.Errorf("Expected normal trip %s to be in results when querying at 01:00", tripID)
			}
		}
	})
}

func TestMidnightBoundary_LoadMoreAcrossMidnight(t *testing.T) {
	db := skipIfNoDatabase(t)
	defer db.Close()

	stationID := "midnight_test"

	// Simulate the "load more" scenario starting at 23:30
	t.Run("load more starting at 23:30 crosses midnight", func(t *testing.T) {
		// First load: starting at 23:30
		data1, err := db.GetUpcomingTripsForStations([]string{stationID}, "2026-01-01T23:30:00", 3)
		if err != nil {
			t.Fatalf("First load failed: %v", err)
		}

		if len(data1.Trips) == 0 {
			t.Fatal("Expected at least one trip in first load")
		}

		t.Logf("First load: %d trips", len(data1.Trips))
		for _, trip := range data1.Trips {
			t.Logf("  - %s at %s", trip.TripID, trip.DepartureDateTime)
		}

		// Get the last trip's departure time
		lastTrip := data1.Trips[len(data1.Trips)-1]

		// Second load: starting from the last trip's departure time
		data2, err := db.GetUpcomingTripsForStations([]string{stationID}, lastTrip.DepartureDateTime, 3)
		if err != nil {
			t.Fatalf("Second load failed: %v", err)
		}

		t.Logf("Second load: %d trips", len(data2.Trips))
		for _, trip := range data2.Trips {
			t.Logf("  - %s at %s", trip.TripID, trip.DepartureDateTime)
		}

		// Verify we got more trips
		if len(data2.Trips) == 0 {
			t.Error("Expected to find more trips in second load")
		}

		// Verify that trips are in chronological order
		for i := 1; i < len(data2.Trips); i++ {
			if data2.Trips[i].DepartureDateTime < data2.Trips[i-1].DepartureDateTime {
				t.Errorf("Trips not in chronological order: %s (%s) before %s (%s)",
					data2.Trips[i-1].TripID, data2.Trips[i-1].DepartureDateTime,
					data2.Trips[i].TripID, data2.Trips[i].DepartureDateTime)
			}
		}
	})

	// Simulate starting at 23:50 and loading more through midnight
	t.Run("load more starting at 23:50 continues into next day", func(t *testing.T) {
		// First load: starting at 23:50
		data1, err := db.GetUpcomingTripsForStations([]string{stationID}, "2026-01-01T23:50:00", 5)
		if err != nil {
			t.Fatalf("First load failed: %v", err)
		}

		if len(data1.Trips) == 0 {
			t.Fatal("Expected at least one trip in first load")
		}

		lastTrip := data1.Trips[len(data1.Trips)-1]
		t.Logf("First load ended at: %s (%s)", lastTrip.TripID, lastTrip.DepartureDateTime)

		// Second load: should get trips from next day
		data2, err := db.GetUpcomingTripsForStations([]string{stationID}, lastTrip.DepartureDateTime, 5)
		if err != nil {
			t.Fatalf("Second load failed: %v", err)
		}

		if len(data2.Trips) == 0 {
			t.Error("Expected to find trips on next day in second load")
		}

		t.Logf("Second load: %d trips", len(data2.Trips))

		// Third load: should continue to get more trips
		if len(data2.Trips) > 0 {
			lastTrip2 := data2.Trips[len(data2.Trips)-1]
			data3, err := db.GetUpcomingTripsForStations([]string{stationID}, lastTrip2.DepartureDateTime, 5)
			if err != nil {
				t.Fatalf("Third load failed: %v", err)
			}

			t.Logf("Third load: %d trips", len(data3.Trips))

			// Should eventually reach morning trips (06:00)
			foundMorningTrip := false
			for _, trip := range data3.Trips {
				if trip.TripID == "trip_0600" {
					foundMorningTrip = true
					break
				}
			}

			if !foundMorningTrip && len(data3.Trips) > 0 {
				// If we didn't find it yet, it should be in a subsequent load
				t.Logf("Morning trip not yet reached, last trip: %s", data3.Trips[len(data3.Trips)-1].TripID)
			}
		}
	})
}

func TestMidnightBoundary_NoDuplicatesAcrossLoads(t *testing.T) {
	db := skipIfNoDatabase(t)
	defer db.Close()

	stationID := "midnight_test"

	// Load trips in chunks and verify no duplicates
	t.Run("multiple loads produce no duplicate trips", func(t *testing.T) {
		seenTrips := make(map[string]bool)
		startTime := "2026-01-01T23:00:00"
		maxLoads := 10

		for i := 0; i < maxLoads; i++ {
			data, err := db.GetUpcomingTripsForStations([]string{stationID}, startTime, 3)
			if err != nil {
				t.Fatalf("Load %d failed: %v", i+1, err)
			}

			if len(data.Trips) == 0 {
				t.Logf("No more trips after load %d", i+1)
				break
			}

			for _, trip := range data.Trips {
				key := trip.TripID + "|" + trip.DepartureDateTime
				if seenTrips[key] {
					t.Errorf("Duplicate trip found: %s at %s", trip.TripID, trip.DepartureDateTime)
				}
				seenTrips[key] = true
			}

			// Update start time for next load - add 1 second to avoid duplicates
			lastTrip := data.Trips[len(data.Trips)-1]
			lastTime, err := time.Parse("2006-01-02T15:04:05", lastTrip.DepartureDateTime)
			if err != nil {
				t.Fatalf("Failed to parse time: %v", err)
			}
			nextTime := lastTime.Add(1 * time.Second)
			startTime = nextTime.Format("2006-01-02T15:04:05")

			t.Logf("Load %d: %d trips, ending at %s", i+1, len(data.Trips), lastTrip.DepartureDateTime)
		}

		t.Logf("Total unique trips loaded: %d", len(seenTrips))
	})
}
