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
cd gtfs-planner
```

### 2. Install Dependencies

```bash
# Install Go dependencies
go mod download

# Install frontend dependencies
cd frontend && npm install && cd ..
```

### 3. Prepare GTFS Data

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

### 4. Run the Application

**Development mode:**
```bash
wails dev
```

This starts the Go backend with hot reload and the Vite dev server with HMR for the frontend.

**Build for production:**
```bash
wails build
```

The executable will be in `build/bin/`.

## Usage

1. **Browse the Map** - Pan and zoom to find stations (stations appear at zoom level 8+)
2. **Select a Station** - Click a station marker or use the search box
3. **View Departures** - Upcoming trips appear in the sidebar
4. **Plan a Journey** - Click a trip to see details, then "board" to add to your journey
5. **Continue Planning** - After boarding, the app advances to your arrival time + 5 minutes

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

## Development

For information about the project structure, architecture, and development guidelines, see [DEVELOPMENT.md](DEVELOPMENT.md).

## License

[Add your license here]

## Author

Klaus Zanders
