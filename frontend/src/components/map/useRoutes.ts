import { useState, useEffect } from 'react'
import { GetRoutesForStation } from '../../../bindings/gtfs-planner/app'
import * as models from '../../../bindings/gtfs-planner/internal/models'

interface LoadedRoutes {
  stopId: string
  data: models.RoutesData | null
}

export function useRoutes(
  selectedStation: models.StationDetails | null
): models.RoutesData | null {
  const stopId = selectedStation?.stop_id ?? null
  const [loaded, setLoaded] = useState<LoadedRoutes | null>(null)

  useEffect(() => {
    if (!stopId) {
      return
    }

    let cancelled = false

    GetRoutesForStation(stopId)
      .then((data) => {
        if (!cancelled) {
          setLoaded({ stopId, data })
        }
      })
      .catch((err) => {
        console.error('Failed to fetch routes data:', err)
        if (!cancelled) {
          setLoaded({ stopId, data: null })
        }
      })

    return () => {
      cancelled = true
    }
  }, [stopId])

  return loaded?.stopId === stopId ? loaded.data : null
}
