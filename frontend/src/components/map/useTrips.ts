import { useState, useEffect, useCallback } from 'react'
import { GetUpcomingTrips } from '../../../wailsjs/go/main/App'
import { models } from '../../../wailsjs/go/models'

export interface TripQueryParams {
  stopId: string
  datetime: string // ISO 8601 format: "2006-01-02T15:04:05"
  limit?: number
}

export interface UseTripsResult {
  tripsData: models.UpcomingTripsData | null
  isLoading: boolean
  error: string | null
  refetch: () => void
}

const DEFAULT_LIMIT = 10

export function useTrips(params: TripQueryParams | null): UseTripsResult {
  const [tripsData, setTripsData] = useState<models.UpcomingTripsData | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [refetchTrigger, setRefetchTrigger] = useState(0)

  const refetch = useCallback(() => {
    setRefetchTrigger((prev) => prev + 1)
  }, [])

  useEffect(() => {
    if (!params) {
      setTripsData(null)
      setError(null)
      return
    }

    const { stopId, datetime, limit = DEFAULT_LIMIT } = params

    if (!stopId || !datetime) {
      setTripsData(null)
      setError(null)
      return
    }

    setIsLoading(true)
    setError(null)

    GetUpcomingTrips(stopId, datetime, limit)
      .then((data) => {
        setTripsData(data)
        setError(null)
      })
      .catch((err) => {
        console.error('Failed to fetch upcoming trips:', err)
        setTripsData(null)
        setError(err?.message || 'Failed to fetch trips')
      })
      .finally(() => {
        setIsLoading(false)
      })
  }, [params?.stopId, params?.datetime, params?.limit, refetchTrigger])

  return { tripsData, isLoading, error, refetch }
}
