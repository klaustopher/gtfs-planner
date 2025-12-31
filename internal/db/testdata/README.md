# Test Database

This directory contains a dedicated SQLite database for running tests. Using a separate test database ensures tests are not dependent on real-world GTFS data that may expire or change.

## Files

- `schema.sql` - Full GTFS database schema (exported from the production database)
- `testdata.sql` - Test data for all test cases
- `test.sqlite` - The SQLite database (generated from the SQL files)

## Updating the Schema

The schema is exported from the production GTFS database. To update it after importing new GTFS data:

```bash
sqlite3 gtfs-data/sqlite/gtfs.sqlite ".schema" > internal/db/testdata/schema.sql
```

Then rebuild the test database (see below).

## Rebuilding the Test Database

If you modify the schema or test data SQL files, rebuild the database:

```bash
rm -f internal/db/testdata/test.sqlite
sqlite3 internal/db/testdata/test.sqlite < internal/db/testdata/schema.sql
sqlite3 internal/db/testdata/test.sqlite < internal/db/testdata/testdata.sql
```

Or as a one-liner from the project root:

```bash
rm -f internal/db/testdata/test.sqlite && \
sqlite3 internal/db/testdata/test.sqlite < internal/db/testdata/schema.sql && \
sqlite3 internal/db/testdata/test.sqlite < internal/db/testdata/testdata.sql
```

## Adding New Test Data

### 1. Understand the GTFS Data Model

Key tables for testing:

| Table | Purpose |
|-------|---------|
| `stops` | Stations and platforms. `location_type=1` is a parent station |
| `routes` | Transit routes with color and type |
| `trips` | Individual trips linking routes to services |
| `stop_times` | When trips stop at each station |
| `calendar` | Weekly service schedules (which days a service runs) |
| `calendar_dates` | Exceptions to the calendar (add/remove service on specific dates) |
| `shapes` | Route geometry for map display |

### 2. Adding a New Station

```sql
INSERT INTO stops (stop_id, stop_name, stop_lat, stop_lon, location_type, parent_station) VALUES
    ('my_station', 'My Test Station', 50.123, 8.456, 1, NULL);
```

- `location_type=1` means it's a parent station (required for station queries)
- `parent_station=NULL` for parent stations, or set to parent ID for platforms

### 3. Adding a New Route

```sql
INSERT INTO routes (route_id, route_short_name, route_long_name, route_type, route_color) VALUES
    ('route_test', 'T1', 'Test Line 1', 3, '00FF00');
```

Route types: 0=tram, 1=subway, 2=rail, 3=bus, etc.

### 4. Adding a New Service Schedule

For a weekday-only service:

```sql
INSERT INTO calendar (service_id, monday, tuesday, wednesday, thursday, friday, saturday, sunday, start_date, end_date) VALUES
    ('service_weekday', 1, 1, 1, 1, 1, 0, 0, '20250101', '20261231');
```

### 5. Adding Calendar Exceptions

To **remove** service on a specific date (exception_type=2):

```sql
INSERT INTO calendar_dates (service_id, date, exception_type) VALUES
    ('service_weekday', '20251225', 2);  -- No service on Christmas
```

To **add** service on a specific date (exception_type=1):

```sql
INSERT INTO calendar_dates (service_id, date, exception_type) VALUES
    ('service_weekday', '20251226', 1);  -- Extra service on Dec 26
```

### 6. Adding a New Trip with Stop Times

```sql
-- Create the trip
INSERT INTO trips (trip_id, route_id, service_id, trip_headsign, direction_id) VALUES
    ('trip_test', 'route_test', 'service_weekday', 'Final Destination', 0);

-- Add stop times (station A -> station B)
INSERT INTO stop_times (trip_id, arrival_time, departure_time, stop_id, stop_sequence) VALUES
    ('trip_test', '08:00:00', '08:02:00', 'station_a', 0),
    ('trip_test', '08:15:00', '08:15:00', 'station_b', 1);
```

### 7. Overnight Trips (Times >= 24:00:00)

GTFS allows times past midnight to be expressed as 24:00:00+ for trips that continue from the previous service day:

```sql
-- A trip that departs at 00:30 (expressed as 24:30 on the previous day's service)
INSERT INTO stop_times (trip_id, arrival_time, departure_time, stop_id, stop_sequence) VALUES
    ('trip_overnight', '24:25:00', '24:30:00', 'my_station', 0),
    ('trip_overnight', '25:00:00', '25:00:00', 'end_station', 1);
```

## Test Case Reference

| Test | Station ID | Trip ID | Service ID | Key Feature |
|------|------------|---------|------------|-------------|
| `TestCalendarWeekdayFiltering` | 610626 | 1036941 | 191 | Mon-Fri only |
| `TestCalendarDateExclusion` | 32830 | 154627 | 101 | Exception removes service on 2025-12-26 |
| `TestCalendarDateAddition` | 278696 | 991667 | 1030 | Exception adds service on 2026-01-05 |
| `TestOvernightTrips` | 494889 | 1214020 | 940 | Departure at 24:05:00 |
| `TestExcludeTripsEndingAtStation` | 419232 | 1014198/1493872 | 191 | Trip ending vs starting at station |

## Verifying Test Data

Check the database contents:

```bash
sqlite3 internal/db/testdata/test.sqlite "SELECT * FROM stops;"
sqlite3 internal/db/testdata/test.sqlite "SELECT * FROM calendar;"
sqlite3 internal/db/testdata/test.sqlite "SELECT * FROM calendar_dates;"
```

Run the tests:

```bash
go test -v ./internal/db/
```
