import { describe, it, expect } from 'vitest'
import type { TFunction } from 'i18next'
import { faTrain, faTrainSubway, faTrainTram, faBus, faFerry, faCableCar } from '@fortawesome/free-solid-svg-icons'
import {
  transportCategory,
  sortTransportCategories,
  getTransportTypeInfo,
  getTransportTypeIcon,
  getTransportTypeLabel,
  getTransportTypeName,
} from './transportType'

describe('transportCategory', () => {
  it('passes the standard GTFS route types through unchanged', () => {
    for (const routeType of [0, 1, 2, 3, 4, 5, 6, 7, 11, 12]) {
      expect(transportCategory(routeType)).toBe(routeType)
    }
  })

  it('splits extended rail into long-distance, regional and suburban', () => {
    expect([101, 102].map(transportCategory)).toEqual([101, 101])
    expect([103, 106, 107, 108].map(transportCategory)).toEqual([106, 106, 106, 106])
    expect(transportCategory(109)).toBe(109)
  })

  it('maps the remaining 1xx rail types onto plain rail', () => {
    expect([100, 104, 105, 110, 199].map(transportCategory)).toEqual([2, 2, 2, 2, 2])
  })

  it('maps coach, bus and taxi ranges onto bus', () => {
    expect([200, 299, 700, 799, 1500, 1599].map(transportCategory)).toEqual([3, 3, 3, 3, 3, 3])
  })

  it('prefers the monorail special case over the surrounding metro range', () => {
    expect(transportCategory(405)).toBe(12)
    expect([400, 404, 406, 499].map(transportCategory)).toEqual([1, 1, 1, 1])
  })

  it('maps trolleybus, tram, water, aerial lift and funicular', () => {
    expect(transportCategory(800)).toBe(11)
    expect([900, 999].map(transportCategory)).toEqual([0, 0])
    expect([1000, 1200].map(transportCategory)).toEqual([4, 4])
    expect([1300, 1399].map(transportCategory)).toEqual([6, 6])
    expect([1400, 1499].map(transportCategory)).toEqual([7, 7])
  })

  it('returns uncovered extended types verbatim, which surface as unknown', () => {
    for (const routeType of [300, 801, 1100, 1700]) {
      expect(transportCategory(routeType)).toBe(routeType)
      expect(getTransportTypeInfo(routeType).nameKey).toBe('transportType.name.unknown')
    }
  })
})

describe('sortTransportCategories', () => {
  it('sorts into the preferred display order with rail grouped first', () => {
    expect(sortTransportCategories([3, 0, 2, 109, 101])).toEqual([101, 109, 2, 0, 3])
  })

  it('puts unknown ids last, keeping their relative order', () => {
    expect(sortTransportCategories([42, 3, 99, 101])).toEqual([101, 3, 42, 99])
  })

  it('does not mutate the input array', () => {
    const input = [3, 101, 0]
    sortTransportCategories(input)
    expect(input).toEqual([3, 101, 0])
  })
})

describe('getTransportTypeInfo', () => {
  it('resolves through the category mapping, not the raw route type', () => {
    expect(getTransportTypeInfo(102)).toEqual({
      nameKey: 'transportType.name.longDistanceRail',
      shortKey: 'transportType.short.longDistanceRail',
    })
    expect(getTransportTypeInfo(712).nameKey).toBe('transportType.name.bus')
  })

  it('falls back to the unknown entry', () => {
    expect(getTransportTypeInfo(9999)).toEqual({
      nameKey: 'transportType.name.unknown',
      shortKey: 'transportType.short.unknown',
    })
  })
})

describe('getTransportTypeIcon', () => {
  it('picks an icon per category', () => {
    expect(getTransportTypeIcon(102)).toBe(faTrain)
    expect(getTransportTypeIcon(109)).toBe(faTrain)
    expect(getTransportTypeIcon(400)).toBe(faTrainSubway)
    expect(getTransportTypeIcon(900)).toBe(faTrainTram)
    expect(getTransportTypeIcon(1000)).toBe(faFerry)
    expect(getTransportTypeIcon(1400)).toBe(faCableCar)
  })

  it('falls back to the bus icon for unknown types', () => {
    expect(getTransportTypeIcon(9999)).toBe(faBus)
  })
})

describe('label and name lookups', () => {
  const t = ((key: string, options?: Record<string, unknown>) =>
    `${key}:${String(options?.routeType)}`) as unknown as TFunction

  it('translates the short key for labels and the name key for names', () => {
    expect(getTransportTypeLabel(109, t)).toBe('transportType.short.suburbanRail:109')
    expect(getTransportTypeName(109, t)).toBe('transportType.name.suburbanRail:109')
  })

  it('passes the original route type to the translator, not the category', () => {
    expect(getTransportTypeName(102, t)).toBe('transportType.name.longDistanceRail:102')
  })
})
