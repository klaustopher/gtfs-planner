# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

GTFS Planner is a desktop application for visualizing GTFS (General Transit Feed Specification) public transit data and planning multi-leg journeys. Users can browse stations on an interactive map, view upcoming departures, and plan trips by "boarding" successive transit legs.

## Technology Stack

- **Backend:** Go 1.23 with Wails v2.11.0 (desktop framework)
- **Frontend:** React 18.2 + TypeScript + Vite
- **Map:** MapLibre GL 5.15.0 with react-map-gl
- **Database:** SQLite (read-only mode)

## Common Commands

```bash
# Development
wails dev                    # Start dev server with hot reload

# Building
wails build                  # Build production executable

# Testing
go test ./...                # Run all Go tests
go test -v ./internal/db/    # Run database tests with verbose output

# Real-feed smoke test for the importer (downloads not required, uses a local zip)
GTFS_SMOKE_ZIP=/path/to/feed.zip go test -run TestRealFeedSmoke -timeout 30m -v ./internal/gtfsimport/

# Frontend only
cd frontend && npm run dev   # Run Vite dev server standalone
cd frontend && npm run build # Build frontend assets

# Generate Wails bindings (after changing Go methods)
wails generate module
```

GTFS data management (download + import) happens **inside the app**: when the
database is missing or expired the setup dialog offers download-from-URL,
import, and "open local zip" (for feeds like DELFI/opendata-ÖPNV that require
registration). The database can be inspected and deleted under Settings.

## Architecture Overview

### Backend (Go)

**Entry Points:**

- `main.go` - Wails app initialization
- `app.go` - Main `App` struct with Wails-bound methods

**Key Packages:**

- `internal/db/` - All database queries (~800 lines, read-only)
- `internal/gtfsimport/` - Native Go GTFS importer + downloader (replaces `npx gtfs-import`)
- `internal/paths/` - Platform-specific data directory for the database
- `internal/models/` - Data structures with JSON tags
- `internal/timeutil/` - GTFS time normalization utilities

**GTFS importer (`internal/gtfsimport/`):**

- `schema.go` - Lean SQLite schema (the 6 tables db.go reads) + indexes
- `importer.go` - Streams the GTFS zip and builds the database atomically
- `normalize.go` - Maps the DELFI/IFOPT station hierarchy onto the gtfs.de model
- `download.go` - HTTP feed download with progress callback
- `progress.go` / `csvutil.go` - Progress events and name-based CSV mapping

**Wails Bindings (`app.go`):**

```go
// Read queries
GetStops(n, s, e, w float64)               // Stations in bounding box
GetStationDetails(stopID string)           // Station info + routes
GetRoutesForStation(stopID string)         // Route geometries
SearchStations(query string, limit int)    // Station search
GetUpcomingTripsForStations(ids, dt, ...)  // Upcoming departures
GetTripDetails(tripID, serviceDate)        // Full trip itinerary

// Data management
GetDatabaseStatus()                        // Missing / expired / ok + date range
DownloadGTFS(url string)                   // Download feed (emits gtfs:download:*)
ImportGTFS()                               // Import downloaded feed (emits gtfs:import:*)
ImportGTFSFromFile()                       // Pick + import a local zip
GetDatabaseInfo() / DeleteDatabase()       // Settings: path/size, delete
```

### Frontend (React + TypeScript)

**Main Components:**

- `App.tsx` - State management, journey planning logic
- `components/Map.tsx` - MapLibre map with search, station selection
- `components/TripDetailModal.tsx` - Trip itinerary viewer
- `components/Sidebar.tsx` - Journey planning panel, departures list

**Custom Hooks (`components/map/`):**

- `useStops.ts` - Fetches stations in viewport (debounced)
- `useTrips.ts` - Fetches upcoming trips for selected station
- `useRoutes.ts` - Fetches route geometries

**Wails JS Bindings:** Auto-generated at `frontend/wailsjs/go/main/App.ts`

## Data Flow

```
User clicks station → GetStationDetails → GetUpcomingTrips
                                        ↓
              User views trips in sidebar ← tripsData state
                                        ↓
              User clicks trip → GetTripDetails → TripDetailModal
                                        ↓
              User clicks "board" → savedTrips updated
                                        ↓
              App advances time +5min → new GetUpcomingTrips from arrival station
```

## GTFS Specifics

### Time Handling

GTFS allows times >= 24:00:00 for overnight trips (e.g., 25:30:00 = next day 01:30:00). The `internal/timeutil` package normalizes these to ISO 8601 format.

**Key function:** `timeutil.NormalizeGTFSTime(gtfsTime, serviceDate)` converts "25:30:00" + "20240115" → "2024-01-16T01:30:00"

### Service Calendar Logic

When querying trips, the code checks:

1. `calendar` table - weekday flags (monday, tuesday, etc.)
2. `calendar_dates` table - exceptions (type 1=add service, 2=remove service)
3. Date range validity (start_date, end_date)

**Implementation:** See `internal/db/db.go:150-350` for the complex calendar filtering logic.

### Database Tables Used

- `stops` - location_type=1 for parent stations
- `routes` - route_color, route_type
- `trips` - trip_id, service_id, trip_headsign
- `stop_times` - arrival_time, departure_time, stop_sequence
- `calendar` - monday-sunday flags, date range
- `calendar_dates` - service exceptions

## Data Storage

There is no config file. The database and downloaded feed live in a
platform-specific data directory resolved by `internal/paths`:

- Linux: `$XDG_DATA_HOME/gtfs-planner` (or `~/.local/share/gtfs-planner`)
- macOS: `~/Library/Application Support/gtfs-planner`
- Windows: `%LocalAppData%\gtfs-planner` (not Roaming — the DB is multiple GB)

Files: `gtfs.sqlite` (the built database) and `feed.zip` (transient, between
download and import). `GTFS_PLANNING_DATA_DIR` overrides the directory and
`GTFS_DATABASE_PATH` overrides just the database path (handy for development).

## Importer notes

- The importer ships its own lean schema (see `internal/gtfsimport/schema.go`),
  not the comprehensive npm schema. `internal/db/testdata/schema.sql` is kept
  only as a reference of the old npm output.
- Both German feeds are supported: gtfs.de (downloadable) and DELFI/opendata-ÖPNV
  (registration-gated, imported via "open local zip"). DELFI's IFOPT station
  hierarchy is normalized onto the gtfs.de model in `normalize.go`.
- The importer has no CHECK constraints and skips malformed rows, so it imports
  feeds the npm tool aborts on.

## Key Implementation Details

### Parent/Child Stops

GTFS has parent stations (location_type=1) and child platforms. The code normalizes to parent stations:

```go
// internal/db/db.go - getParentStationID()
SELECT COALESCE(parent_station, stop_id) FROM stops WHERE stop_id = ?
```

### Route Visualization

Routes are styled with different colors, line widths, and dash patterns to distinguish overlapping routes. See `frontend/src/components/map/geojson.ts:getTripColor()` and style variants.

### Trip Filtering

Trips are excluded when the selected station is the final destination (no onward journey possible). See `internal/db/db.go:280-320`.

## Testing

The database module has comprehensive tests covering:

- Bounding box queries
- Overnight trip handling (times >= 24:00)
- Calendar-based service filtering
- Calendar date exceptions
- Trip exclusion rules

Run with: `go test -v ./internal/db/`

## UI Notes

- German text in UI (Stadt suchen, Datum, Uhrzeit, etc.)
- Stations appear at zoom level >= 8
- Search has keyboard navigation (arrow keys, Enter, Escape)
- Hover panel shows trip destinations with 300ms hide delay

## Common Modifications

**Adding a new Wails binding:**

1. Add method to `App` struct in `app.go`
2. Run `wails generate module`
3. Import from `wailsjs/go/main/App` in frontend

**Adding new data to trips:**

1. Update `models.go` struct
2. Update SQL query in `db.go`
3. Update TypeScript types in frontend

**Changing map styling:**

- Station markers: `Map.tsx` Source/Layer definitions
- Route lines: `geojson.ts` style variants
- Colors: `geojson.ts` FALLBACK_COLORS

## Code Style Guidelines

### CSS Styling Rules

**CRITICAL: Color Definitions**

- **ALL color definitions MUST be in `frontend/src/variables.css` ONLY**
- **NEVER use hardcoded colors** (e.g., `#ffffff`, `rgba(0,0,0,0.5)`) in any other CSS file
- Always use CSS custom properties: `var(--color-name)`
- This includes:
  - Colors in `color`, `background-color`, `border-color`
  - Colors in `box-shadow`, `text-shadow`
  - Colors in gradients
  - Any `rgba()`, `rgb()`, `#hex` values

**Example - WRONG:**

```css
.button {
  background: #3b82f6;
  box-shadow: 0 0 0 2px rgba(0, 0, 0, 0.1);
}
```

**Example - CORRECT:**

```css
.button {
  background: var(--color-accent-primary);
  box-shadow: var(--shadow-button);
}
```

**Adding new colors:**

1. Add to `frontend/src/variables.css` with semantic name
2. Use the new variable in component CSS files
