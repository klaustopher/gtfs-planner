import { useState, useEffect } from 'react'
import { models } from '../../wailsjs/go/models'
import { GetTripDetails } from '../../wailsjs/go/main/App'
import { normalizeColor, FALLBACK_COLORS } from './map/geojson'
import { getTransportTypeLabel } from '../utils/transportType'
import { useTranslation } from 'react-i18next'
import './TripDetailModal.css'

interface TripDetailModalProps {
  trip: models.UpcomingTrip
  tripIndex: number
  serviceDate: string // YYYYMMDD format
  onClose: () => void
  onTripSelection: (
    trip: models.UpcomingTrip,
    tripIndex: number,
    displayColor: string,
    destinationStopId: string,
    destinationStopName: string,
    arrivalDateTime: string
  ) => void
}

// Format ISO 8601 datetime to HH:MM display
function formatTimeDisplay(isoDateTime: string, locale: string): string {
  const date = new Date(isoDateTime)
  return date.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' })
}

export default function TripDetailModal({
  trip,
  tripIndex,
  serviceDate,
  onClose,
  onTripSelection,
}: TripDetailModalProps) {
  const [tripDetails, setTripDetails] = useState<models.TripDetails | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [hasError, setHasError] = useState(false)
  const { t, i18n } = useTranslation()
  const resolvedLanguage = i18n.language || i18n.resolvedLanguage || 'en'

  const normalizedColor = normalizeColor(trip.route_color)
  const tripColor = normalizedColor ?? FALLBACK_COLORS[tripIndex % FALLBACK_COLORS.length]

  // Fetch full trip details when modal opens
  useEffect(() => {
    setIsLoading(true)
    setHasError(false)

    GetTripDetails(trip.trip_id, serviceDate)
      .then((details) => {
        setTripDetails(details)
        setIsLoading(false)
      })
      .catch((err) => {
        console.error('Failed to fetch trip details:', err)
        setHasError(true)
        setIsLoading(false)
      })
  }, [trip.trip_id, serviceDate])

  // Handle click on backdrop to close
  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose()
    }
  }

  // Handle escape key to close
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      onClose()
    }
  }

  // Use fetched details if available, fallback to partial trip data
  const displayName = tripDetails?.display_name || trip.display_name || '?'
  const destination = tripDetails?.destination || trip.destination
  const stopTimes = tripDetails?.stop_times || trip.stop_times

  return (
    <div
      className="trip-detail-modal-backdrop"
      onClick={handleBackdropClick}
      onKeyDown={handleKeyDown}
      tabIndex={-1}
    >
      <div className="trip-detail-modal">
        <div className="trip-detail-modal__header">
          <div className="trip-detail-modal__title">
            <span className="trip-detail-modal__type-badge">
              {getTransportTypeLabel(trip.route_type, t)}
            </span>
            <span
              className="trip-detail-modal__badge"
              style={{ backgroundColor: tripColor }}
            >
              {displayName}
            </span>
            <span className="trip-detail-modal__destination">{destination}</span>
          </div>
          <button className="trip-detail-modal__close" onClick={onClose} aria-label={t('tripModal.close')}>
            ×
          </button>
        </div>

        <div className="trip-detail-modal__stops">
          {isLoading && (
            <div className="trip-detail-modal__loading">{t('tripModal.loading')}</div>
          )}
          {hasError && (
            <div className="trip-detail-modal__error">{t('tripModal.error')}</div>
          )}
          {!isLoading && !hasError && (() => {
            // Use the trip's actual start station (may be nearby station) for determining clickable stops
            const boardingStationId = trip.start_station_id
            const boardingIndex = stopTimes.findIndex(st => st.stop_id === boardingStationId)

            return stopTimes.map((stopTime, index) => {
              const isBoarding = stopTime.stop_id === boardingStationId
              const isFirst = index === 0
              const isLast = index === stopTimes.length - 1
              // Stops after boarding station are clickable
              const isClickable = boardingIndex >= 0 && index > boardingIndex

              const handleStopClick = () => {
                if (isClickable) {
                  onTripSelection(trip, tripIndex, tripColor, stopTime.stop_id, stopTime.stop_name, stopTime.arrival_datetime)
                  onClose()
                }
              }

              const stopContent = (
                <>
                  <div className="trip-detail-modal__stop-indicator">
                    <div
                      className={`trip-detail-modal__stop-dot ${isFirst ? 'trip-detail-modal__stop-dot--first' : ''} ${isLast ? 'trip-detail-modal__stop-dot--last' : ''}`}
                      style={{ borderColor: tripColor, backgroundColor: isBoarding ? tripColor : undefined }}
                    />
                    {!isLast && (
                      <div
                        className="trip-detail-modal__stop-line"
                        style={{ backgroundColor: tripColor }}
                      />
                    )}
                  </div>
                  <div className="trip-detail-modal__stop-times">
                    <span className="trip-detail-modal__stop-arr">
                      {isFirst ? '' : formatTimeDisplay(stopTime.arrival_datetime, resolvedLanguage)}
                    </span>
                    <span className="trip-detail-modal__stop-dep">
                      {isLast ? '' : formatTimeDisplay(stopTime.departure_datetime, resolvedLanguage)}
                    </span>
                  </div>
                  <div className="trip-detail-modal__stop-name">
                    {stopTime.stop_name}
                  </div>
                </>
              )

              return isClickable ? (
                <button
                  key={`${stopTime.stop_id}-${stopTime.stop_sequence}`}
                  type="button"
                  className="trip-detail-modal__stop trip-detail-modal__stop--clickable"
                  onClick={handleStopClick}
                  title={t('tripModal.selectStopTooltip')}
                >
                  {stopContent}
                </button>
              ) : (
                <div
                  key={`${stopTime.stop_id}-${stopTime.stop_sequence}`}
                  className={`trip-detail-modal__stop ${isBoarding ? 'trip-detail-modal__stop--selected' : ''}`}
                >
                  {stopContent}
                </div>
              )
            })
          })()}
        </div>
      </div>
    </div>
  )
}
