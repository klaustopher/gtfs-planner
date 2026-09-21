import { useState, useEffect, useCallback, useMemo } from 'react'
import { GetUpcomingTripsForStations } from '../../../wailsjs/go/main/App'
import { models } from '../../../wailsjs/go/models'

export interface TripQueryParams {
  stopIds: string[] // Array of station IDs to query
  datetime: string // ISO 8601 format: "2006-01-02T15:04:05"
  limit?: number
  routeTypes?: number[] // Optional filter for specific GTFS route types
}

export interface UseTripsResult {
  tripsData: models.UpcomingTripsData | null
  isLoading: boolean
  error: string | null
  refetch: () => void
}

interface TripQuery {
  stopIds: string[]
  datetime: string
  limit: number
  routeTypes: number[]
}

interface LoadedTrips {
  key: string
  data: models.UpcomingTripsData | null
  error: string | null
}

const DEFAULT_LIMIT = 10

function buildQuery(params: TripQueryParams | null): TripQuery | null {
  if (!params) {
    return null
  }

  const { stopIds, datetime, limit = DEFAULT_LIMIT, routeTypes = [] } = params
  if (!stopIds || stopIds.length === 0 || !datetime) {
    return null
  }

  return { stopIds, datetime, limit, routeTypes }
}

export function useTrips(params: TripQueryParams | null): UseTripsResult {
  const [loaded, setLoaded] = useState<LoadedTrips | null>(null)
  const [refetchTrigger, setRefetchTrigger] = useState(0)

  const query = useMemo(() => buildQuery(params), [params])
  const key = query ? `${refetchTrigger}:${JSON.stringify(query)}` : null

  const refetch = useCallback(() => {
    setRefetchTrigger((prev) => prev + 1)
  }, [])

  useEffect(() => {
    if (!query || !key) {
      return
    }

    let cancelled = false

    GetUpcomingTripsForStations(query.stopIds, query.datetime, query.limit, query.routeTypes)
      .then((data) => {
        if (!cancelled) {
          setLoaded({ key, data, error: null })
        }
      })
      .catch((err) => {
        console.error('Failed to fetch upcoming trips:', err)
        if (!cancelled) {
          setLoaded({ key, data: null, error: err?.message || 'Failed to fetch trips' })
        }
      })

    return () => {
      cancelled = true
    }
  }, [key, query])

  const current = loaded?.key === key ? loaded : null

  return {
    tripsData: current?.data ?? null,
    isLoading: key !== null && current === null,
    error: current?.error ?? null,
    refetch,
  }
}
