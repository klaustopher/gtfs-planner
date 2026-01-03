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

// Format minutes to hours and minutes in time format (e.g., "22:45h")
function formatDuration(minutes: number): string {
  const hours = Math.floor(minutes / 60)
  const mins = minutes % 60
  const paddedMins = mins.toString().padStart(2, '0')
  return `${hours}:${paddedMins}h`
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
      <div className="journey-summary__stats">
        <div className="journey-summary__stat">
          <span className="journey-summary__stat-label">{t('journeySummary.departure')}</span>
          <span className="journey-summary__stat-value">
            {formatTime(summary.firstDepartureTime, timeLocale)}
          </span>
        </div>
        <div className="journey-summary__stat">
          <span className="journey-summary__stat-label">{t('journeySummary.arrival')}</span>
          <span className="journey-summary__stat-value">
            {formatTime(summary.lastArrivalTime, timeLocale)}
          </span>
        </div>
        <div className="journey-summary__stat">
          <span className="journey-summary__stat-label">
            {summary.numberOfLegs === 1 ? t('journeySummary.leg') : t('journeySummary.legs')}
          </span>
          <span className="journey-summary__stat-value">{summary.numberOfLegs}</span>
        </div>
        <div className="journey-summary__stat">
          <span className="journey-summary__stat-label">{t('journeySummary.totalTime')}</span>
          <span className="journey-summary__stat-value">
            {formatDuration(summary.totalTravelMinutes)}
          </span>
        </div>
      </div>
    </div>
  )
}
