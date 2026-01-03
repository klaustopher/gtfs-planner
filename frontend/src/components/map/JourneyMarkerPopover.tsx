import { useTranslation } from 'react-i18next'
import type { JourneyMarker } from '../../hooks/useJourneyView'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faWalking } from '@fortawesome/free-solid-svg-icons'
import './JourneyMarkerPopover.css'

interface JourneyMarkerPopoverProps {
  markers: JourneyMarker[]
  marker?: JourneyMarker // Deprecated, for backwards compatibility
}

// Format ISO 8601 datetime to HH:MM display
function formatTime(isoDateTime: string, locale: string): string {
  const date = new Date(isoDateTime)
  return date.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' })
}

export default function JourneyMarkerPopover({ markers, marker }: JourneyMarkerPopoverProps) {
  const { i18n, t } = useTranslation()
  const locale = i18n.language || 'en'

  // Support backwards compatibility
  const markerList = markers || (marker ? [marker] : [])

  if (markerList.length === 0) return null

  // Single marker case
  if (markerList.length === 1) {
    const singleMarker = markerList[0]
    const markerIcon = singleMarker.type === 'start' ? '▶' : singleMarker.type === 'end' ? '◼' : '⇄'
    const markerClass = `journey-marker journey-marker--${singleMarker.type}`

    return (
      <div className={markerClass}>
        <div className="journey-marker__header">
          <span className="journey-marker__icon">{markerIcon}</span>
          <span className="journey-marker__station">{singleMarker.stationName}</span>
        </div>

        <div className="journey-marker__details">
          {/* Arrival info - for transfer and end markers */}
          {singleMarker.arrivalTime && (
            <div className="journey-marker__row journey-marker__row--arrival">
              <span className="journey-marker__label">{t('journeyMarker.arrival', 'Arr')}</span>
              <span className="journey-marker__time">{formatTime(singleMarker.arrivalTime, locale)}</span>
              {singleMarker.arrivalRouteShortName && (
                <span
                  className="journey-marker__route"
                  style={{ backgroundColor: singleMarker.arrivalRouteColor ? `#${singleMarker.arrivalRouteColor}` : '#666' }}
                >
                  {singleMarker.arrivalRouteShortName}
                </span>
              )}
              {singleMarker.arrivalPlatform && (
                <span className="journey-marker__platform">
                  {t('journeyMarker.platform', 'Pl.')} {singleMarker.arrivalPlatform}
                </span>
              )}
            </div>
          )}

          {/* Walking indicator for walking transfers */}
          {singleMarker.type === 'transfer' && singleMarker.isWalkingTransfer && (
            <div className="journey-marker__walking">
              <span className="journey-marker__walking-icon">
                <FontAwesomeIcon icon={faWalking} />
              </span>
              <span className="journey-marker__walking-text">
                {singleMarker.arrivalTime && !singleMarker.departureTime
                  ? t('journeyMarker.walkTo', 'Walk to next station')
                  : t('journeyMarker.walkFrom', 'Footpath from previous station')}
              </span>
            </div>
          )}

          {/* Layover time for transfers */}
          {singleMarker.type === 'transfer' && singleMarker.layoverMinutes !== undefined && (
            <div className="journey-marker__layover">
              <span className="journey-marker__layover-time">
                {singleMarker.layoverMinutes} {t('journeyMarker.minutes', 'min')}
              </span>
            </div>
          )}

          {/* Departure info - for start and transfer markers */}
          {singleMarker.departureTime && (
            <div className="journey-marker__row journey-marker__row--departure">
              <span className="journey-marker__label">{t('journeyMarker.departure', 'Dep')}</span>
              <span className="journey-marker__time">{formatTime(singleMarker.departureTime, locale)}</span>
              {singleMarker.departureRouteShortName && (
                <span
                  className="journey-marker__route"
                  style={{ backgroundColor: singleMarker.departureRouteColor ? `#${singleMarker.departureRouteColor}` : '#666' }}
                >
                  {singleMarker.departureRouteShortName}
                </span>
              )}
              {singleMarker.departurePlatform && (
                <span className="journey-marker__platform">
                  {t('journeyMarker.platform', 'Pl.')} {singleMarker.departurePlatform}
                </span>
              )}
            </div>
          )}
        </div>
      </div>
    )
  }

  // Multiple markers (walking transfer with station change)
  const [firstMarker, secondMarker] = markerList

  // Calculate time difference between arrival and departure
  const calculateTimeDifference = (arrival: string, departure: string): number => {
    const arrivalDate = new Date(arrival)
    const departureDate = new Date(departure)
    return Math.round((departureDate.getTime() - arrivalDate.getTime()) / 60000) // Convert to minutes
  }

  const transferMinutes = firstMarker.arrivalTime && secondMarker.departureTime
    ? calculateTimeDifference(firstMarker.arrivalTime, secondMarker.departureTime)
    : (firstMarker.layoverMinutes ?? 0)

  return (
    <div className="journey-marker journey-marker--walking-group">
      <div className="journey-marker__header">
        <span className="journey-marker__icon">⇄</span>
        <span className="journey-marker__station">{t('journeyMarker.walkingTransfer', 'Umstieg mit Fußweg')}</span>
      </div>

      <div className="journey-marker__details">
        {/* First station - Arrival */}
        <div className="journey-marker__station-group">
          <div className="journey-marker__station-name">{firstMarker.stationName}</div>
          {firstMarker.arrivalTime && (
            <div className="journey-marker__row journey-marker__row--arrival">
              <span className="journey-marker__label">{t('journeyMarker.arrival', 'Ank')}</span>
              <span className="journey-marker__time">{formatTime(firstMarker.arrivalTime, locale)}</span>
              {firstMarker.arrivalRouteShortName && (
                <span
                  className="journey-marker__route"
                  style={{ backgroundColor: firstMarker.arrivalRouteColor ? `#${firstMarker.arrivalRouteColor}` : '#666' }}
                >
                  {firstMarker.arrivalRouteShortName}
                </span>
              )}
              {firstMarker.arrivalPlatform && (
                <span className="journey-marker__platform">
                  {t('journeyMarker.platform', 'Gl.')} {firstMarker.arrivalPlatform}
                </span>
              )}
            </div>
          )}
        </div>

        {/* Walking info */}
        <div className="journey-marker__walking-connector">
          <div className="journey-marker__walking">
            <span className="journey-marker__walking-icon">
              <FontAwesomeIcon icon={faWalking} />
            </span>
            <span className="journey-marker__walking-text">
              {transferMinutes} {t('journeyMarker.minutes', 'Min.')}
            </span>
          </div>
        </div>

        {/* Second station - Departure */}
        <div className="journey-marker__station-group">
          <div className="journey-marker__station-name">{secondMarker.stationName}</div>
          {secondMarker.departureTime && (
            <div className="journey-marker__row journey-marker__row--departure">
              <span className="journey-marker__label">{t('journeyMarker.departure', 'Abf')}</span>
              <span className="journey-marker__time">{formatTime(secondMarker.departureTime, locale)}</span>
              {secondMarker.departureRouteShortName && (
                <span
                  className="journey-marker__route"
                  style={{ backgroundColor: secondMarker.departureRouteColor ? `#${secondMarker.departureRouteColor}` : '#666' }}
                >
                  {secondMarker.departureRouteShortName}
                </span>
              )}
              {secondMarker.departurePlatform && (
                <span className="journey-marker__platform">
                  {t('journeyMarker.platform', 'Gl.')} {secondMarker.departurePlatform}
                </span>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
