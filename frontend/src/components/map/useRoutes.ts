import { useState, useEffect } from 'react'
import { GetRoutesForStation } from '../../../wailsjs/go/main/App'
import { models } from '../../../wailsjs/go/models'

export function useRoutes(
  selectedStation: models.StationDetails | null
): models.RoutesData | null {
  const [routesData, setRoutesData] = useState<models.RoutesData | null>(null)

  useEffect(() => {
    if (selectedStation) {
      GetRoutesForStation(selectedStation.stop_id)
        .then((data) => {
          setRoutesData(data)
        })
        .catch((err) => {
          console.error('Failed to fetch routes data:', err)
          setRoutesData(null)
        })
    } else {
      setRoutesData(null)
    }
  }, [selectedStation])

  return routesData
}
