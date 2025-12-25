import { useState, useEffect } from 'react'
import { models } from '../../wailsjs/go/models'
import { GetTripDetails } from '../../wailsjs/go/main/App'
import { normalizeColor, FALLBACK_COLORS } from './map/geojson'
import './TripDetailModal.css'

interface TripDetailModalProps {
  trip: models.UpcomingTrip
  tripIndex: number
  selectedStationId: string
  serviceDate: string // YYYYMMDD format
  onClose: () => void
}

// Format ISO 8601 datetime to HH:MM display
function formatTimeDisplay(isoDateTime: string): string {
  const date = new Date(isoDateTime)
  return date.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })
}

export default function TripDetailModal({
  trip,
  tripIndex,
  selectedStationId,
  serviceDate,
  onClose,
}: TripDetailModalProps) {
  const [tripDetails, setTripDetails] = useState<models.TripDetails | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const normalizedColor = normalizeColor(trip.route_color)
  const tripColor = normalizedColor ?? FALLBACK_COLORS[tripIndex % FALLBACK_COLORS.length]

  // Fetch full trip details when modal opens
  useEffect(() => {
    setIsLoading(true)
    setError(null)

    GetTripDetails(trip.trip_id, serviceDate)
      .then((details) => {
        setTripDetails(details)
        setIsLoading(false)
      })
      .catch((err) => {
        console.error('Failed to fetch trip details:', err)
        setError('Failed to load trip details')
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
            <span
              className="trip-detail-modal__badge"
              style={{ backgroundColor: tripColor }}
            >
              {displayName}
            </span>
            <span className="trip-detail-modal__destination">{destination}</span>
          </div>
          <button className="trip-detail-modal__close" onClick={onClose}>
            ×
          </button>
        </div>

        <div className="trip-detail-modal__stops">
          {isLoading && (
            <div className="trip-detail-modal__loading">Loading trip details...</div>
          )}
          {error && (
            <div className="trip-detail-modal__error">{error}</div>
          )}
          {!isLoading && !error && stopTimes.map((stopTime, index) => {
            const isSelected = stopTime.stop_id === selectedStationId
            const isFirst = index === 0
            const isLast = index === stopTimes.length - 1

            return (
              <div
                key={`${stopTime.stop_id}-${stopTime.stop_sequence}`}
                className={`trip-detail-modal__stop ${isSelected ? 'trip-detail-modal__stop--selected' : ''}`}
              >
                <div className="trip-detail-modal__stop-indicator">
                  <div
                    className={`trip-detail-modal__stop-dot ${isFirst ? 'trip-detail-modal__stop-dot--first' : ''} ${isLast ? 'trip-detail-modal__stop-dot--last' : ''}`}
                    style={{ borderColor: tripColor, backgroundColor: isSelected ? tripColor : undefined }}
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
                    {isFirst ? '' : formatTimeDisplay(stopTime.arrival_datetime)}
                  </span>
                  <span className="trip-detail-modal__stop-dep">
                    {isLast ? '' : formatTimeDisplay(stopTime.departure_datetime)}
                  </span>
                </div>
                <div className="trip-detail-modal__stop-name">
                  {stopTime.stop_name}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
