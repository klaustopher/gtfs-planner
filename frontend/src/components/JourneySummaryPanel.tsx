import { useTranslation } from 'react-i18next'
import type { JourneySummary } from '../hooks/useJourneyView'
import './JourneySummaryPanel.css'

interface JourneySummaryPanelProps {
  summary: JourneySummary
  isLoading: boolean
}

// Format ISO 8601 datetime to HH:MM display
function formatTime(isoDateTime: string, locale: string): string {
  const date = new Date(isoDateTime)
  return date.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' })
}

// Format minutes to hours and minutes
function formatDuration(minutes: number): string {
  const hours = Math.floor(minutes / 60)
  const mins = minutes % 60
  if (hours === 0) {
    return `${mins} min`
  }
  if (mins === 0) {
    return `${hours} h`
  }
  return `${hours} h ${mins} min`
}

export default function JourneySummaryPanel({ summary, isLoading }: JourneySummaryPanelProps) {
  const { t, i18n } = useTranslation()
  const timeLocale = i18n.language || 'en'

  if (isLoading) {
    return (
      <div className="journey-summary">
        <div className="journey-summary__loading">
          {t('journeySummary.loading')}
        </div>
      </div>
    )
  }

  return (
    <div className="journey-summary">
      <div className="journey-summary__times">
        <div className="journey-summary__time-block">
          <span className="journey-summary__time-label">{t('journeySummary.departure')}</span>
          <span className="journey-summary__time-value">
            {formatTime(summary.firstDepartureTime, timeLocale)}
          </span>
        </div>
        <div className="journey-summary__arrow">→</div>
        <div className="journey-summary__time-block">
          <span className="journey-summary__time-label">{t('journeySummary.arrival')}</span>
          <span className="journey-summary__time-value">
            {formatTime(summary.lastArrivalTime, timeLocale)}
          </span>
        </div>
      </div>

      <div className="journey-summary__stats">
        <div className="journey-summary__stat">
          <span className="journey-summary__stat-value">
            {formatDuration(summary.totalTravelMinutes)}
          </span>
          <span className="journey-summary__stat-label">{t('journeySummary.totalTime')}</span>
        </div>
        <div className="journey-summary__stat">
          <span className="journey-summary__stat-value">{summary.numberOfLegs}</span>
          <span className="journey-summary__stat-label">
            {summary.numberOfLegs === 1 ? t('journeySummary.leg') : t('journeySummary.legs')}
          </span>
        </div>
        {summary.numberOfTransfers > 0 && (
          <div className="journey-summary__stat">
            <span className="journey-summary__stat-value">{summary.numberOfTransfers}</span>
            <span className="journey-summary__stat-label">
              {summary.numberOfTransfers === 1
                ? t('journeySummary.transfer')
                : t('journeySummary.transfers')}
            </span>
          </div>
        )}
        {summary.numberOfWalkingConnections > 0 && (
          <div className="journey-summary__stat journey-summary__stat--walking">
            <span className="journey-summary__stat-value">{summary.numberOfWalkingConnections}</span>
            <span className="journey-summary__stat-label">
              {summary.numberOfWalkingConnections === 1
                ? t('journeySummary.walkingConnection')
                : t('journeySummary.walkingConnections')}
            </span>
          </div>
        )}
      </div>
    </div>
  )
}
