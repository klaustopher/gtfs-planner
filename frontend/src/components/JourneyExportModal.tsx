import { useState, useEffect } from 'react'
import { models } from '../../wailsjs/go/models'
import { ExportJourneyToICS, ExportJourneyToPDF, GetTripDetails } from '../../wailsjs/go/main/App'
import { getTransportTypeLabel } from '../utils/transportType'
import { useTranslation } from 'react-i18next'
import './JourneyExportModal.css'

interface JourneyExportModalProps {
  journeyData: models.JourneyData
  savedTrips: Array<{
    id: string
    tripId: string
    routeId: string
    routeType: number
    routeShortName: string
    routeColor: string
    startStationId: string
    startStationName: string
    departureDateTime: string
    endStationId: string
    endStationName: string
    arrivalDateTime: string
  }>
  onClose: () => void
}

// Format ISO 8601 datetime to HH:MM display
function formatTimeDisplay(isoDateTime: string, locale: string): string {
  const date = new Date(isoDateTime)
  return date.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' })
}

// Format ISO 8601 datetime to date display
function formatDateDisplay(isoDateTime: string, locale: string): string {
  const date = new Date(isoDateTime)
  return date.toLocaleDateString(locale, {
    weekday: 'short',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  })
}

// Calculate duration in minutes
function calculateDuration(start: string, end: string): number {
  const startDate = new Date(start)
  const endDate = new Date(end)
  return Math.round((endDate.getTime() - startDate.getTime()) / 60000)
}

// Format duration for display in time format (e.g., "22:45h")
function formatDuration(minutes: number): string {
  const hours = Math.floor(minutes / 60)
  const mins = minutes % 60
  const paddedMins = mins.toString().padStart(2, '0')
  return `${hours}:${paddedMins}h`
}

// Extract service date (YYYYMMDD) from ISO datetime
function extractServiceDate(isoDateTime: string): string {
  return isoDateTime.split('T')[0].replace(/-/g, '')
}

export default function JourneyExportModal({
  journeyData,
  savedTrips,
  onClose,
}: JourneyExportModalProps) {
  const { t, i18n } = useTranslation()
  const resolvedLanguage = i18n.language || i18n.resolvedLanguage || 'en'
  const [isExporting, setIsExporting] = useState(false)
  const [exportError, setExportError] = useState<string | null>(null)
  const [platformInfo, setPlatformInfo] = useState<Map<string, { departure: string; arrival: string }>>(new Map())

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

  // Fetch platform information for all trips
  useEffect(() => {
    const fetchPlatformInfo = async () => {
      const info = new Map<string, { departure: string; arrival: string }>()

      for (const trip of savedTrips) {
        try {
          const serviceDate = extractServiceDate(trip.departureDateTime)
          const tripDetails = await GetTripDetails(trip.tripId, serviceDate)

          // Find platform codes for boarding and alighting stops
          let departurePlatform = ''
          let arrivalPlatform = ''

          for (const st of tripDetails.stop_times) {
            if (st.stop_id === trip.startStationId) {
              departurePlatform = st.platform_code || ''
            }
            if (st.stop_id === trip.endStationId) {
              arrivalPlatform = st.platform_code || ''
            }
          }

          info.set(trip.id, {
            departure: departurePlatform,
            arrival: arrivalPlatform,
          })
        } catch (err) {
          console.error(`Failed to fetch platform info for trip ${trip.tripId}:`, err)
        }
      }

      setPlatformInfo(info)
    }

    fetchPlatformInfo()
  }, [savedTrips])

  // Export to ICS
  const handleExportICS = async () => {
    setIsExporting(true)
    setExportError(null)
    try {
      const filePath = await ExportJourneyToICS(journeyData)
      if (filePath) {
        console.log('Exported to ICS:', filePath)
      }
    } catch (err) {
      console.error('Failed to export to ICS:', err)
      setExportError(t('journey.export.error'))
    } finally {
      setIsExporting(false)
    }
  }

  // Export to PDF
  const handleExportPDF = async () => {
    setIsExporting(true)
    setExportError(null)
    try {
      const filePath = await ExportJourneyToPDF(journeyData)
      if (filePath) {
        console.log('Exported to PDF:', filePath)
      }
    } catch (err) {
      console.error('Failed to export to PDF:', err)
      setExportError(t('journey.export.error'))
    } finally {
      setIsExporting(false)
    }
  }

  // Calculate total duration
  const totalDuration = savedTrips.length > 0
    ? calculateDuration(
        savedTrips[0].departureDateTime,
        savedTrips[savedTrips.length - 1].arrivalDateTime
      )
    : 0

  return (
    <div
      className="journey-export-modal-backdrop"
      onClick={handleBackdropClick}
      onKeyDown={handleKeyDown}
      tabIndex={-1}
    >
      <div className="journey-export-modal">
        <div className="journey-export-modal__header">
          <h2 className="journey-export-modal__title">
            {t('journey.export.title')}
          </h2>
          <button
            className="journey-export-modal__close"
            onClick={onClose}
            aria-label={t('common.close')}
          >
            ×
          </button>
        </div>

        <div className="journey-export-modal__content">
          {/* Journey summary */}
          <div className="journey-export-modal__summary">
            <div className="journey-export-modal__summary-row">
              <span className="journey-export-modal__summary-label">
                {t('journey.export.tripCount')}:
              </span>
              <span className="journey-export-modal__summary-value">
                {savedTrips.length}
              </span>
            </div>
            <div className="journey-export-modal__summary-row">
              <span className="journey-export-modal__summary-label">
                {t('journey.export.totalDuration')}:
              </span>
              <span className="journey-export-modal__summary-value">
                {formatDuration(totalDuration)}
              </span>
            </div>
            {savedTrips.length > 0 && (
              <div className="journey-export-modal__summary-row">
                <span className="journey-export-modal__summary-label">
                  {t('journey.export.date')}:
                </span>
                <span className="journey-export-modal__summary-value">
                  {formatDateDisplay(savedTrips[0].departureDateTime, resolvedLanguage)}
                </span>
              </div>
            )}
          </div>

          {/* Trip list */}
          <div className="journey-export-modal__trips">
            {savedTrips.map((trip, index) => {
              const platforms = platformInfo.get(trip.id)
              return (
                <div key={trip.id} className="journey-export-modal__trip">
                  <div className="journey-export-modal__trip-header">
                    <span className="journey-export-modal__trip-number">
                      {index + 1}
                    </span>
                    <span className="journey-export-modal__trip-badge">
                      {getTransportTypeLabel(trip.routeType, t)}
                    </span>
                    <span
                      className="journey-export-modal__trip-route"
                      style={{ backgroundColor: `#${trip.routeColor}` }}
                    >
                      {trip.routeShortName}
                    </span>
                  </div>
                  <div className="journey-export-modal__trip-details">
                    <div className="journey-export-modal__trip-station">
                      <span className="journey-export-modal__trip-time">
                        {formatTimeDisplay(trip.departureDateTime, resolvedLanguage)}
                      </span>
                      <span className="journey-export-modal__trip-name">
                        {trip.startStationName}
                        {platforms?.departure && (
                          <span className="journey-export-modal__trip-platform">
                            {' '}({t('journeyMarker.platform')} {platforms.departure})
                          </span>
                        )}
                      </span>
                    </div>
                    <div className="journey-export-modal__trip-arrow">→</div>
                    <div className="journey-export-modal__trip-station">
                      <span className="journey-export-modal__trip-time">
                        {formatTimeDisplay(trip.arrivalDateTime, resolvedLanguage)}
                      </span>
                      <span className="journey-export-modal__trip-name">
                        {trip.endStationName}
                        {platforms?.arrival && (
                          <span className="journey-export-modal__trip-platform">
                            {' '}({t('journeyMarker.platform')} {platforms.arrival})
                          </span>
                        )}
                      </span>
                    </div>
                  </div>
                  <div className="journey-export-modal__trip-duration">
                    {formatDuration(
                      calculateDuration(trip.departureDateTime, trip.arrivalDateTime)
                    )}
                  </div>
                </div>
              )
            })}
          </div>

          {/* Export buttons */}
          <div className="journey-export-modal__actions">
            {exportError && (
              <div className="journey-export-modal__error">
                {exportError}
              </div>
            )}
            <button
              className="journey-export-modal__button journey-export-modal__button--ics"
              onClick={handleExportICS}
              disabled={isExporting || savedTrips.length === 0}
            >
              {isExporting ? t('journey.export.exporting') : t('journey.export.exportICS')}
            </button>
            <button
              className="journey-export-modal__button journey-export-modal__button--pdf"
              onClick={handleExportPDF}
              disabled={isExporting || savedTrips.length === 0}
            >
              {isExporting ? t('journey.export.exporting') : t('journey.export.exportPDF')}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
