import { useState, useEffect } from 'react'
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

interface LoadedStops {
  key: string
  stops: models.Stop[]
}

export function useStops({
  zoom,
  bounds,
  zoomThreshold = 8,
  debounceMs = 300,
  enabled = true,
}: UseStopsOptions): UseStopsResult {
  const [loaded, setLoaded] = useState<LoadedStops | null>(null)

  const activeBounds = enabled && zoom >= zoomThreshold && bounds ? bounds : null
  const key = activeBounds ? JSON.stringify(activeBounds) : null

  useEffect(() => {
    if (!activeBounds || !key) {
      return
    }

    let cancelled = false
    const { north, south, east, west } = activeBounds

    const timer = window.setTimeout(() => {
      GetStops(north, south, east, west)
        .then((fetchedStops) => {
          if (!cancelled) {
            setLoaded({ key, stops: fetchedStops || [] })
          }
        })
        .catch((err) => {
          console.error('Failed to fetch stops:', err)
          if (!cancelled) {
            setLoaded((prev) => ({ key, stops: prev?.stops ?? [] }))
          }
        })
    }, debounceMs)

    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [key, activeBounds, debounceMs])

  return {
    stops: key === null ? [] : (loaded?.stops ?? []),
    isLoading: key !== null && loaded?.key !== key,
  }
}
