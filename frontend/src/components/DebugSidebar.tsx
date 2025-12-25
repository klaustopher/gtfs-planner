import { MapViewState } from './Map'
import { models } from '../../wailsjs/go/models'
import { getTripColor } from './map/geojson'
import { SavedTrip } from '../App'
import './DebugSidebar.css'

interface DebugSidebarProps {
  viewState: MapViewState | null
  selectedStation: models.StationDetails | null
  tripsData: models.UpcomingTripsData | null
  isLoadingTrips: boolean
  savedTrips: SavedTrip[]
  onRemoveSavedTrip: (tripId: string) => void
  onClearSavedTrips: () => void
  onTripClick: (trip: models.UpcomingTrip, tripIndex: number) => void
}

function formatCoord(value: number, decimals = 4): string {
  return value.toFixed(decimals)
}

// Format ISO 8601 datetime to HH:MM display
function formatTimeDisplay(isoDateTime: string): string {
  const date = new Date(isoDateTime)
  return date.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })
}

export default function DebugSidebar({
  viewState,
  selectedStation,
  tripsData,
  isLoadingTrips,
  savedTrips,
  onRemoveSavedTrip,
  onClearSavedTrips,
  onTripClick,
}: DebugSidebarProps) {
  return (
    <div className="debug-sidebar">
      <h3>Station Info</h3>

      {selectedStation ? (
        <section className="station-details">
          <div className="info-row">
            <span className="label">Name:</span>
            <span className="value">{selectedStation.stop_name}</span>
          </div>
          <div className="info-row">
            <span className="label">ID:</span>
            <span className="value">{selectedStation.stop_id}</span>
          </div>
          <div className="info-row">
            <span className="label">Position:</span>
            <span className="value">
              {formatCoord(selectedStation.stop_lat)}, {formatCoord(selectedStation.stop_lon)}
            </span>
          </div>
        </section>
      ) : (
        <p className="no-station-hint">Select a station to see upcoming departures</p>
      )}

      {selectedStation && (
        <section className="trips-section">
          <h4>Upcoming Departures</h4>
          {isLoadingTrips && <p className="loading-hint">Loading departures...</p>}
          {!isLoadingTrips && tripsData && tripsData.trips && tripsData.trips.length > 0 && (
            <div className="trips-list">
              {tripsData.trips.map((trip: models.UpcomingTrip, index: number) => {
                const tripColor = getTripColor(trip, index)
                return (
                  <button
                    key={trip.trip_id}
                    className="trip-item trip-item--clickable"
                    style={{ borderLeftColor: tripColor }}
                    onClick={() => onTripClick(trip, index)}
                  >
                    <span className="trip-time">{formatTimeDisplay(trip.departure_datetime)}</span>
                    <div className="trip-details">
                      {trip.display_name && (
                        <span
                          className="trip-route-badge"
                          style={{ backgroundColor: tripColor }}
                        >
                          {trip.display_name}
                        </span>
                      )}
                      <span className="trip-destination">{trip.destination}</span>
                    </div>
                  </button>
                )
              })}
            </div>
          )}
          {!isLoadingTrips && tripsData && (!tripsData.trips || tripsData.trips.length === 0) && (
            <p className="no-trips-hint">No upcoming departures found for this time</p>
          )}
        </section>
      )}

      {savedTrips.length > 0 && (
        <section className="saved-trips-section">
          <div className="saved-trips-header">
            <h4>Planned Journey</h4>
            <button className="clear-trips-btn" onClick={onClearSavedTrips}>
              Clear All
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
                    title="Remove trip"
                  >
                    ×
                  </button>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="debug-section">
        <h4>Debug</h4>
        {viewState ? (
          <>
            <div className="info-row">
              <span className="label">Center:</span>
              <span className="value">
                {formatCoord(viewState.latitude)}, {formatCoord(viewState.longitude)}
              </span>
            </div>
            <div className="info-row">
              <span className="label">Zoom:</span>
              <span className="value">{formatCoord(viewState.zoom, 2)}</span>
            </div>
          </>
        ) : (
          <p>Loading map...</p>
        )}
      </section>
    </div>
  )
}
