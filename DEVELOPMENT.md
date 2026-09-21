# Development Guide

This document provides technical information for developers working on GTFS Planner.

## Technology Stack

- **Backend:** Go 1.25 with [Wails](https://wails.io/) v2.16.0 (desktop framework)
- **Frontend:** React 19 + TypeScript 7 + Vite 8
- **Map:** MapLibre GL 6.10 with react-map-gl 8.1
- **Database:** SQLite (read-only mode)
- **Build:** Vite + npm
- **Frontend tooling:** oxlint (lint) + Vitest (tests)

## Project Structure

```
gtfs-planner/
├── main.go                 # Wails app entry point
├── app.go                  # Core App struct with Wails bindings
├── internal/
│   ├── db/                 # Database operations (read-only)
│   │   ├── db.go           # GTFS queries (~800 lines)
│   │   └── *_test.go       # Database + midnight boundary tests
│   ├── gtfsimport/         # Native Go GTFS importer + downloader
│   │   ├── schema.go       # Lean SQLite schema + indexes
│   │   ├── importer.go     # Streaming zip → SQLite import
│   │   ├── normalize.go    # DELFI/IFOPT station normalization
│   │   ├── download.go     # HTTP feed download
│   │   └── *_test.go       # Importer tests
│   ├── geolocation/        # Per-platform user location lookup (cgo on macOS)
│   ├── paths/              # Platform-specific data directory
│   ├── models/             # Data structures
│   │   └── models.go       # Go structs (JSON-serializable)
│   ├── textfold/           # Case/accent folding for station search (ö→o, ß→ss)
│   └── timeutil/           # GTFS time utilities
│       ├── timeutil.go     # Time normalization
│       └── timeutil_test.go
├── frontend/
│   ├── src/
│   │   ├── App.tsx         # Main app component
│   │   ├── components/
│   │   │   ├── Map.tsx              # MapLibre map component
│   │   │   ├── TripDetailModal.tsx  # Trip details view
│   │   │   ├── Sidebar.tsx          # Journey planner UI
│   │   │   └── map/                 # Map layers, panels & hooks
│   │   ├── hooks/          # Journey view, settings, default map location
│   │   ├── utils/          # Pure helpers + co-located *.test.ts
│   │   ├── locales/        # de/en i18next translations
│   │   └── test/setup.ts   # Vitest setup (jsdom + jest-dom matchers)
│   ├── .oxlintrc.json      # Lint rules
│   ├── vite.config.ts      # Vite + Vitest configuration
│   ├── package.json
│   └── wailsjs/            # Auto-generated Wails bindings
└── build/                  # Build configuration
```

The GTFS database and downloaded feed are stored outside the repo in a
platform-specific data directory (see `internal/paths`); there is no config file.

## Common Commands

```bash
# Development
wails dev                    # Start dev server with hot reload

# Building
wails build                  # Build production executable

# Testing
go test ./...                # Run all Go tests
go test -v ./internal/db/    # Run database tests with verbose output

# Real-feed importer smoke test (uses a local GTFS zip, no network)
GTFS_SMOKE_ZIP=/path/to/feed.zip go test -run TestRealFeedSmoke -timeout 30m -v ./internal/gtfsimport/

# Frontend only (from frontend/)
npm run dev                  # Run Vite dev server standalone
npm run build                # Typecheck (tsc) + build frontend assets
npm run lint                 # oxlint
npm test                     # Vitest, single run
npm run test:watch           # Vitest in watch mode

# Generate Wails bindings (after changing Go methods)
wails generate module
```

GTFS data management (download/import/delete) is done in-app via the setup
dialog and settings — there is no longer a separate CLI.

## Releasing

Versioning and the changelog are managed with [knope](https://knope.tech)
(`brew install knope-dev/tap/knope`). The single source of truth for the
version is the set of versioned files (`frontend/package.json` and
`wails.json`'s `info.productVersion`); they must always agree.

1. **Describe each change** as you work — for anything user-facing, run:

   ```bash
   knope document-change   # pick patch/minor/major, write a summary
   ```

   This drops a markdown changeset in `.changeset/`. Commit it with your code.

2. **Cut a release** when ready:

   ```bash
   knope release           # run locally
   ```

   This consumes the pending changesets, bumps the versioned files, prepends
   the entry to `CHANGELOG.md`, commits, and creates + pushes the `vX.Y.Z` tag.

3. The pushed tag triggers `.github/workflows/release.yml`, which builds all
   platform artifacts (macOS, Windows, Linux amd64/arm64) and attaches them to
   a **draft** GitHub release. Nothing is public at this point.

4. **Publish the draft — this step is manual, and nothing downstream happens
   until you do it:**

   ```bash
   gh release edit vX.Y.Z --draft=false --latest
   ```

   (or click "Publish release" on the releases page). This fires the
   `release: published` event that `update-cask.yml` waits for; that workflow
   then downloads the macOS `.dmg`, rewrites the version + sha256 in
   `Casks/gtfs-planner.rb` and pushes the commit to `main`.

   It is deliberately not automated, for two reasons: a draft's asset URLs are
   not publicly reachable, so the sha256 cannot be computed before publishing;
   and a release published by the default `GITHUB_TOKEN` would not trigger
   `update-cask.yml` at all — the same token restriction described below.
   Publishing as yourself, via the UI or `gh`, does trigger it.

5. **Confirm the cask actually moved** — the release is easy to leave sitting as
   a draft, in which case Homebrew users silently keep getting the old version:

   ```bash
   gh release list                           # vX.Y.Z should say "Latest", not "Draft"
   gh run list --workflow=update-cask.yml    # expect a run with event `release`
   git pull && grep -E '^  (version|sha256)' Casks/gtfs-planner.rb
   ```

   If that run failed or never happened, `update-cask.yml` also accepts a
   manual `workflow_dispatch` with the tag as input.

Run `knope release` **locally** (not from CI): pushing the tag as yourself is
what triggers `release.yml`, whereas a tag pushed by the default `GITHUB_TOKEN`
would not. knope is configured without a `[github]` section on purpose, so it
only creates the tag — `release.yml` owns the GitHub release.

## Architecture Overview

### Backend (Go)

**Entry Points:**

- `main.go` - Wails app initialization
- `app.go` - Main `App` struct with Wails-bound methods

**Key Packages:**

- `internal/db/` - All database queries (~800 lines, read-only)
- `internal/gtfsimport/` - Native Go GTFS importer + downloader (replaces `npx gtfs-import`)
- `internal/paths/` - Platform-specific data directory
- `internal/models/` - Data structures with JSON tags
- `internal/timeutil/` - GTFS time normalization utilities

**GTFS importer (`internal/gtfsimport/`):**

- `schema.go` - Lean SQLite schema (the 6 tables db.go reads) + indexes
- `importer.go` - Streams the GTFS zip and builds the database atomically
- `normalize.go` - Maps the DELFI/IFOPT station hierarchy onto the gtfs.de model
- `download.go` - HTTP feed download with progress callback

**Wails Bindings (`app.go`):**

```go
// Read queries
GetStops(north, south, east, west float64)              // Stations in bounding box
GetStationDetails(stopID string)                        // Station info + routes
GetRoutesForStation(stopID string)                      // Route geometries
SearchStations(query string, limit int)                 // Station search
GetNearbyStations(stopID string, radiusMeters float64)  // Neighbouring stations
GetUpcomingTripsForStations(stopIDs []string, datetime string, limit int, routeTypes []int)
GetTripDetails(tripID, serviceDate string)              // Full trip itinerary
GetRouteByID(routeID string)                            // Single route
GetTransportCategories()                                // Categories present in the feed

// Data management (download/import emit gtfs:download:* / gtfs:import:* events)
GetDatabaseStatus() / CheckDatabaseExists()
DownloadGTFS(url string) / ImportGTFS() / ImportGTFSFromFile() / CancelGTFS()
GetDatabaseInfo() / DeleteDatabase()

// Journeys
SaveJourney(journey) / LoadJourney() / OpenJourneyFile(path) / GetPendingJourneyFile()
ExportJourneyToICS(journey) / ExportJourneyToPDF(journey)

// Misc
GetUserLocation() / GetAbsolutePath(relativePath string)
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

## API (Wails Bindings)

The Go backend exposes these methods to the frontend:

| Method | Description |
|--------|-------------|
| `GetStops(north, south, east, west)` | Get stations within bounding box |
| `GetStationDetails(stopID)` | Get station info + serving routes |
| `GetRoutesForStation(stopID)` | Get route geometries |
| `SearchStations(query, limit)` | Search stations by name (accent/case folded) |
| `GetNearbyStations(stopID, radiusMeters)` | Get stations around a station |
| `GetUpcomingTripsForStations(stopIDs, datetime, limit, routeTypes)` | Get upcoming departures across one or more stations |
| `GetTripDetails(tripID, serviceDate)` | Get full trip itinerary |
| `GetRouteByID(routeID)` | Get a single route |
| `GetTransportCategories()` | Transport categories present in the feed |
| `CheckDatabaseExists()` / `GetDatabaseStatus()` | Presence and validity window of the database |
| `DownloadGTFS(url)` / `ImportGTFS()` / `ImportGTFSFromFile()` / `CancelGTFS()` | Feed download and import |
| `GetDatabaseInfo()` / `DeleteDatabase()` | Database path/size, deletion |
| `SaveJourney(journey)` / `LoadJourney()` / `OpenJourneyFile(path)` | Journey persistence |
| `GetPendingJourneyFile()` | Journey file the app was opened with |
| `ExportJourneyToICS(journey)` / `ExportJourneyToPDF(journey)` | Journey export |
| `GetUserLocation()` | Platform geolocation lookup |
| `GetAbsolutePath(relativePath)` | Resolve a path for the frontend |

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

The database should contain standard GTFS tables:

- `stops` - location_type=1 for parent stations
- `routes` - route_color, route_type
- `trips` - trip_id, service_id, trip_headsign
- `stop_times` - arrival_time, departure_time, stop_sequence
- `calendar` - monday-sunday flags, date range
- `calendar_dates` - service exceptions

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

### Go

The database module has comprehensive tests covering:

- Bounding box queries
- Overnight trip handling (times >= 24:00)
- Calendar-based service filtering
- Calendar date exceptions
- Trip exclusion rules

`internal/gtfsimport`, `internal/paths` and `internal/timeutil` are covered too.

```bash
go test ./...           # All tests
go test -v ./...        # Verbose output
go test ./internal/db/  # Specific package
```

### Frontend

[Vitest](https://vitest.dev) with jsdom and Testing Library. Tests live next to
the code as `*.test.ts(x)` and are picked up from `src/**`; `src/test/setup.ts`
registers the jest-dom matchers and cleans up the DOM between tests.

```bash
cd frontend
npm test                # Single run
npm run test:watch      # Watch mode
```

Note there is no `@types/node` in the frontend, deliberately — it would pull Node
globals into a browser typecheck. Use `vi.stubEnv()` rather than `process.env`
when a test needs an environment variable (the timezone tests in
`src/utils/time.test.ts` do this).

CI runs `go test ./...` for the backend and lint + tests + build for the
frontend (see `.github/workflows/ci.yml`).

## UI Notes

- German text in UI (Stadt suchen, Datum, Uhrzeit, etc.)
- Stations appear at zoom level >= 8
- Search has keyboard navigation (arrow keys, Enter, Escape)
- Hover panel shows trip destinations with 300ms hide delay

## Common Modifications

### Adding a New Wails Binding

1. Add method to `App` struct in `app.go`
2. Run `wails generate module`
3. Import from `wailsjs/go/main/App` in frontend

### Adding New Data to Trips

1. Update `models.go` struct
2. Update SQL query in `db.go`
3. Update TypeScript types in frontend

### Changing Map Styling

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

## Configuration

Edit `wails.json` for build configuration. See [Wails documentation](https://wails.io/docs/reference/project-config) for options.

There is no GTFS config file. The database and downloaded feed live in a
platform-specific data directory resolved by `internal/paths`:

- Linux: `$XDG_DATA_HOME/gtfs-planner` (or `~/.local/share/gtfs-planner`)
- macOS: `~/Library/Application Support/gtfs-planner`
- Windows: `%LocalAppData%\gtfs-planner`

`GTFS_PLANNING_DATA_DIR` overrides the directory; `GTFS_DATABASE_PATH` overrides
just the database path (handy for pointing the app at a sample database during
development).
