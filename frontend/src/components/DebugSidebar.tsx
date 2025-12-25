import { MapViewState } from './Map'
import { models } from '../../wailsjs/go/models'
import { getTripColor } from './map/geojson'
import './DebugSidebar.css'

interface DebugSidebarProps {
  viewState: MapViewState | null
  selectedStation: models.StationDetails | null
  tripsData: models.UpcomingTripsData | null
  isLoadingTrips: boolean
}

function formatCoord(value: number, decimals = 4): string {
  return value.toFixed(decimals)
}

export default function DebugSidebar({
  viewState,
  selectedStation,
  tripsData,
  isLoadingTrips,
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
                  <div
                    key={trip.trip_id}
                    className="trip-item"
                    style={{ borderLeftColor: tripColor }}
                  >
                    <span className="trip-time">{trip.departure_time.slice(0, 5)}</span>
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
                  </div>
                )
              })}
            </div>
          )}
          {!isLoadingTrips && tripsData && (!tripsData.trips || tripsData.trips.length === 0) && (
            <p className="no-trips-hint">No upcoming departures found for this time</p>
          )}
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
