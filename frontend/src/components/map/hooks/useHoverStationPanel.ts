import { useState, useCallback } from 'react'
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
  // The destination station whose booking panel is currently open (opened on
  // click, stays open until a connection is chosen or the user clicks away).
  const [panelStation, setPanelStation] = useState<HoveredStationInfo | null>(null)
  // Whether the cursor is over a station feature (for pointer feedback only).
  const [isHoveringStation, setIsHoveringStation] = useState(false)

  const handleMapMouseEnter = useCallback((evt: MapLayerMouseEvent) => {
    const stopId = evt.features?.[0]?.properties?.stop_id
    if (stopId) {
      setIsHoveringStation(true)
    }
  }, [])

  const handleMapMouseLeave = useCallback(() => {
    setIsHoveringStation(false)
  }, [])

  // Opens the booking panel for the clicked destination station. Returns true if
  // a panel was opened (so the caller can skip its other click handling).
  const openPanelForEvent = useCallback(
    (evt: MapLayerMouseEvent): boolean => {
      if (!tripsData || !selectedStation) {
        return false
      }
      const feature = evt.features?.[0]
      const stopId = feature?.properties?.stop_id
      const stopName = feature?.properties?.stop_name
      if (!stopId || stopId === selectedStation.stop_id) {
        return false
      }
      setPanelStation({
        stopId,
        stopName: stopName || stopId,
        screenX: evt.point.x,
        screenY: evt.point.y,
      })
      return true
    },
    [selectedStation, tripsData]
  )

  const closePanel = useCallback(() => {
    setPanelStation(null)
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
      setPanelStation(null)
      if (onTripSelection) {
        onTripSelection(trip, tripIndex, displayColor, destinationStopId, destinationStopName, arrivalTime)
      }
    },
    [onTripSelection]
  )

  return {
    hoveredStation: panelStation,
    isHoveringStation,
    handleMapMouseEnter,
    handleMapMouseLeave,
    openPanelForEvent,
    closePanel,
    handleHoverTripSelect,
  }
}
