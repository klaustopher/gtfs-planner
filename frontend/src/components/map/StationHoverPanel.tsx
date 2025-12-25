import { useMemo } from 'react'
import { models } from '../../../wailsjs/go/models'
import { getTripColor } from './geojson'
import './StationHoverPanel.css'

interface StationHoverPanelProps {
  stopId: string
  stopName: string
  screenX: number
  screenY: number
  trips: models.UpcomingTrip[]
  onTripSelect: (
    trip: models.UpcomingTrip,
    destinationStopId: string,
    destinationStopName: string,
    arrivalTime: string
  ) => void
  onMouseEnter?: () => void
  onMouseLeave?: () => void
}

interface TripToStation {
  trip: models.UpcomingTrip
  tripIndex: number
  arrivalTime: string
}

export default function StationHoverPanel({
  stopId,
  stopName,
  screenX,
  screenY,
  trips,
  onTripSelect,
  onMouseEnter,
  onMouseLeave,
}: StationHoverPanelProps) {
  // Find trips that pass through this station and get their arrival times
  const tripsToStation = useMemo(() => {
    const result: TripToStation[] = []

    trips.forEach((trip, tripIndex) => {
      // Look for this stop in the trip's stop times
      const stopTime = trip.stop_times.find(st => st.stop_id === stopId)
      if (stopTime) {
        result.push({
          trip,
          tripIndex,
          arrivalTime: stopTime.arrival_time || stopTime.departure_time,
        })
      }
    })

    return result
  }, [trips, stopId])

  if (tripsToStation.length === 0) {
    return null
  }

  // Calculate panel position - try to keep it within viewport
  const panelStyle: React.CSSProperties = {
    position: 'absolute',
    left: screenX + 10,
    top: screenY - 10,
    zIndex: 1000,
  }

  return (
    <div
      className="station-hover-panel"
      style={panelStyle}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      <div className="station-hover-panel__header">
        <span className="station-hover-panel__name">{stopName}</span>
      </div>
      <div className="station-hover-panel__trips">
        {tripsToStation.map(({ trip, tripIndex, arrivalTime }) => {
          const tripColor = getTripColor(trip, tripIndex)
          return (
            <button
              key={`${trip.trip_id}-${stopId}`}
              className="station-hover-panel__trip-btn"
              onClick={() => onTripSelect(trip, stopId, stopName, arrivalTime)}
            >
              <span
                className="station-hover-panel__badge"
                style={{ backgroundColor: tripColor }}
              >
                {trip.display_name || '?'}
              </span>
              <span className="station-hover-panel__times">
                <span className="station-hover-panel__dep">
                  {trip.departure_time.slice(0, 5)}
                </span>
                <span className="station-hover-panel__arrow">→</span>
                <span className="station-hover-panel__arr">
                  {arrivalTime.slice(0, 5)}
                </span>
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
