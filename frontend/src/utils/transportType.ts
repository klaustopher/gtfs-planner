// GTFS route type mapping to translation keys for human-readable names
// Based on GTFS specification: https://gtfs.org/schedule/reference/#routestxt

import type { TFunction } from 'i18next'

export interface TransportTypeInfo {
  nameKey: string      // Translation key for full name (e.g., "transportType.name.tram")
  shortKey: string     // Translation key for short badge label
  icon?: string        // Optional emoji/icon
}

const TRANSPORT_TYPES: Record<number, TransportTypeInfo> = {
  0: { nameKey: 'transportType.name.tram', shortKey: 'transportType.short.tram' },
  1: { nameKey: 'transportType.name.subway', shortKey: 'transportType.short.subway' },
  2: { nameKey: 'transportType.name.rail', shortKey: 'transportType.short.rail' },
  3: { nameKey: 'transportType.name.bus', shortKey: 'transportType.short.bus' },
  4: { nameKey: 'transportType.name.ferry', shortKey: 'transportType.short.ferry' },
  5: { nameKey: 'transportType.name.cableTram', shortKey: 'transportType.short.cableTram' },
  6: { nameKey: 'transportType.name.aerialLift', shortKey: 'transportType.short.aerialLift' },
  7: { nameKey: 'transportType.name.funicular', shortKey: 'transportType.short.funicular' },
  11: { nameKey: 'transportType.name.trolleybus', shortKey: 'transportType.short.trolleybus' },
  12: { nameKey: 'transportType.name.monorail', shortKey: 'transportType.short.monorail' },
}

const UNKNOWN_TYPE: TransportTypeInfo = {
  nameKey: 'transportType.name.unknown',
  shortKey: 'transportType.short.unknown',
}

// All GTFS route types in order
export const ALL_TRANSPORT_TYPES = [0, 1, 2, 3, 4, 5, 6, 7, 11, 12]

/**
 * Get transport type information for a GTFS route type
 */
export function getTransportTypeInfo(routeType: number): TransportTypeInfo {
  return TRANSPORT_TYPES[routeType] ?? UNKNOWN_TYPE
}

/**
 * Get the short label for a GTFS route type (for badges)
 */
export function getTransportTypeLabel(routeType: number, t: TFunction): string {
  const info = getTransportTypeInfo(routeType)
  return t(info.shortKey, { routeType })
}

/**
 * Get the full name for a GTFS route type
 */
export function getTransportTypeName(routeType: number, t: TFunction): string {
  const info = getTransportTypeInfo(routeType)
  return t(info.nameKey, { routeType })
}
