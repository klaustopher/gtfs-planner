import { models } from '../../../wailsjs/go/models'

export const FALLBACK_COLORS = [
  '#F94144',
  '#F3722C',
  '#F8961E',
  '#F9844A',
  '#43AA8B',
  '#577590',
  '#277DA1',
  '#9B5DE5',
  '#F15BB5',
  '#00BBF9',
]

const LINE_WIDTH_STEPS = [5.5, 6, 6.5, 7]
const LINE_OFFSETS = [0, 2, -2, 3.5, -3.5, 5, -5]

export interface RouteLineStyleOptions {
  dashVariantCount?: number
}

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
      line_offset: number
      dash_variant: number
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

export function routesToGeoJSON(
  routes: models.RouteGeometry[],
  options: RouteLineStyleOptions = {}
): RouteLinesGeoJSON {
  const { dashVariantCount = 3 } = options

  return {
    type: 'FeatureCollection',
    features: routes.map((route, index) => {
      const normalizedColor = normalizeColor(route.route_color)
      const fallbackColor = FALLBACK_COLORS[index % FALLBACK_COLORS.length]
      const lineColor = normalizedColor ?? fallbackColor
      const lineWidth = LINE_WIDTH_STEPS[index % LINE_WIDTH_STEPS.length]
      const lineOffset = LINE_OFFSETS[index % LINE_OFFSETS.length]
      const dashVariant = dashVariantCount > 0 ? index % dashVariantCount : 0

      return {
      type: 'Feature',
      geometry: {
        type: 'LineString',
        coordinates: route.coordinates.map((c: models.Coordinate) => [c.lon, c.lat] as [number, number]),
      },
      properties: {
        route_id: route.route_id,
        route_short_name: route.route_short_name,
        route_long_name: route.route_long_name,
          route_color: lineColor,
          line_color: lineColor,
          line_width: lineWidth,
          line_offset: lineOffset,
          dash_variant: dashVariant,
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
      line_offset: number
      dash_variant: number
    }
  }>
}

export function tripsToGeoJSON(
  trips: models.UpcomingTrip[],
  options: RouteLineStyleOptions = {}
): TripLinesGeoJSON {
  const { dashVariantCount = 3 } = options

  return {
    type: 'FeatureCollection',
    features: trips.map((trip, index) => {
      const normalizedColor = normalizeColor(trip.route_color)
      const fallbackColor = FALLBACK_COLORS[index % FALLBACK_COLORS.length]
      const lineColor = normalizedColor ?? fallbackColor
      const lineWidth = LINE_WIDTH_STEPS[index % LINE_WIDTH_STEPS.length]
      const lineOffset = LINE_OFFSETS[index % LINE_OFFSETS.length]
      const dashVariant = dashVariantCount > 0 ? index % dashVariantCount : 0

      return {
        type: 'Feature',
        geometry: {
          type: 'LineString',
          coordinates: trip.coordinates.map((c: models.Coordinate) => [c.lon, c.lat] as [number, number]),
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
          line_width: lineWidth,
          line_offset: lineOffset,
          dash_variant: dashVariant,
        },
      }
    }),
  }
}
