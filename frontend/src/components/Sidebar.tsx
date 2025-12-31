import { models } from '../../wailsjs/go/models'
import { getTripColor } from './map/geojson'
import { getTransportTypeLabel } from '../utils/transportType'
import { SavedTrip } from '../App'
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
}

// Format ISO 8601 datetime to HH:MM display
function formatTimeDisplay(isoDateTime: string): string {
  const date = new Date(isoDateTime)
  return date.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })
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
}: SidebarProps) {
  return (
    <div className="sidebar">
      {/* Journey file actions */}
      <div className="sidebar-card">
        <div className="sidebar-card__header">
          <h3 className="sidebar-card__title">Reiseplanung</h3>
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
            title="Neue Reise"
          >
            Neu
          </button>
          <button
            className="journey-btn journey-btn--secondary"
            onClick={onLoadJourney}
            title="Reise laden"
          >
            Laden
          </button>
          <button
            className="journey-btn journey-btn--primary"
            onClick={onSaveJourney}
            disabled={savedTrips.length === 0}
            title="Reise speichern"
          >
            Speichern
            {hasUnsavedChanges && savedTrips.length > 0 && <span className="journey-btn__indicator">*</span>}
          </button>
        </div>
      </div>

      {/* Planned Journey */}
      {savedTrips.length > 0 && (
        <div className="sidebar-card">
          <div className="sidebar-card__header">
            <h3 className="sidebar-card__title">Geplante Reise</h3>
            <button className="clear-trips-btn" onClick={onClearSavedTrips}>
              Löschen
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
                      {getTransportTypeLabel(trip.routeType)}
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
                      <span className="saved-trip-time">{formatTimeDisplay(trip.departureDateTime)}</span>
                      <span className="saved-trip-station">{trip.startStationName}</span>
                    </div>
                    <div className="saved-trip-arrow">→</div>
                    <div className="saved-trip-leg">
                      <span className="saved-trip-time">{formatTimeDisplay(trip.arrivalDateTime)}</span>
                      <span className="saved-trip-station">{trip.endStationName}</span>
                    </div>
                  </div>
                </div>
                {index === savedTrips.length - 1 && (
                  <button
                    className="remove-trip-btn"
                    onClick={() => onRemoveSavedTrip(trip.id)}
                    title="Verbindung entfernen"
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
            {selectedStation ? selectedStation.stop_name : 'Station auswählen'}
          </h3>
        </div>

        {!selectedStation && (
          <p className="sidebar-hint">Klicke auf eine Station in der Karte, um Abfahrten zu sehen</p>
        )}

        {selectedStation && (
          <div className="trips-section">
            {isLoadingTrips && <p className="sidebar-hint">Lade Abfahrten...</p>}
            {!isLoadingTrips && tripsData && tripsData.trips && tripsData.trips.length > 0 && (
              <div className="trips-list">
                {tripsData.trips.map((trip: models.UpcomingTrip, index: number) => {
                  const tripColor = getTripColor(trip, index)
                  return (
                    <button
                      key={trip.trip_id}
                      className="trip-item"
                      style={{ borderLeftColor: tripColor }}
                      onClick={() => onTripClick(trip, index)}
                    >
                      <span className="trip-time">{formatTimeDisplay(trip.departure_datetime)}</span>
                      <div className="trip-details">
                        <div className="trip-badges">
                          <span className="trip-type-badge">
                            {getTransportTypeLabel(trip.route_type)}
                          </span>
                          {trip.display_name && (
                            <span
                              className="trip-route-badge"
                              style={{ backgroundColor: tripColor }}
                            >
                              {trip.display_name}
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
              <p className="sidebar-hint">Keine Abfahrten für diese Zeit gefunden</p>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
