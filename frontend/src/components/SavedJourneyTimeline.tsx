import { useTranslation } from 'react-i18next'
import { SavedTrip } from '../App'
import { getTransportTypeLabel } from '../utils/transportType'
import { formatTimeDisplay } from '../utils/time'
import { getContrastTextColor } from '../utils/colorContrast'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faTimes, faWalking } from '@fortawesome/free-solid-svg-icons'

interface SavedJourneyTimelineProps {
  savedTrips: SavedTrip[]
  isViewingMode: boolean
  onRemoveSavedTrip: (tripId: string) => void
  timeLocale: string
}

export default function SavedJourneyTimeline({
  savedTrips,
  isViewingMode,
  onRemoveSavedTrip,
  timeLocale,
}: SavedJourneyTimelineProps) {
  const { t } = useTranslation()

  if (savedTrips.length === 0) {
    return null
  }

  return (
    <div className="saved-trips-list">
      {savedTrips.map((trip, index) => {
        const nextTrip = savedTrips[index + 1]
        const hasFootpath = nextTrip && trip.endStationId !== nextTrip.startStationId

        let waitMinutes = 0
        if (isViewingMode && nextTrip) {
          const arrivalTime = new Date(trip.arrivalDateTime)
          const nextDepartureTime = new Date(nextTrip.departureDateTime)
          waitMinutes = Math.round((nextDepartureTime.getTime() - arrivalTime.getTime()) / 60000)
        }

        return (
          <div key={trip.id}>
            <div
              className="saved-trip-item"
              style={{ borderLeftColor: trip.displayColor }}
            >
              <div className="saved-trip-number">{index + 1}</div>
              <div className="saved-trip-content">
                <div className="saved-trip-route">
                  <span className="trip-type-badge">
                    {getTransportTypeLabel(trip.routeType, t)}
                  </span>
                  <span
                    className="trip-route-badge"
                    style={{
                      backgroundColor: trip.displayColor,
                      color: getContrastTextColor(trip.displayColor)
                    }}
                  >
                    {trip.routeShortName || '?'}
                  </span>
                </div>
                <div className="saved-trip-details">
                  <div className="saved-trip-leg">
                    <span className="saved-trip-time">{formatTimeDisplay(trip.departureDateTime, timeLocale)}</span>
                    <span className="saved-trip-station">{trip.startStationName}</span>
                  </div>
                  <div className="saved-trip-leg">
                    <span className="saved-trip-time">{formatTimeDisplay(trip.arrivalDateTime, timeLocale)}</span>
                    <span className="saved-trip-station">{trip.endStationName}</span>
                  </div>
                </div>
              </div>
              {index === savedTrips.length - 1 && (
                <button
                  className="remove-trip-btn"
                  onClick={() => onRemoveSavedTrip(trip.id)}
                  title={t('journey.removeTrip')}
                  aria-label={t('journey.removeTrip')}
                >
                  <FontAwesomeIcon icon={faTimes} />
                </button>
              )}
            </div>

            {nextTrip && (
              <div className="trip-connection">
                {hasFootpath && (
                  <div className="trip-connection__footpath">
                    <span className="trip-connection__icon">
                      <FontAwesomeIcon icon={faWalking} />
                    </span>
                    <span className="trip-connection__label">{t('journey.footpath')}</span>
                  </div>
                )}
                {isViewingMode && waitMinutes > 0 && (
                  <div className="trip-connection__wait">
                    <span className="trip-connection__time">{waitMinutes} min</span>
                  </div>
                )}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
