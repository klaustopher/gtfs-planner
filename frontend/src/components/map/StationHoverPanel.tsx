import { useMemo } from 'react'
import { models } from '../../../wailsjs/go/models'
import { getTripColor } from './geojson'
import { useTranslation } from 'react-i18next'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faArrowRight } from '@fortawesome/free-solid-svg-icons'
import './StationHoverPanel.css'

// Format ISO 8601 datetime to HH:MM display
function formatTimeDisplay(isoDateTime: string, locale: string): string {
  const date = new Date(isoDateTime)
  return date.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' })
}

interface StationHoverPanelProps {
  stopId: string
  stopName: string
  screenX: number
  screenY: number
  trips: models.UpcomingTrip[]
  onTripSelect: (
    trip: models.UpcomingTrip,
    tripIndex: number,
    displayColor: string,
    destinationStopId: string,
    destinationStopName: string,
    arrivalDateTime: string
  ) => void
  onMouseEnter?: () => void
  onMouseLeave?: () => void
}

interface TripToStation {
  trip: models.UpcomingTrip
  tripIndex: number
  arrivalDateTime: string
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
  const { i18n } = useTranslation()
  const resolvedLanguage = i18n.language || i18n.resolvedLanguage || 'en'
  // Find trips that pass through this station and get their arrival datetimes
  const tripsToStation = useMemo(() => {
    const result: TripToStation[] = []

    trips.forEach((trip, tripIndex) => {
      // Look for this stop in the trip's stop times
      const stopTime = trip.stop_times.find(st => st.stop_id === stopId)
      if (stopTime) {
        result.push({
          trip,
          tripIndex,
          arrivalDateTime: stopTime.arrival_datetime || stopTime.departure_datetime,
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
        {tripsToStation.map(({ trip, tripIndex, arrivalDateTime }) => {
          const tripColor = getTripColor(trip, tripIndex)
          return (
            <button
              key={`${trip.trip_id}-${stopId}`}
              className="station-hover-panel__trip-btn"
              onClick={() => onTripSelect(trip, tripIndex, tripColor, stopId, stopName, arrivalDateTime)}
            >
              <span
                className="station-hover-panel__badge"
                style={{ backgroundColor: tripColor }}
              >
                {trip.display_name || '?'}
              </span>
              <span className="station-hover-panel__times">
                <span className="station-hover-panel__dep">
                  {formatTimeDisplay(trip.departure_datetime, resolvedLanguage)}
                </span>
                <span className="station-hover-panel__arrow">
                  <FontAwesomeIcon icon={faArrowRight} />
                </span>
                <span className="station-hover-panel__arr">
                  {formatTimeDisplay(arrivalDateTime, resolvedLanguage)}
                </span>
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
