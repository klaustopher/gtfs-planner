import { useState, useEffect, useMemo } from 'react'
import { GetTripDetails } from '../../wailsjs/go/main/App'
import { models } from '../../wailsjs/go/models'
import type { SavedTrip } from '../App'

// Journey leg with coordinates for the polyline
export interface JourneyLeg {
  tripId: string
  routeColor: string // Display color (with fallback applied)
  routeShortName: string
  coordinates: Array<{ lat: number; lon: number }>
}

// Unified marker type for start, transfer, and end stations
export interface JourneyMarker {
  type: 'start' | 'transfer' | 'end'
  stationId: string
  stationName: string
  lat: number
  lon: number
  // Arrival info (undefined for start marker)
  arrivalTime?: string
  arrivalPlatform?: string
  arrivalRouteShortName?: string
  arrivalRouteColor?: string
  // Departure info (undefined for end marker)
  departureTime?: string
  departurePlatform?: string
  departureRouteShortName?: string
  departureRouteColor?: string
  // Transfer-specific
  layoverMinutes?: number
  isWalkingTransfer?: boolean
  // Popover positioning
  anchor?: 'left' | 'right' | 'top' | 'bottom'
  offset?: [number, number]
}

// Walking connection between different stations
export interface WalkingConnection {
  fromStationId: string
  fromLat: number
  fromLon: number
  toStationId: string
  toLat: number
  toLon: number
}

// Summary statistics for the journey
export interface JourneySummary {
  totalTravelMinutes: number
  numberOfLegs: number
  numberOfTransfers: number
  numberOfWalkingConnections: number
  firstDepartureTime: string
  lastArrivalTime: string
}

// Complete journey view data
export interface JourneyViewData {
  legs: JourneyLeg[]
  markers: JourneyMarker[]
  walkingConnections: WalkingConnection[]
  summary: JourneySummary
}

// Extract service date (YYYYMMDD) from ISO datetime
function extractServiceDate(isoDateTime: string): string {
  return isoDateTime.split('T')[0].replace(/-/g, '')
}

// Calculate minutes between two ISO datetimes
function minutesBetween(start: string, end: string): number {
  const startDate = new Date(start)
  const endDate = new Date(end)
  return Math.round((endDate.getTime() - startDate.getTime()) / 60000)
}

// Find stop in stop_times array by station ID
function findStopByStationId(
  stopTimes: models.StopTime[],
  stationId: string
): models.StopTime | undefined {
  return stopTimes.find(st => st.stop_id === stationId)
}

// Extract coordinates between two stations (inclusive)
function extractCoordinateSegment(
  stopTimes: models.StopTime[],
  startStationId: string,
  endStationId: string
): Array<{ lat: number; lon: number }> {
  const startIdx = stopTimes.findIndex(st => st.stop_id === startStationId)
  const endIdx = stopTimes.findIndex(st => st.stop_id === endStationId)

  if (startIdx === -1 || endIdx === -1 || startIdx > endIdx) {
    return []
  }

  return stopTimes.slice(startIdx, endIdx + 1).map(st => ({
    lat: st.stop_lat,
    lon: st.stop_lon,
  }))
}

// Calculate smart anchor position for popover to avoid blocking route lines
function calculateAnchorPosition(
  markerIndex: number,
  isWalkingTransfer: boolean
): { anchor: 'left' | 'right' | 'top' | 'bottom'; offset: [number, number] } {
  // Walking transfers use top anchor to avoid blocking the walking line
  if (isWalkingTransfer) {
    return {
      anchor: 'top',
      offset: [0, -10] as [number, number],
    }
  }

  // Alternate between left and right for normal markers
  // This creates a zigzag pattern that keeps popovers away from the route line
  const isEven = markerIndex % 2 === 0
  if (isEven) {
    return {
      anchor: 'left',
      offset: [15, 0] as [number, number],
    }
  } else {
    return {
      anchor: 'right',
      offset: [-15, 0] as [number, number],
    }
  }
}

export function useJourneyView(
  savedTrips: SavedTrip[],
  enabled: boolean
): { data: JourneyViewData | null; isLoading: boolean; error: string | null } {
  const [tripDetails, setTripDetails] = useState<Map<string, models.TripDetails>>(new Map())
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Fetch trip details when enabled
  useEffect(() => {
    if (!enabled || savedTrips.length === 0) {
      setTripDetails(new Map())
      return
    }

    setIsLoading(true)
    setError(null)

    const fetchAll = async () => {
      const details = new Map<string, models.TripDetails>()

      // Fetch all trip details in parallel
      const promises = savedTrips.map(async (trip) => {
        try {
          const serviceDate = extractServiceDate(trip.departureDateTime)
          const result = await GetTripDetails(trip.tripId, serviceDate)
          return { tripId: trip.tripId, details: result }
        } catch (err) {
          console.error(`Failed to fetch trip ${trip.tripId}:`, err)
          return null
        }
      })

      const results = await Promise.all(promises)
      for (const result of results) {
        if (result) {
          details.set(result.tripId, result.details)
        }
      }

      setTripDetails(details)
      setIsLoading(false)
    }

    fetchAll().catch(err => {
      console.error('Failed to fetch journey details:', err)
      setError('Failed to load journey details')
      setIsLoading(false)
    })
  }, [savedTrips, enabled])

  // Build journey view data from trip details
  const data = useMemo<JourneyViewData | null>(() => {
    if (!enabled || savedTrips.length === 0 || tripDetails.size === 0) {
      return null
    }

    const legs: JourneyLeg[] = []
    const markers: JourneyMarker[] = []
    const walkingConnections: WalkingConnection[] = []

    for (let i = 0; i < savedTrips.length; i++) {
      const savedTrip = savedTrips[i]
      const details = tripDetails.get(savedTrip.tripId)

      if (!details || !details.stop_times) {
        continue
      }

      // Extract coordinate segment for this leg
      const coordinates = extractCoordinateSegment(
        details.stop_times,
        savedTrip.startStationId,
        savedTrip.endStationId
      )

      if (coordinates.length > 0) {
        legs.push({
          tripId: savedTrip.tripId,
          routeColor: savedTrip.displayColor,
          routeShortName: savedTrip.routeShortName,
          coordinates,
        })
      }

      // Find the actual stop times for boarding and alighting
      const boardingStop = findStopByStationId(details.stop_times, savedTrip.startStationId)
      const alightingStop = findStopByStationId(details.stop_times, savedTrip.endStationId)

      // First trip: add start marker
      if (i === 0 && boardingStop) {
        const positioning = calculateAnchorPosition(markers.length, false)
        markers.push({
          type: 'start',
          stationId: savedTrip.startStationId,
          stationName: savedTrip.startStationName,
          lat: boardingStop.stop_lat,
          lon: boardingStop.stop_lon,
          departureTime: boardingStop.departure_datetime,
          departurePlatform: boardingStop.platform_code || undefined,
          departureRouteShortName: savedTrip.routeShortName,
          departureRouteColor: savedTrip.displayColor,
          anchor: positioning.anchor,
          offset: positioning.offset,
        })
      }

      // Add transfer marker (or end marker for last trip)
      if (alightingStop) {
        const isLastTrip = i === savedTrips.length - 1

        if (isLastTrip) {
          // End marker
          const positioning = calculateAnchorPosition(markers.length, false)
          markers.push({
            type: 'end',
            stationId: savedTrip.endStationId,
            stationName: savedTrip.endStationName,
            lat: alightingStop.stop_lat,
            lon: alightingStop.stop_lon,
            arrivalTime: alightingStop.arrival_datetime,
            arrivalPlatform: alightingStop.platform_code || undefined,
            arrivalRouteShortName: savedTrip.routeShortName,
            arrivalRouteColor: savedTrip.displayColor,
            anchor: positioning.anchor,
            offset: positioning.offset,
          })
        } else {
          // Transfer marker - we need info from the next trip too
          const nextTrip = savedTrips[i + 1]
          const nextDetails = tripDetails.get(nextTrip.tripId)
          const nextBoardingStop = nextDetails
            ? findStopByStationId(nextDetails.stop_times, nextTrip.startStationId)
            : undefined

          const isWalkingTransfer = savedTrip.endStationId !== nextTrip.startStationId

          // Calculate layover time
          const layoverMinutes = minutesBetween(
            alightingStop.arrival_datetime,
            nextTrip.departureDateTime
          )

          if (isWalkingTransfer) {
            // Walking transfer - create two markers:
            // 1. Arrival marker at the alighting station
            const arrivalPositioning = calculateAnchorPosition(markers.length, false)
            markers.push({
              type: 'transfer',
              stationId: savedTrip.endStationId,
              stationName: savedTrip.endStationName,
              lat: alightingStop.stop_lat,
              lon: alightingStop.stop_lon,
              arrivalTime: alightingStop.arrival_datetime,
              arrivalPlatform: alightingStop.platform_code || undefined,
              arrivalRouteShortName: savedTrip.routeShortName,
              arrivalRouteColor: savedTrip.displayColor,
              isWalkingTransfer: true,
              anchor: arrivalPositioning.anchor,
              offset: arrivalPositioning.offset,
            })

            // Add walking connection
            if (nextBoardingStop) {
              walkingConnections.push({
                fromStationId: savedTrip.endStationId,
                fromLat: alightingStop.stop_lat,
                fromLon: alightingStop.stop_lon,
                toStationId: nextTrip.startStationId,
                toLat: nextBoardingStop.stop_lat,
                toLon: nextBoardingStop.stop_lon,
              })

              // 2. Departure marker at the next boarding station
              const departurePositioning = calculateAnchorPosition(markers.length, false)
              markers.push({
                type: 'transfer',
                stationId: nextTrip.startStationId,
                stationName: nextTrip.startStationName,
                lat: nextBoardingStop.stop_lat,
                lon: nextBoardingStop.stop_lon,
                departureTime: nextBoardingStop.departure_datetime || nextTrip.departureDateTime,
                departurePlatform: nextBoardingStop.platform_code || undefined,
                departureRouteShortName: nextTrip.routeShortName,
                departureRouteColor: nextTrip.displayColor,
                layoverMinutes,
                isWalkingTransfer: true,
                anchor: departurePositioning.anchor,
                offset: departurePositioning.offset,
              })
            }
          } else {
            // Same station transfer
            const positioning = calculateAnchorPosition(markers.length, false)
            markers.push({
              type: 'transfer',
              stationId: savedTrip.endStationId,
              stationName: savedTrip.endStationName,
              lat: alightingStop.stop_lat,
              lon: alightingStop.stop_lon,
              arrivalTime: alightingStop.arrival_datetime,
              arrivalPlatform: alightingStop.platform_code || undefined,
              arrivalRouteShortName: savedTrip.routeShortName,
              arrivalRouteColor: savedTrip.displayColor,
              departureTime: nextBoardingStop?.departure_datetime || nextTrip.departureDateTime,
              departurePlatform: nextBoardingStop?.platform_code || undefined,
              departureRouteShortName: nextTrip.routeShortName,
              departureRouteColor: nextTrip.displayColor,
              layoverMinutes,
              isWalkingTransfer: false,
              anchor: positioning.anchor,
              offset: positioning.offset,
            })
          }
        }
      }
    }

    // Build summary
    const firstTrip = savedTrips[0]
    const lastTrip = savedTrips[savedTrips.length - 1]
    const totalTravelMinutes = minutesBetween(
      firstTrip.departureDateTime,
      lastTrip.arrivalDateTime
    )

    const summary: JourneySummary = {
      totalTravelMinutes,
      numberOfLegs: legs.length,
      numberOfTransfers: Math.max(0, legs.length - 1),
      numberOfWalkingConnections: walkingConnections.length,
      firstDepartureTime: firstTrip.departureDateTime,
      lastArrivalTime: lastTrip.arrivalDateTime,
    }

    return {
      legs,
      markers,
      walkingConnections,
      summary,
    }
  }, [savedTrips, tripDetails, enabled])

  return { data, isLoading, error }
}
