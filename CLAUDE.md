# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Bus Planning is a desktop application for visualizing GTFS (General Transit Feed Specification) public transit data and planning multi-leg journeys. Users can browse stations on an interactive map, view upcoming departures, and plan trips by "boarding" successive transit legs.

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
go build -o build/bin/gtfs-manager ./cmd/gtfs-manager/  # Build GTFS manager CLI

# Testing
go test ./...                # Run all Go tests
go test -v ./internal/db/    # Run database tests with verbose output

# Frontend only
cd frontend && npm run dev   # Run Vite dev server standalone
cd frontend && npm run build # Build frontend assets

# Generate Wails bindings (after changing Go methods)
wails generate module

# GTFS Data Management
gtfs-manager status          # Check database status and data availability
gtfs-manager download        # Download GTFS feed from configured URL
gtfs-manager import          # Import GTFS feed into SQLite database
```

## Architecture Overview

### Backend (Go)

**Entry Points:**
- `main.go` - Wails app initialization
- `app.go` - Main `App` struct with Wails-bound methods
- `cmd/gtfs-manager/` - CLI tool for GTFS data management

**Key Packages:**
- `internal/db/` - All database queries (~800 lines)
- `internal/models/` - Data structures with JSON tags
- `internal/timeutil/` - GTFS time normalization utilities

**GTFS Manager CLI (`cmd/gtfs-manager/`):**
- `main.go` - Cobra CLI entry point and command registration
- `config.go` - YAML config file loader
- `status.go` - Database status check with date range display
- `download.go` - Feed download with Bubble Tea progress UI
- `import.go` - GTFS import via `npx gtfs-import`

**Wails Bindings (app.go:29-80):**
```go
GetStops(n, s, e, w float64)              // Stations in bounding box
GetStationDetails(stopID string)           // Station info + routes
GetRoutesForStation(stopID string)         // Route geometries
SearchStations(query string, limit int)    // Station search
GetUpcomingTrips(stopID, datetime, limit)  // Upcoming departures
GetTripDetails(tripID, serviceDate)        // Full trip itinerary
```

### Frontend (React + TypeScript)

**Main Components:**
- `App.tsx` - State management, journey planning logic
- `components/Map.tsx` - MapLibre map with search, station selection
- `components/TripDetailModal.tsx` - Trip itinerary viewer
- `components/DebugSidebar.tsx` - Departures list, journey plan display

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

## Data Structure

- `gtfs-data/feeds/` - Raw GTFS feed ZIP files (gitignored)
- `gtfs-data/sqlite/gtfs.sqlite` - Parsed SQLite database (gitignored)
- `gtfs-config.yaml` - GTFS manager configuration file

## GTFS Manager Configuration

The `gtfs-manager` CLI reads settings from `gtfs-config.yaml`:

```yaml
feed_url: "https://download.gtfs.de/germany/nv_free/latest.zip"
feed_path: "gtfs-data/feeds/latest.zip"
database_path: "gtfs-data/sqlite/gtfs.sqlite"
```

Use `--config` flag to specify an alternate config file location.

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
