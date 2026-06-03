import { models } from '../../../wailsjs/go/models'
import { detectOverlaps, applyOffset, type TripForOverlap } from './lineOffset'

// Bright, high-contrast colors optimized for dark map backgrounds
// Chosen to be visually distinct and clearly visible on dark surfaces
export const FALLBACK_COLORS = [
  '#FF6B6B', // Bright Red
  '#4ECDC4', // Bright Teal
  '#FFA07A', // Light Salmon
  '#87CEEB', // Sky Blue
  '#FFD93D', // Bright Yellow
  '#6BCF7F', // Light Green
  '#FF8DA1', // Light Pink
  '#95E1D3', // Mint
  '#9B72CF', // Light Purple
  '#FF9E5C', // Peach
  '#5DADE2', // Dodger Blue
  '#F8B500', // Amber
  '#FF7F9C', // Rose Pink
  '#7FCDBB', // Seafoam
  '#FFA6C9', // Bubblegum Pink
]

const LINE_WIDTH = 6

// Screen-space separation for overlapping trip lines: a per-line pixel offset
// (constant across zoom, unlike a metre-based geometry offset that vanishes when
// zoomed out) so overlapping corridors fan out into clean parallel lines at every
// zoom level. Mirrors the offset index (0, 1, -1, 2, -2, …) from detectOverlaps.
// Stepped a touch above the line width so each line's white casing separates it
// from its neighbours (see TripLayers).
const TRIP_OFFSET_PX = 7

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
      // Dominant transport category (see markerIcons), -1 when unknown.
      category: number
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
        category: stop.station_category ?? -1,
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
      // Perpendicular screen offset (pixels) used to separate overlapping trip
      // lines; see TripLayers.
      line_offset: number
    }
  }>
}

export function tripsToGeoJSON(trips: models.UpcomingTrip[]): TripLinesGeoJSON {
  // Convert trips to format for overlap detection
  const tripsForOverlap: TripForOverlap[] = trips.map((trip) => ({
    id: trip.trip_id,
    coordinates: trip.coordinates.map((c: models.Coordinate) => [c.lon, c.lat] as [number, number]),
  }))

  // Detect overlapping trips and get offset indices (0, 1, -1, 2, -2, …)
  const offsetIndices = detectOverlaps(tripsForOverlap)

  return {
    type: 'FeatureCollection',
    features: trips.map((trip, index) => {
      const normalizedColor = normalizeColor(trip.route_color)
      const fallbackColor = FALLBACK_COLORS[index % FALLBACK_COLORS.length]
      const lineColor = normalizedColor ?? fallbackColor

      // Keep the true geometry; separation happens in screen space (line-offset)
      // so it survives at every zoom level, unlike a metre-based geometry offset.
      const coords = trip.coordinates.map((c: models.Coordinate) => [c.lon, c.lat] as [number, number])

      const offsetIndex = offsetIndices.get(trip.trip_id) ?? 0

      return {
        type: 'Feature',
        geometry: {
          type: 'LineString',
          coordinates: coords,
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
          line_offset: offsetIndex * TRIP_OFFSET_PX,
        },
      }
    }),
  }
}

// ===== Journey View GeoJSON Functions =====

import type { JourneyLeg, WalkingConnection } from '../../hooks/useJourneyView'

export interface JourneyLinesGeoJSON {
  type: 'FeatureCollection'
  features: Array<{
    type: 'Feature'
    geometry: {
      type: 'LineString'
      coordinates: Array<[number, number]>
    }
    properties: {
      trip_id: string
      route_color: string
      route_short_name: string
      line_color: string
      line_width: number
    }
  }>
}

export function journeyLegsToGeoJSON(legs: JourneyLeg[]): JourneyLinesGeoJSON {
  // Convert legs to format for overlap detection
  const legsForOverlap: TripForOverlap[] = legs.map((leg) => ({
    id: leg.tripId,
    coordinates: leg.coordinates.map((c) => [c.lon, c.lat] as [number, number]),
  }))

  // Detect overlapping legs and get offset indices
  const offsetIndices = detectOverlaps(legsForOverlap)

  return {
    type: 'FeatureCollection',
    features: legs.map((leg, index) => {
      const normalizedColor = normalizeColor(leg.routeColor)
      const fallbackColor = FALLBACK_COLORS[index % FALLBACK_COLORS.length]
      const lineColor = normalizedColor ?? fallbackColor

      // Get original coordinates
      const originalCoords = leg.coordinates.map((c) => [c.lon, c.lat] as [number, number])

      // Apply offset based on overlap detection
      const offsetIndex = offsetIndices.get(leg.tripId) ?? 0
      const offsetCoords = applyOffset(originalCoords, offsetIndex)

      return {
        type: 'Feature',
        geometry: {
          type: 'LineString',
          coordinates: offsetCoords,
        },
        properties: {
          trip_id: leg.tripId,
          route_color: lineColor,
          route_short_name: leg.routeShortName,
          line_color: lineColor,
          line_width: LINE_WIDTH,
        },
      }
    }),
  }
}

export interface WalkingLinesGeoJSON {
  type: 'FeatureCollection'
  features: Array<{
    type: 'Feature'
    geometry: {
      type: 'LineString'
      coordinates: Array<[number, number]>
    }
    properties: {
      from_station_id: string
      to_station_id: string
    }
  }>
}

export function walkingConnectionsToGeoJSON(connections: WalkingConnection[]): WalkingLinesGeoJSON {
  return {
    type: 'FeatureCollection',
    features: connections.map((conn) => ({
      type: 'Feature',
      geometry: {
        type: 'LineString',
        coordinates: [
          [conn.fromLon, conn.fromLat],
          [conn.toLon, conn.toLat],
        ] as Array<[number, number]>,
      },
      properties: {
        from_station_id: conn.fromStationId,
        to_station_id: conn.toStationId,
      },
    })),
  }
}
