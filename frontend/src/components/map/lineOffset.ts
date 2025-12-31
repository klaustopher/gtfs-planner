import lineOffset from '@turf/line-offset'
import { lineString } from '@turf/helpers'

const OFFSET_METERS = 20

type Coord = [number, number]

/**
 * Creates a normalized segment key for overlap detection.
 * Ensures segment A->B has same key as B->A.
 */
function segmentKey(c1: Coord, c2: Coord): string {
  const [a, b] = [c1, c2].sort((x, y) => {
    if (x[0] !== y[0]) return x[0] - y[0]
    return x[1] - y[1]
  })
  return `${a[0].toFixed(6)},${a[1].toFixed(6)}|${b[0].toFixed(6)},${b[1].toFixed(6)}`
}

/**
 * Extracts all segments from a coordinate array.
 */
function getSegments(coords: Coord[]): Set<string> {
  const segments = new Set<string>()
  for (let i = 0; i < coords.length - 1; i++) {
    segments.add(segmentKey(coords[i], coords[i + 1]))
  }
  return segments
}

export interface TripForOverlap {
  id: string
  coordinates: Coord[]
}

/**
 * Detects overlapping trips and assigns offset indices.
 * Returns a Map from trip ID to offset index (0, 1, -1, 2, -2, etc.)
 */
export function detectOverlaps(trips: TripForOverlap[]): Map<string, number> {
  if (trips.length === 0) {
    return new Map()
  }

  // Build segment -> trip mapping
  const segmentToTrips = new Map<string, Set<string>>()
  const tripSegments = new Map<string, Set<string>>()

  for (const trip of trips) {
    const segments = getSegments(trip.coordinates)
    tripSegments.set(trip.id, segments)
    for (const seg of segments) {
      if (!segmentToTrips.has(seg)) {
        segmentToTrips.set(seg, new Set())
      }
      segmentToTrips.get(seg)!.add(trip.id)
    }
  }

  // Build trip -> overlapping trips (trips that share at least one segment)
  const tripOverlaps = new Map<string, Set<string>>()
  for (const [, tripIds] of segmentToTrips) {
    if (tripIds.size > 1) {
      for (const id of tripIds) {
        if (!tripOverlaps.has(id)) {
          tripOverlaps.set(id, new Set())
        }
        for (const otherId of tripIds) {
          if (otherId !== id) {
            tripOverlaps.get(id)!.add(otherId)
          }
        }
      }
    }
  }

  // Assign offset indices - default all to 0
  const offsets = new Map<string, number>()
  for (const trip of trips) {
    offsets.set(trip.id, 0)
  }

  // Find connected components of overlapping trips and assign offsets within each group
  const processed = new Set<string>()

  for (const trip of trips) {
    if (processed.has(trip.id)) continue

    const overlaps = tripOverlaps.get(trip.id)
    if (!overlaps || overlaps.size === 0) {
      processed.add(trip.id)
      continue
    }

    // BFS to find all trips in this overlap group
    const group: string[] = []
    const queue = [trip.id]
    const seen = new Set<string>([trip.id])

    while (queue.length > 0) {
      const current = queue.shift()!
      group.push(current)

      const currentOverlaps = tripOverlaps.get(current)
      if (currentOverlaps) {
        for (const neighbor of currentOverlaps) {
          if (!seen.has(neighbor)) {
            seen.add(neighbor)
            queue.push(neighbor)
          }
        }
      }
    }

    // Assign alternating offsets: 0, 1, -1, 2, -2, ...
    for (let i = 0; i < group.length; i++) {
      const offsetIndex = i === 0 ? 0 : (i % 2 === 1 ? Math.ceil(i / 2) : -Math.floor(i / 2))
      offsets.set(group[i], offsetIndex)
      processed.add(group[i])
    }
  }

  return offsets
}

/**
 * Calculates a perpendicular offset for a point along a line segment.
 * Returns the offset coordinate.
 */
function offsetPointPerpendicular(
  point: Coord,
  prevPoint: Coord | null,
  nextPoint: Coord | null,
  offsetMeters: number
): Coord {
  // Calculate the direction vector (average of incoming and outgoing segments)
  let dx = 0
  let dy = 0

  if (prevPoint && nextPoint) {
    // Middle point - average the two segment directions
    const dx1 = point[0] - prevPoint[0]
    const dy1 = point[1] - prevPoint[1]
    const dx2 = nextPoint[0] - point[0]
    const dy2 = nextPoint[1] - point[1]
    dx = dx1 + dx2
    dy = dy1 + dy2
  } else if (nextPoint) {
    // First point - use outgoing direction
    dx = nextPoint[0] - point[0]
    dy = nextPoint[1] - point[1]
  } else if (prevPoint) {
    // Last point - use incoming direction
    dx = point[0] - prevPoint[0]
    dy = point[1] - prevPoint[1]
  }

  // Normalize and get perpendicular
  const len = Math.sqrt(dx * dx + dy * dy)
  if (len === 0) return point

  // Perpendicular vector (rotate 90 degrees)
  const perpX = -dy / len
  const perpY = dx / len

  // Convert meters to approximate degrees (rough approximation)
  // At equator: 1 degree ≈ 111,320 meters
  // Adjust for latitude
  const latRadians = point[1] * (Math.PI / 180)
  const metersPerDegreeLon = 111320 * Math.cos(latRadians)
  const metersPerDegreeLat = 111320

  const offsetLon = (perpX * offsetMeters) / metersPerDegreeLon
  const offsetLat = (perpY * offsetMeters) / metersPerDegreeLat

  return [point[0] + offsetLon, point[1] + offsetLat]
}

/**
 * Applies offset to intermediate points while keeping endpoints at exact station positions.
 * This creates lines that converge at stations but are offset in between.
 */
export function applyOffset(
  coordinates: Coord[],
  offsetIndex: number
): Coord[] {
  if (coordinates.length < 2) {
    return coordinates
  }

  // No offset needed for index 0
  if (offsetIndex === 0) {
    return [...coordinates]
  }

  const offsetMeters = offsetIndex * OFFSET_METERS
  const result: Coord[] = []

  // For short lines (2-3 points), just keep original to avoid weird offsets
  if (coordinates.length <= 3) {
    return [...coordinates]
  }

  for (let i = 0; i < coordinates.length; i++) {
    const point = coordinates[i]
    const prevPoint = i > 0 ? coordinates[i - 1] : null
    const nextPoint = i < coordinates.length - 1 ? coordinates[i + 1] : null

    // Keep first and last points at exact station positions
    if (i === 0 || i === coordinates.length - 1) {
      result.push(point)
    } else {
      // Offset intermediate points
      result.push(offsetPointPerpendicular(point, prevPoint, nextPoint, offsetMeters))
    }
  }

  return result
}

/**
 * Alternative: Apply full Turf.js offset but blend endpoints back to stations.
 * This creates smoother curves but ensures endpoints match stations.
 */
export function applyOffsetWithBlend(
  coordinates: Coord[],
  offsetIndex: number,
  blendPoints: number = 1
): Coord[] {
  if (coordinates.length < 2 || offsetIndex === 0) {
    return [...coordinates]
  }

  try {
    const line = lineString(coordinates)
    const offsetDistance = offsetIndex * OFFSET_METERS
    const offsetLine = lineOffset(line, offsetDistance, { units: 'meters' })
    const offsetCoords = offsetLine.geometry.coordinates as Coord[]

    // Snap first point to original
    offsetCoords[0] = coordinates[0]
    // Snap last point to original
    offsetCoords[offsetCoords.length - 1] = coordinates[coordinates.length - 1]

    // Blend nearby points for smoother transition
    for (let i = 1; i <= blendPoints && i < offsetCoords.length - 1; i++) {
      const t = i / (blendPoints + 1)
      offsetCoords[i] = [
        coordinates[i][0] * (1 - t) + offsetCoords[i][0] * t,
        coordinates[i][1] * (1 - t) + offsetCoords[i][1] * t,
      ]
    }

    for (let i = 1; i <= blendPoints && i < offsetCoords.length - 1; i++) {
      const idx = offsetCoords.length - 1 - i
      const origIdx = coordinates.length - 1 - i
      if (idx > 0 && origIdx > 0) {
        const t = i / (blendPoints + 1)
        offsetCoords[idx] = [
          coordinates[origIdx][0] * (1 - t) + offsetCoords[idx][0] * t,
          coordinates[origIdx][1] * (1 - t) + offsetCoords[idx][1] * t,
        ]
      }
    }

    return offsetCoords
  } catch {
    return [...coordinates]
  }
}
