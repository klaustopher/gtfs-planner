import { useState, useRef, useCallback } from 'react'
import type { MapLayerMouseEvent } from 'maplibre-gl'
import { models } from '../../../../wailsjs/go/models'
import { HoveredStationInfo } from '../types'

interface UseHoverStationPanelOptions {
  selectedStation?: models.StationDetails | null
  tripsData?: models.UpcomingTripsData | null
  onTripSelection?: (
    trip: models.UpcomingTrip,
    tripIndex: number,
    displayColor: string,
    destinationStopId: string,
    destinationStopName: string,
    arrivalTime: string
  ) => void
}

export function useHoverStationPanel({
  selectedStation,
  tripsData,
  onTripSelection,
}: UseHoverStationPanelOptions) {
  const [hoveredStation, setHoveredStation] = useState<HoveredStationInfo | null>(null)
  const hoverTimeoutRef = useRef<number | null>(null)

  const handleMapMouseEnter = useCallback(
    (evt: MapLayerMouseEvent) => {
      if (hoverTimeoutRef.current !== null) {
        window.clearTimeout(hoverTimeoutRef.current)
        hoverTimeoutRef.current = null
      }

      if (!tripsData || !selectedStation) {
        return
      }

      const features = evt.features
      if (features && features.length > 0) {
        const feature = features[0]
        const stopId = feature.properties?.stop_id
        const stopName = feature.properties?.stop_name

        if (stopId && stopId !== selectedStation.stop_id) {
          setHoveredStation((prev) => {
            if (prev?.stopId === stopId) {
              return prev
            }
            return {
              stopId,
              stopName: stopName || stopId,
              screenX: evt.point.x,
              screenY: evt.point.y,
            }
          })
        }
      }
    },
    [selectedStation, tripsData]
  )

  const handleMapMouseLeave = useCallback(() => {
    hoverTimeoutRef.current = window.setTimeout(() => {
      setHoveredStation(null)
      hoverTimeoutRef.current = null
    }, 300)
  }, [])

  const handlePanelMouseEnter = useCallback(() => {
    if (hoverTimeoutRef.current !== null) {
      window.clearTimeout(hoverTimeoutRef.current)
      hoverTimeoutRef.current = null
    }
  }, [])

  const handlePanelMouseLeave = useCallback(() => {
    setHoveredStation(null)
  }, [])

  const handleHoverTripSelect = useCallback(
    (
      trip: models.UpcomingTrip,
      tripIndex: number,
      displayColor: string,
      destinationStopId: string,
      destinationStopName: string,
      arrivalTime: string
    ) => {
      setHoveredStation(null)
      if (onTripSelection) {
        onTripSelection(trip, tripIndex, displayColor, destinationStopId, destinationStopName, arrivalTime)
      }
    },
    [onTripSelection]
  )

  return {
    hoveredStation,
    handleMapMouseEnter,
    handleMapMouseLeave,
    handlePanelMouseEnter,
    handlePanelMouseLeave,
    handleHoverTripSelect,
  }
}
