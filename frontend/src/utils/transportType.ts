// GTFS route type mapping to translation keys for human-readable names
// Based on GTFS specification: https://gtfs.org/schedule/reference/#routestxt

import type { TFunction } from 'i18next'
import type { IconDefinition } from '@fortawesome/fontawesome-svg-core'
import {
  faTrain,
  faTrainSubway,
  faTrainTram,
  faBus,
  faFerry,
  faCableCar,
} from '@fortawesome/free-solid-svg-icons'

export interface TransportTypeInfo {
  nameKey: string      // Translation key for full name (e.g., "transportType.name.tram")
  shortKey: string     // Translation key for short badge label
  icon?: string        // Optional emoji/icon
}

// Keyed by transport category id (mirrors routeTypeCategoryExpr in the backend).
// 101/106/109 are the extended-rail categories split out for feeds like DELFI.
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
  101: { nameKey: 'transportType.name.longDistanceRail', shortKey: 'transportType.short.longDistanceRail' },
  106: { nameKey: 'transportType.name.regionalRail', shortKey: 'transportType.short.regionalRail' },
  109: { nameKey: 'transportType.name.suburbanRail', shortKey: 'transportType.short.suburbanRail' },
}

// Preferred display order for the filter dropdown (rail grouped first).
const CATEGORY_ORDER = [101, 106, 109, 2, 1, 0, 3, 4, 11, 12, 5, 6, 7]

/**
 * Sort transport category ids into the preferred display order; unknown ids go last.
 */
export function sortTransportCategories(categories: number[]): number[] {
  return [...categories].sort((a, b) => {
    const ia = CATEGORY_ORDER.indexOf(a)
    const ib = CATEGORY_ORDER.indexOf(b)
    return (ia === -1 ? 999 : ia) - (ib === -1 ? 999 : ib)
  })
}

const UNKNOWN_TYPE: TransportTypeInfo = {
  nameKey: 'transportType.name.unknown',
  shortKey: 'transportType.short.unknown',
}

// All GTFS base route types in order (extended types normalize onto these)
export const ALL_TRANSPORT_TYPES = [0, 1, 2, 3, 4, 5, 6, 7, 11, 12]

/**
 * Map a GTFS route type to its transport category id. Standard values (0-12)
 * mostly pass through; extended route types (100-1700, used by feeds like DELFI)
 * map onto a category, with rail split into Fernverkehr (101), Regionalzug (106)
 * and S-Bahn (109). Mirrors routeTypeCategoryExpr in the backend.
 */
export function transportCategory(routeType: number): number {
  if (routeType === 101 || routeType === 102) return 101 // long-distance rail
  if (routeType === 103 || (routeType >= 106 && routeType <= 108)) return 106 // regional rail
  if (routeType === 109) return 109 // S-Bahn
  if (routeType >= 100 && routeType < 200) return 2 // other rail
  if (routeType >= 200 && routeType < 300) return 3 // coach → bus
  if (routeType === 405) return 12 // monorail
  if (routeType >= 400 && routeType < 500) return 1 // metro / urban rail → subway
  if (routeType >= 700 && routeType < 800) return 3 // bus
  if (routeType === 800) return 11 // trolleybus
  if (routeType >= 900 && routeType < 1000) return 0 // tram
  if (routeType === 1000 || routeType === 1200) return 4 // water → ferry
  if (routeType >= 1300 && routeType < 1400) return 6 // aerial lift
  if (routeType >= 1400 && routeType < 1500) return 7 // funicular
  if (routeType >= 1500 && routeType < 1600) return 3 // taxi → bus
  return routeType
}

/**
 * Get transport type information for a GTFS route type
 */
export function getTransportTypeInfo(routeType: number): TransportTypeInfo {
  return TRANSPORT_TYPES[transportCategory(routeType)] ?? UNKNOWN_TYPE
}

// FontAwesome icon per transport category (mirrors transportCategory ids).
const TRANSPORT_ICONS: Record<number, IconDefinition> = {
  101: faTrain, // long-distance rail
  106: faTrain, // regional rail
  2: faTrain, // rail
  109: faTrain, // S-Bahn
  12: faTrain, // monorail
  1: faTrainSubway, // U-Bahn / metro
  0: faTrainTram, // tram
  3: faBus, // bus
  11: faBus, // trolleybus
  4: faFerry, // ferry
  5: faCableCar, // cable tram
  6: faCableCar, // aerial lift
  7: faCableCar, // funicular
}

/**
 * Get a FontAwesome icon matching a GTFS route type, for use next to a
 * connection. Falls back to the bus icon for unknown types.
 */
export function getTransportTypeIcon(routeType: number): IconDefinition {
  return TRANSPORT_ICONS[transportCategory(routeType)] ?? faBus
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
