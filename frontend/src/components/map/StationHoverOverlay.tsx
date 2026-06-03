import StationHoverPanel from './StationHoverPanel'
import { HoveredStationInfo } from './types'
import { models } from '../../../wailsjs/go/models'

interface StationHoverOverlayProps {
  hoveredStation: HoveredStationInfo | null
  trips?: models.UpcomingTrip[]
  isViewingMode: boolean
  onTripSelect: (
    trip: models.UpcomingTrip,
    tripIndex: number,
    displayColor: string,
    destinationStopId: string,
    destinationStopName: string,
    arrivalTime: string
  ) => void
  onClose: () => void
}

export default function StationHoverOverlay({
  hoveredStation,
  trips,
  isViewingMode,
  onTripSelect,
  onClose,
}: StationHoverOverlayProps) {
  if (isViewingMode || !hoveredStation || !trips || trips.length === 0) {
    return null
  }

  return (
    <StationHoverPanel
      stopId={hoveredStation.stopId}
      stopName={hoveredStation.stopName}
      screenX={hoveredStation.screenX}
      screenY={hoveredStation.screenY}
      trips={trips}
      onTripSelect={onTripSelect}
      onClose={onClose}
    />
  )
}
