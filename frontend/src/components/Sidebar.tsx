import { useState } from 'react'
import { models } from '../../wailsjs/go/models'
import { getTripColor } from './map/geojson'
import { getTransportTypeLabel } from '../utils/transportType'
import { SavedTrip } from '../App'
import { useTranslation } from 'react-i18next'
import SettingsModal from './SettingsModal'
import './Sidebar.css'

interface SidebarProps {
  selectedStation: models.StationDetails | null
  tripsData: models.UpcomingTripsData | null
  isLoadingTrips: boolean
  savedTrips: SavedTrip[]
  onRemoveSavedTrip: (tripId: string) => void
  onClearSavedTrips: () => void
  onTripClick: (trip: models.UpcomingTrip, tripIndex: number) => void
  hasUnsavedChanges: boolean
  currentFilePath: string | null
  onSaveJourney: () => void
  onLoadJourney: () => void
  onNewJourney: () => void
  nearbyStationRadius: number
  onNearbyStationRadiusChange: (radius: number) => void
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
  onClearSavedTrips,
  onTripClick,
  hasUnsavedChanges,
  currentFilePath,
  onSaveJourney,
  onLoadJourney,
  onNewJourney,
  nearbyStationRadius,
  onNearbyStationRadiusChange,
}: SidebarProps) {
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)
  const { t, i18n } = useTranslation()
  const rawLanguage = i18n.resolvedLanguage || i18n.language || 'en'
  const resolvedLanguage = rawLanguage.split('-')[0]
  const timeLocale = i18n.language || rawLanguage

  const openSettings = () => setIsSettingsOpen(true)
  const closeSettings = () => setIsSettingsOpen(false)

  return (
    <div className="sidebar">
      {/* Journey file actions */}
      <div className="sidebar-card">
        <div className="sidebar-card__header">
          <h3 className="sidebar-card__title">{t('journey.title')}</h3>
          {currentFilePath && (
            <span className="sidebar-card__subtitle">
              {currentFilePath.split('/').pop()}
            </span>
          )}
        </div>
        <div className="journey-actions">
          <button
            className="journey-btn journey-btn--secondary"
            onClick={onNewJourney}
            title={t('journey.actions.newTooltip')}
          >
            {t('journey.actions.new')}
          </button>
          <button
            className="journey-btn journey-btn--secondary"
            onClick={onLoadJourney}
            title={t('journey.actions.loadTooltip')}
          >
            {t('journey.actions.load')}
          </button>
          <button
            className="journey-btn journey-btn--primary"
            onClick={onSaveJourney}
            disabled={savedTrips.length === 0}
            title={t('journey.actions.saveTooltip')}
          >
            {t('journey.actions.save')}
            {hasUnsavedChanges && savedTrips.length > 0 && <span className="journey-btn__indicator">*</span>}
          </button>
        </div>
      </div>

      {/* Planned Journey */}
      {savedTrips.length > 0 && (
        <div className="sidebar-card">
          <div className="sidebar-card__header">
            <h3 className="sidebar-card__title">{t('journey.plannedTitle')}</h3>
            <button className="clear-trips-btn" onClick={onClearSavedTrips}>
              {t('journey.clearSaved')}
            </button>
          </div>
          <div className="saved-trips-list">
            {savedTrips.map((trip, index) => (
              <div
                key={trip.id}
                className="saved-trip-item"
                style={{ borderLeftColor: trip.routeColor ? `#${trip.routeColor}` : '#666' }}
              >
                <div className="saved-trip-number">{index + 1}</div>
                <div className="saved-trip-content">
                  <div className="saved-trip-route">
                    <span className="trip-type-badge">
                      {getTransportTypeLabel(trip.routeType, t)}
                    </span>
                    <span
                      className="trip-route-badge"
                      style={{ backgroundColor: trip.routeColor ? `#${trip.routeColor}` : '#666' }}
                    >
                      {trip.routeShortName || '?'}
                    </span>
                  </div>
                  <div className="saved-trip-details">
                    <div className="saved-trip-leg">
                      <span className="saved-trip-time">{formatTimeDisplay(trip.departureDateTime, timeLocale)}</span>
                      <span className="saved-trip-station">{trip.startStationName}</span>
                    </div>
                    <div className="saved-trip-arrow">→</div>
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
            ))}
          </div>
        </div>
      )}

      {/* Station & Departures */}
      <div className="sidebar-card sidebar-card--flex">
        <div className="sidebar-card__header">
          <h3 className="sidebar-card__title">
            {selectedStation ? selectedStation.stop_name : t('stationSection.selectPrompt')}
          </h3>
        </div>

        {!selectedStation && (
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
      <div className="sidebar-footer">
        <button
          className="settings-btn"
          onClick={openSettings}
          title={t('settings.openButtonTooltip')}
          aria-label={t('settings.openButtonTooltip')}
        >
          <span className="settings-btn__icon" aria-hidden="true">⚙</span>
          <span className="settings-btn__label">{t('settings.openButton')}</span>
        </button>
      </div>
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={closeSettings}
        nearbyStationRadius={nearbyStationRadius}
        onNearbyStationRadiusChange={onNearbyStationRadiusChange}
      />
    </div>
  )
}
