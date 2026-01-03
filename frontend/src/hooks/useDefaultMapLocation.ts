import { useState, useEffect, useRef } from 'react'
import { GetUserLocation } from '../../wailsjs/go/main/App'

const FALLBACK_LOCATION = {
  longitude: 10.4515,
  latitude: 51.1657,
  zoom: 6,
}

export function useDefaultMapLocation() {
  const [location, setLocation] = useState(FALLBACK_LOCATION)
  const fetchedRef = useRef(false)

  useEffect(() => {
    // Prevent double fetching in React Strict Mode
    if (fetchedRef.current) {
      return
    }
    fetchedRef.current = true

    // Fetch location from Go backend
    GetUserLocation()
      .then((result) => {
        const newLocation = {
          longitude: result.longitude,
          latitude: result.latitude,
          zoom: result.source === 'default' ? 6 : 12,
        }
        setLocation(newLocation)
      })
      .catch((error) => {
        console.warn('Failed to get location from backend:', error)
        // Keep fallback location
      })
  }, [])

  return location
}
