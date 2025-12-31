# Bus Planning

A desktop application for visualizing and planning trips using GTFS (General Transit Feed Specification) public transit data. Built with Go, React, and MapLibre GL.

## Features

- **Interactive Map** - Browse transit stations on an OpenStreetMap-based map with MapLibre GL
- **Station Search** - Search for stations by name with keyboard navigation
- **Trip Planning** - View upcoming departures and plan multi-leg journeys
- **Route Visualization** - See route geometries with GTFS-defined colors
- **Trip Details** - View complete trip itineraries with all stops and times
- **Overnight Trip Handling** - Correctly handles GTFS times >= 24:00:00
- **Service Calendar** - Respects weekday rules and calendar exceptions

## Technology Stack

- **Backend:** Go 1.23 with [Wails](https://wails.io/) v2.11.0
- **Frontend:** React 18.2 + TypeScript
- **Map:** MapLibre GL 5.15.0 with react-map-gl
- **Database:** SQLite (read-only)
- **Build:** Vite + npm

## Prerequisites

- [Go](https://golang.org/) 1.23+
- [Node.js](https://nodejs.org/) 18+
- [Wails CLI](https://wails.io/docs/gettingstarted/installation)
- SQLite3

Install Wails CLI:
```bash
go install github.com/wailsapp/wails/v2/cmd/wails@latest
```

## Getting Started

### 1. Clone the Repository

```bash
git clone <repository-url>
cd bus-planning
```

### 2. Prepare GTFS Data

The application requires a pre-processed SQLite database from GTFS data. Use the included `gtfs-manager` CLI tool:

```bash
# Build the GTFS manager CLI
go build -o build/bin/gtfs-manager ./cmd/gtfs-manager/

# Download the GTFS feed (with progress display)
./build/bin/gtfs-manager download

# Import into SQLite database (requires Node.js/npx)
./build/bin/gtfs-manager import

# Check database status
./build/bin/gtfs-manager status
```

The database should contain standard GTFS tables:
- `stops` - Station/stop locations
- `routes` - Route definitions
- `trips` - Trip instances
- `stop_times` - Arrival/departure schedules
- `calendar` - Service day rules
- `calendar_dates` - Service exceptions

### 3. Install Dependencies

```bash
# Install Go dependencies
go mod download

# Install frontend dependencies
cd frontend && npm install && cd ..
```

### 4. Run in Development Mode

```bash
wails dev
```

This starts:
- Go backend with hot reload
- Vite dev server with HMR for frontend
- Dev server at http://localhost:34115 for browser access

### 5. Build for Production

```bash
wails build
```

The executable will be in `build/bin/`.

## Project Structure

```
bus-planning/
├── main.go                 # Wails app entry point
├── app.go                  # Core App struct with Wails bindings
├── cmd/
│   └── gtfs-manager/       # GTFS data management CLI
│       ├── main.go         # CLI entry point
│       ├── config.go       # YAML config loader
│       ├── status.go       # Status command
│       ├── download.go     # Download command
│       └── import.go       # Import command
├── internal/
│   ├── db/                 # Database operations
│   │   ├── db.go           # GTFS queries
│   │   └── db_test.go      # Database tests
│   ├── models/             # Data structures
│   │   └── models.go       # Go structs (JSON-serializable)
│   └── timeutil/           # GTFS time utilities
│       ├── timeutil.go     # Time normalization
│       └── timeutil_test.go
├── frontend/
│   ├── src/
│   │   ├── App.tsx         # Main app component
│   │   └── components/
│   │       ├── Map.tsx              # MapLibre map component
│   │       ├── TripDetailModal.tsx  # Trip details view
│   │       ├── DebugSidebar.tsx     # Journey planner UI
│   │       └── map/                 # Map-related hooks & utils
│   ├── package.json
│   └── wailsjs/            # Auto-generated Wails bindings
├── gtfs-data/
│   ├── feeds/              # GTFS ZIP files (gitignored)
│   └── sqlite/             # SQLite database (gitignored)
├── gtfs-config.yaml        # GTFS manager configuration
└── build/                  # Build configuration
```

## Usage

1. **Browse the Map** - Pan and zoom to find stations (stations appear at zoom level 8+)
2. **Select a Station** - Click a station marker or use the search box
3. **View Departures** - Upcoming trips appear in the sidebar
4. **Plan a Journey** - Click a trip to see details, then "board" to add to your journey
5. **Continue Planning** - After boarding, the app advances to your arrival time + 5 minutes

## API (Wails Bindings)

The Go backend exposes these methods to the frontend:

| Method | Description |
|--------|-------------|
| `GetStops(n, s, e, w)` | Get stations within bounding box |
| `GetStationDetails(stopID)` | Get station info + serving routes |
| `GetRoutesForStation(stopID)` | Get route geometries |
| `SearchStations(query, limit)` | Search stations by name |
| `GetUpcomingTrips(stopID, datetime, limit)` | Get upcoming departures |
| `GetTripDetails(tripID, serviceDate)` | Get full trip itinerary |

## Running Tests

```bash
# Run all Go tests
go test ./...

# Run tests with verbose output
go test -v ./...

# Run specific package tests
go test ./internal/db/
```

## GTFS Manager CLI

The `gtfs-manager` CLI tool manages GTFS data for the application.

### Commands

| Command | Description |
|---------|-------------|
| `status` | Check database status and data availability (default) |
| `download` | Download GTFS feed with progress display |
| `import` | Parse GTFS ZIP and create SQLite database |

### Configuration

Create a `gtfs-config.yaml` file in the project root:

```yaml
# URL to download the GTFS feed from
feed_url: "https://download.gtfs.de/germany/nv_free/latest.zip"

# Local path to store the downloaded GTFS feed
feed_path: "gtfs-data/feeds/latest.zip"

# Path to the SQLite database
database_path: "gtfs-data/sqlite/gtfs.sqlite"
```

Use `--config` to specify an alternate config file:

```bash
./build/bin/gtfs-manager --config /path/to/config.yaml status
```

### Status Command

Shows the date range of available trip data and warns if less than 2 weeks remain:

```
GTFS Database Status

╭────────────────────────────────────────────────────╮
│  Database:           gtfs-data/sqlite/gtfs.sqlite  │
│  First trip date:    Sat, 20 Dec 2025              │
│  Last trip date:     Mon, 19 Jan 2026              │
│  Total days:         31 days                       │
│  Days remaining:     19 days                       │
╰────────────────────────────────────────────────────╯

✓ Database has 19 days of trip data remaining.
```

### Download Command

Downloads the GTFS feed with a live progress display showing speed and ETA.

### Import Command

Runs `npx gtfs-import` to parse the GTFS ZIP file into SQLite. Requires Node.js.

## Configuration

Edit `wails.json` for build configuration. See [Wails documentation](https://wails.io/docs/reference/project-config) for options.

## License

[Add your license here]

## Author

Klaus Zanders
