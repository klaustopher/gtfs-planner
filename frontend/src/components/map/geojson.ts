import { models } from '../../../wailsjs/go/models'
import { detectOverlaps, applyOffset, type TripForOverlap } from './lineOffset'

// Distinct colors for route lines - chosen to be visually different from each other
export const FALLBACK_COLORS = [
  '#E63946', // Red
  '#2A9D8F', // Teal
  '#5E60CE', // Purple
  '#F4A261', // Orange
  '#1D3557', // Navy
  '#E9C46A', // Yellow
  '#06D6A0', // Green
  '#EF476F', // Pink
  '#118AB2', // Blue
  '#073B4C', // Dark teal
]

const LINE_WIDTH = 6

export interface StopsGeoJSON {
  type: 'FeatureCollection'
  features: Array<{
    type: 'Feature'
    geometry: {
      type: 'Point'
      coordinates: [number, number]
    }
    properties: {
      stop_id: string
      stop_name: string
    }
  }>
}

export interface RouteLinesGeoJSON {
  type: 'FeatureCollection'
  features: Array<{
    type: 'Feature'
    geometry: {
      type: 'LineString'
      coordinates: Array<[number, number]>
    }
    properties: {
      route_id: string
      route_short_name: string
      route_long_name: string
      route_color: string
      line_color: string
      line_width: number
    }
  }>
}

export function stopsToGeoJSON(stops: models.Stop[]): StopsGeoJSON {
  return {
    type: 'FeatureCollection',
    features: stops.map((stop) => ({
      type: 'Feature',
      geometry: {
        type: 'Point',
        coordinates: [stop.stop_lon, stop.stop_lat] as [number, number],
      },
      properties: {
        stop_id: stop.stop_id,
        stop_name: stop.stop_name,
      },
    })),
  }
}

export function routesToGeoJSON(routes: models.RouteGeometry[]): RouteLinesGeoJSON {
  // Convert routes to format for overlap detection
  const routesForOverlap: TripForOverlap[] = routes.map((route) => ({
    id: route.route_id,
    coordinates: route.coordinates.map((c: models.Coordinate) => [c.lon, c.lat] as [number, number]),
  }))

  // Detect overlapping routes and get offset indices
  const offsetIndices = detectOverlaps(routesForOverlap)

  return {
    type: 'FeatureCollection',
    features: routes.map((route, index) => {
      const normalizedColor = normalizeColor(route.route_color)
      const fallbackColor = FALLBACK_COLORS[index % FALLBACK_COLORS.length]
      const lineColor = normalizedColor ?? fallbackColor

      // Get original coordinates
      const originalCoords = route.coordinates.map((c: models.Coordinate) => [c.lon, c.lat] as [number, number])

      // Apply offset based on overlap detection (keeps endpoints at station positions)
      const offsetIndex = offsetIndices.get(route.route_id) ?? 0
      const offsetCoords = applyOffset(originalCoords, offsetIndex)

      return {
        type: 'Feature',
        geometry: {
          type: 'LineString',
          coordinates: offsetCoords,
        },
        properties: {
          route_id: route.route_id,
          route_short_name: route.route_short_name,
          route_long_name: route.route_long_name,
          route_color: lineColor,
          line_color: lineColor,
          line_width: LINE_WIDTH,
        },
      }
    }),
  }
}

export function normalizeColor(value?: string): string | null {
  if (!value) {
    return null
  }
  const hex = value.startsWith('#') ? value.slice(1) : value
  if (!/^[0-9a-fA-F]{6}$/.test(hex)) {
    return null
  }
  return `#${hex.toUpperCase()}`
}

// Get the display color for a trip at a given index (matching the map line colors)
export function getTripColor(trip: models.UpcomingTrip, index: number): string {
  const normalized = normalizeColor(trip.route_color)
  return normalized ?? FALLBACK_COLORS[index % FALLBACK_COLORS.length]
}

export interface TripLinesGeoJSON {
  type: 'FeatureCollection'
  features: Array<{
    type: 'Feature'
    geometry: {
      type: 'LineString'
      coordinates: Array<[number, number]>
    }
    properties: {
      trip_id: string
      route_id: string
      display_name: string
      destination: string
      route_color: string
      departure_datetime: string
      headsign: string
      line_color: string
      line_width: number
    }
  }>
}

export function tripsToGeoJSON(trips: models.UpcomingTrip[]): TripLinesGeoJSON {
  // Convert trips to format for overlap detection
  const tripsForOverlap: TripForOverlap[] = trips.map((trip) => ({
    id: trip.trip_id,
    coordinates: trip.coordinates.map((c: models.Coordinate) => [c.lon, c.lat] as [number, number]),
  }))

  // Detect overlapping trips and get offset indices
  const offsetIndices = detectOverlaps(tripsForOverlap)

  return {
    type: 'FeatureCollection',
    features: trips.map((trip, index) => {
      const normalizedColor = normalizeColor(trip.route_color)
      const fallbackColor = FALLBACK_COLORS[index % FALLBACK_COLORS.length]
      const lineColor = normalizedColor ?? fallbackColor

      // Get original coordinates
      const originalCoords = trip.coordinates.map((c: models.Coordinate) => [c.lon, c.lat] as [number, number])

      // Apply offset based on overlap detection (keeps endpoints at station positions)
      const offsetIndex = offsetIndices.get(trip.trip_id) ?? 0
      const offsetCoords = applyOffset(originalCoords, offsetIndex)

      return {
        type: 'Feature',
        geometry: {
          type: 'LineString',
          coordinates: offsetCoords,
        },
        properties: {
          trip_id: trip.trip_id,
          route_id: trip.route_id,
          display_name: trip.display_name,
          destination: trip.destination,
          route_color: lineColor,
          departure_datetime: trip.departure_datetime,
          headsign: trip.headsign,
          line_color: lineColor,
          line_width: LINE_WIDTH,
        },
      }
    }),
  }
}
