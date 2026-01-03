import { useState } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faPlus, faFolderOpen, faSave, faFileExport, faCog } from '@fortawesome/free-solid-svg-icons'
import { models } from '../../wailsjs/go/models'
import { getTripColor } from './map/geojson'
import { getTransportTypeLabel } from '../utils/transportType'
import { SavedTrip } from '../App'
import { useTranslation } from 'react-i18next'
import SettingsModal from './SettingsModal'
import JourneySummaryPanel from './JourneySummaryPanel'
import JourneyExportModal from './JourneyExportModal'
import type { JourneyViewData } from '../hooks/useJourneyView'
import './Sidebar.css'

type PlanningMode = 'initial' | 'planning' | 'viewing'

interface SidebarProps {
  selectedStation: models.StationDetails | null
  tripsData: models.UpcomingTripsData | null
  isLoadingTrips: boolean
  savedTrips: SavedTrip[]
  onRemoveSavedTrip: (tripId: string) => void
  onTripClick: (trip: models.UpcomingTrip, tripIndex: number) => void
  hasUnsavedChanges: boolean
  currentFilePath: string | null
  onSaveJourney: () => void
  onLoadJourney: () => void
  onNewJourney: () => void
  planningMode: PlanningMode
  onEnterViewMode: () => void
  onReturnToPlanning: () => void
  journeyViewData: JourneyViewData | null
  isLoadingJourneyView: boolean
  journeyData: models.JourneyData | null
}

// Format ISO 8601 datetime to HH:MM display
function formatTimeDisplay(isoDateTime: string, locale: string): string {
  const date = new Date(isoDateTime)
  return date.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' })
}

export default function Sidebar({
  selectedStation,
  tripsData,
  isLoadingTrips,
  savedTrips,
  onRemoveSavedTrip,
  onTripClick,
  hasUnsavedChanges,
  currentFilePath,
  onSaveJourney,
  onLoadJourney,
  onNewJourney,
  planningMode,
  onEnterViewMode,
  onReturnToPlanning,
  journeyViewData,
  isLoadingJourneyView,
  journeyData,
}: SidebarProps) {
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)
  const [isExportModalOpen, setIsExportModalOpen] = useState(false)
  const { t, i18n } = useTranslation()
  const rawLanguage = i18n.resolvedLanguage || i18n.language || 'en'
  const resolvedLanguage = rawLanguage.split('-')[0]
  const timeLocale = i18n.language || rawLanguage

  // Derived values
  const isViewingMode = planningMode === 'viewing'

  const openSettings = () => setIsSettingsOpen(true)
  const closeSettings = () => setIsSettingsOpen(false)
  const openExportModal = () => setIsExportModalOpen(true)
  const closeExportModal = () => setIsExportModalOpen(false)

  return (
    <div className="sidebar">
      {/* Journey file actions */}
      {currentFilePath && (
        <div className="sidebar-filename">
          {currentFilePath.split('/').pop()}
        </div>
      )}
      <div className="journey-actions">
        <button
          className="journey-btn journey-btn--icon"
          onClick={onNewJourney}
          title={t('journey.actions.newTooltip')}
          aria-label={t('journey.actions.newTooltip')}
        >
          <FontAwesomeIcon icon={faPlus} />
        </button>
        <button
          className="journey-btn journey-btn--icon"
          onClick={onLoadJourney}
          title={t('journey.actions.loadTooltip')}
          aria-label={t('journey.actions.loadTooltip')}
        >
          <FontAwesomeIcon icon={faFolderOpen} />
        </button>
        <button
          className="journey-btn journey-btn--icon"
          onClick={onSaveJourney}
          disabled={savedTrips.length === 0}
          title={t('journey.actions.saveTooltip')}
          aria-label={t('journey.actions.saveTooltip')}
        >
          <FontAwesomeIcon icon={faSave} />
          {hasUnsavedChanges && savedTrips.length > 0 && <span className="journey-btn__indicator">*</span>}
        </button>
        <button
          className="journey-btn journey-btn--icon"
          onClick={openExportModal}
          disabled={savedTrips.length === 0}
          title={t('journey.actions.exportTooltip')}
          aria-label={t('journey.actions.exportTooltip')}
        >
          <FontAwesomeIcon icon={faFileExport} />
        </button>
        <button
          className="journey-btn journey-btn--icon"
          onClick={openSettings}
          title={t('settings.openButtonTooltip')}
          aria-label={t('settings.openButtonTooltip')}
        >
          <FontAwesomeIcon icon={faCog} />
        </button>
      </div>

      {/* Station & Departures (hidden when in journey view mode) */}
      {!isViewingMode && (
        <div className="sidebar-card sidebar-card--flex">
          <div className="sidebar-card__header">
            <h3 className="sidebar-card__title">
              {selectedStation ? selectedStation.stop_name : t('stationSection.selectPrompt')}
            </h3>
          </div>

          {!selectedStation && savedTrips.length === 0 && (
            <p className="sidebar-hint">{t('stationSection.initialHint')}</p>
          )}

          {!selectedStation && savedTrips.length > 0 && (
            <p className="sidebar-hint">{t('stationSection.hint')}</p>
          )}

          {selectedStation && (
            <div className="trips-section">
              {isLoadingTrips && <p className="sidebar-hint">{t('stationSection.loading')}</p>}
              {!isLoadingTrips && tripsData && tripsData.trips && tripsData.trips.length > 0 && (
                <div className="trips-list">
                  {tripsData.trips.map((trip: models.UpcomingTrip, index: number) => {
                    const tripColor = getTripColor(trip, index)
                    const isNearbyTrip = selectedStation && trip.start_station_id !== selectedStation.stop_id

                    return (
                      <button
                        key={trip.trip_id}
                        className="trip-item"
                        style={{ borderLeftColor: tripColor }}
                        onClick={() => onTripClick(trip, index)}
                        aria-label={isNearbyTrip ? t('stationSection.nearbyStationAria') : undefined}
                      >
                        <span className="trip-time">{formatTimeDisplay(trip.departure_datetime, timeLocale)}</span>
                        <div className="trip-details">
                          <div className="trip-badges">
                            <span className="trip-type-badge">
                              {getTransportTypeLabel(trip.route_type, t)}
                            </span>
                            {trip.display_name && (
                              <span
                                className="trip-route-badge"
                                style={{ backgroundColor: tripColor }}
                              >
                                {trip.display_name}
                              </span>
                            )}
                            {isNearbyTrip && (
                              <span className="trip-nearby-badge" title={trip.start_station_name}>
                                ↔ <span className="trip-nearby-station">{trip.start_station_name}</span>
                              </span>
                            )}
                          </div>
                          <span className="trip-destination">{trip.destination}</span>
                        </div>
                      </button>
                    )
                  })}
                </div>
              )}
              {!isLoadingTrips && tripsData && (!tripsData.trips || tripsData.trips.length === 0) && (
                <p className="sidebar-hint">{t('stationSection.empty')}</p>
              )}
            </div>
          )}
        </div>
      )}

      {/* Planned Journey - shown after station card in planning mode, or first in viewing mode */}
      {savedTrips.length > 0 && (
        <div className="sidebar-card">
          <div className="sidebar-card__header">
            <h3 className="sidebar-card__title">{t('journey.plannedTitle')}</h3>
            <div className="sidebar-card__actions">
              {!isViewingMode ? (
                <button
                  className="journey-view-btn"
                  onClick={onEnterViewMode}
                  disabled={savedTrips.length === 0}
                  title={t('journey.viewJourneyTooltip')}
                >
                  {t('journey.viewJourney')}
                </button>
              ) : (
                <button
                  className="journey-edit-btn"
                  onClick={onReturnToPlanning}
                  title={t('journey.returnToPlanningTooltip')}
                >
                  {t('journey.editJourney')}
                </button>
              )}
            </div>
          </div>

          {/* Journey Summary and trip list - only shown in viewing mode */}
          {isViewingMode && (
            <>
              {journeyViewData?.summary && (
                <JourneySummaryPanel
                  summary={journeyViewData.summary}
                  isLoading={isLoadingJourneyView}
                />
              )}

              <div className="saved-trips-list">
                {savedTrips.map((trip, index) => {
                  const nextTrip = savedTrips[index + 1]
                  const hasFootpath = nextTrip && trip.endStationId !== nextTrip.startStationId

                  // Calculate wait time if in viewing mode
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
                              style={{ backgroundColor: trip.displayColor }}
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
                            ×
                          </button>
                        )}
                      </div>

                      {/* Connection indicator between trips */}
                      {nextTrip && (
                        <div className="trip-connection">
                          {hasFootpath && (
                            <div className="trip-connection__footpath">
                              <span className="trip-connection__icon">🚶</span>
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
            </>
          )}
        </div>
      )}

      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={closeSettings}
      />
      {isExportModalOpen && journeyData && (
        <JourneyExportModal
          journeyData={journeyData}
          savedTrips={savedTrips}
          onClose={closeExportModal}
        />
      )}
    </div>
  )
}
