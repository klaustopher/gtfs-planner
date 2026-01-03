import { useState, useEffect, useRef } from 'react'
import { GetStops } from '../../../wailsjs/go/main/App'
import { models } from '../../../wailsjs/go/models'

export interface Bounds {
  north: number
  south: number
  east: number
  west: number
}

interface UseStopsOptions {
  zoom: number
  bounds: Bounds | undefined
  zoomThreshold?: number
  debounceMs?: number
  enabled?: boolean
}

export interface UseStopsResult {
  stops: models.Stop[]
  isLoading: boolean
}

export function useStops({
  zoom,
  bounds,
  zoomThreshold = 8,
  debounceMs = 300,
  enabled = true,
}: UseStopsOptions): UseStopsResult {
  const [stops, setStops] = useState<models.Stop[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const debounceTimerRef = useRef<number | null>(null)
  const requestIdRef = useRef(0)

  useEffect(() => {
    if (!enabled) {
      return
    }

    // Clear any pending debounce timer
    if (debounceTimerRef.current !== null) {
      window.clearTimeout(debounceTimerRef.current)
    }

    if (zoom >= zoomThreshold && bounds) {
      const { north, south, east, west } = bounds

      // Set loading state immediately when bounds change
      setIsLoading(true)

      // Debounce the fetch request
      debounceTimerRef.current = window.setTimeout(() => {
        // Increment request ID to track the latest request
        const currentRequestId = ++requestIdRef.current

        GetStops(north, south, east, west)
          .then((fetchedStops) => {
            // Only update if this is still the latest request
            if (currentRequestId === requestIdRef.current) {
              setStops(fetchedStops || [])
              setIsLoading(false)
            }
          })
          .catch((err) => {
            if (currentRequestId === requestIdRef.current) {
              console.error('Failed to fetch stops:', err)
              setIsLoading(false)
            }
          })
      }, debounceMs)
    } else {
      setStops([])
      setIsLoading(false)
    }

    // Cleanup on unmount or before next effect
    return () => {
      if (debounceTimerRef.current !== null) {
        window.clearTimeout(debounceTimerRef.current)
      }
    }
  }, [zoom, bounds, zoomThreshold, debounceMs, enabled])

  return { stops, isLoading }
}
