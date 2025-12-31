// GTFS route type mapping to human-readable names and short labels
// Based on GTFS specification: https://gtfs.org/schedule/reference/#routestxt

export interface TransportTypeInfo {
  name: string      // Full name (e.g., "Tram/Streetcar")
  short: string     // Short label for badges (e.g., "Tram")
  icon?: string     // Optional emoji/icon
}

const TRANSPORT_TYPES: Record<number, TransportTypeInfo> = {
  0: { name: 'Tram/Streetcar/Light rail', short: 'Tram' },
  1: { name: 'Subway/Metro', short: 'U-Bahn' },
  2: { name: 'Rail', short: 'Zug' },
  3: { name: 'Bus', short: 'Bus' },
  4: { name: 'Ferry', short: 'Fähre' },
  5: { name: 'Cable tram', short: 'Seilbahn' },
  6: { name: 'Aerial lift/Gondola', short: 'Gondel' },
  7: { name: 'Funicular', short: 'Standseilbahn' },
  11: { name: 'Trolleybus', short: 'O-Bus' },
  12: { name: 'Monorail', short: 'Monorail' },
}

/**
 * Get transport type information for a GTFS route type
 */
export function getTransportTypeInfo(routeType: number): TransportTypeInfo {
  return TRANSPORT_TYPES[routeType] ?? { name: `Unknown (${routeType})`, short: '?' }
}

/**
 * Get the short label for a GTFS route type (for badges)
 */
export function getTransportTypeLabel(routeType: number): string {
  return getTransportTypeInfo(routeType).short
}

/**
 * Get the full name for a GTFS route type
 */
export function getTransportTypeName(routeType: number): string {
  return getTransportTypeInfo(routeType).name
}
