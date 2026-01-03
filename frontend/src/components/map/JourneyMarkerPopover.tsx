import { useTranslation } from 'react-i18next'
import type { JourneyMarker } from '../../hooks/useJourneyView'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faWalking } from '@fortawesome/free-solid-svg-icons'
import './JourneyMarkerPopover.css'

interface JourneyMarkerPopoverProps {
  marker: JourneyMarker
}

// Format ISO 8601 datetime to HH:MM display
function formatTime(isoDateTime: string, locale: string): string {
  const date = new Date(isoDateTime)
  return date.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' })
}

export default function JourneyMarkerPopover({ marker }: JourneyMarkerPopoverProps) {
  const { i18n, t } = useTranslation()
  const locale = i18n.language || 'en'

  // Determine the marker icon and class based on type
  const markerIcon = marker.type === 'start' ? '▶' : marker.type === 'end' ? '◼' : '⇄'
  const markerClass = `journey-marker journey-marker--${marker.type}`

  return (
    <div className={markerClass}>
      <div className="journey-marker__header">
        <span className="journey-marker__icon">{markerIcon}</span>
        <span className="journey-marker__station">{marker.stationName}</span>
      </div>

      <div className="journey-marker__details">
        {/* Arrival info - for transfer and end markers */}
        {marker.arrivalTime && (
          <div className="journey-marker__row journey-marker__row--arrival">
            <span className="journey-marker__label">{t('journeyMarker.arrival', 'Arr')}</span>
            <span className="journey-marker__time">{formatTime(marker.arrivalTime, locale)}</span>
            {marker.arrivalRouteShortName && (
              <span
                className="journey-marker__route"
                style={{ backgroundColor: marker.arrivalRouteColor ? `#${marker.arrivalRouteColor}` : '#666' }}
              >
                {marker.arrivalRouteShortName}
              </span>
            )}
            {marker.arrivalPlatform && (
              <span className="journey-marker__platform">
                {t('journeyMarker.platform', 'Pl.')} {marker.arrivalPlatform}
              </span>
            )}
          </div>
        )}

        {/* Walking indicator for walking transfers */}
        {marker.type === 'transfer' && marker.isWalkingTransfer && (
          <div className="journey-marker__walking">
            <span className="journey-marker__walking-icon">
              <FontAwesomeIcon icon={faWalking} />
            </span>
            <span className="journey-marker__walking-text">
              {marker.arrivalTime && !marker.departureTime
                ? t('journeyMarker.walkTo', 'Walk to next station')
                : t('journeyMarker.walkFrom', 'Footpath from previous station')}
            </span>
          </div>
        )}

        {/* Layover time for transfers */}
        {marker.type === 'transfer' && marker.layoverMinutes !== undefined && (
          <div className="journey-marker__layover">
            <span className="journey-marker__layover-time">
              {marker.layoverMinutes} {t('journeyMarker.minutes', 'min')}
            </span>
          </div>
        )}

        {/* Departure info - for start and transfer markers */}
        {marker.departureTime && (
          <div className="journey-marker__row journey-marker__row--departure">
            <span className="journey-marker__label">{t('journeyMarker.departure', 'Dep')}</span>
            <span className="journey-marker__time">{formatTime(marker.departureTime, locale)}</span>
            {marker.departureRouteShortName && (
              <span
                className="journey-marker__route"
                style={{ backgroundColor: marker.departureRouteColor ? `#${marker.departureRouteColor}` : '#666' }}
              >
                {marker.departureRouteShortName}
              </span>
            )}
            {marker.departurePlatform && (
              <span className="journey-marker__platform">
                {t('journeyMarker.platform', 'Pl.')} {marker.departurePlatform}
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
