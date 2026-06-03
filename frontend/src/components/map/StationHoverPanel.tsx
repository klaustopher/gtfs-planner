import { useMemo } from 'react'
import { models } from '../../../wailsjs/go/models'
import { getTripColor } from './geojson'
import { getTransportTypeIcon } from '../../utils/transportType'
import { useTranslation } from 'react-i18next'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faArrowRight, faArrowRightLong, faTimes } from '@fortawesome/free-solid-svg-icons'
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
  onClose: () => void
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
  onClose,
}: StationHoverPanelProps) {
  const { t, i18n } = useTranslation()
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
    <div className="station-hover-panel" style={panelStyle}>
      <div className="station-hover-panel__header">
        <span className="station-hover-panel__to">
          <FontAwesomeIcon icon={faArrowRightLong} />
        </span>
        <span className="station-hover-panel__name">{stopName}</span>
        <button
          type="button"
          className="station-hover-panel__close"
          onClick={onClose}
          aria-label={t('map.search.clearButton')}
        >
          <FontAwesomeIcon icon={faTimes} />
        </button>
      </div>
      <div className="station-hover-panel__prompt">{t('map.hoverPanel.prompt')}</div>
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
                <FontAwesomeIcon
                  className="station-hover-panel__badge-icon"
                  icon={getTransportTypeIcon(trip.route_type)}
                />
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
