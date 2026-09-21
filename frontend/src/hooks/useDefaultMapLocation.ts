import { useState, useCallback } from 'react'
import { GetUserLocation } from '../../wailsjs/go/main/App'

export interface MapLocation {
  longitude: number
  latitude: number
  zoom: number
}

export const FALLBACK_LOCATION: MapLocation = {
  longitude: 10.4515,
  latitude: 51.1657,
  zoom: 6,
}

export function useDefaultMapLocation() {
  const [isLoading, setIsLoading] = useState(false)

  const fetchLocation = useCallback((): Promise<MapLocation | null> => {
    setIsLoading(true)
    // Fetch location from Go backend
    return GetUserLocation()
      .then((result) => ({
        longitude: result.longitude,
        latitude: result.latitude,
        zoom: result.source === 'default' ? 6 : 12,
      }))
      .catch((error) => {
        console.warn('Failed to get location from backend:', error)
        return null
      })
      .finally(() => {
        setIsLoading(false)
      })
  }, [])

  return { fetchLocation, isLoading }
}
