import { MapViewState } from './Map'
import { models } from '../../wailsjs/go/models'
import './DebugSidebar.css'

interface DebugSidebarProps {
  viewState: MapViewState | null
  selectedStation: models.StationDetails | null
}

function formatCoord(value: number, decimals = 4): string {
  return value.toFixed(decimals)
}

const ROUTE_TYPE_NAMES: Record<number, string> = {
  0: 'Tram',
  1: 'Subway',
  2: 'Rail',
  3: 'Bus',
  4: 'Ferry',
  5: 'Cable Tram',
  6: 'Aerial Lift',
  7: 'Funicular',
  11: 'Trolleybus',
  12: 'Monorail',
}

export default function DebugSidebar({ viewState, selectedStation }: DebugSidebarProps) {
  return (
    <div className="debug-sidebar">
      <h3>Debug Info</h3>

      {viewState ? (
        <>
          <section>
            <h4>Center</h4>
            <div className="info-row">
              <span className="label">Lat:</span>
              <span className="value">{formatCoord(viewState.latitude)}</span>
            </div>
            <div className="info-row">
              <span className="label">Lng:</span>
              <span className="value">{formatCoord(viewState.longitude)}</span>
            </div>
          </section>

          <section>
            <h4>Zoom</h4>
            <div className="info-row">
              <span className="label">Level:</span>
              <span className="value">{formatCoord(viewState.zoom, 2)}</span>
            </div>
          </section>

          {viewState.bounds && (
            <section>
              <h4>Bounds</h4>
              <div className="info-row">
                <span className="label">North:</span>
                <span className="value">{formatCoord(viewState.bounds.north)}</span>
              </div>
              <div className="info-row">
                <span className="label">South:</span>
                <span className="value">{formatCoord(viewState.bounds.south)}</span>
              </div>
              <div className="info-row">
                <span className="label">East:</span>
                <span className="value">{formatCoord(viewState.bounds.east)}</span>
              </div>
              <div className="info-row">
                <span className="label">West:</span>
                <span className="value">{formatCoord(viewState.bounds.west)}</span>
              </div>
            </section>
          )}
        </>
      ) : (
        <p>Loading map...</p>
      )}

      {selectedStation && (
        <section className="station-details">
          <h4>Selected Station</h4>
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

          {selectedStation.routes && selectedStation.routes.length > 0 && (
            <>
              <h4>Routes ({selectedStation.routes.length})</h4>
              <div className="routes-list">
                {selectedStation.routes.map((route: models.Route) => (
                  <div key={route.route_id} className="route-item">
                    <span
                      className="route-badge"
                      style={{
                        backgroundColor: route.route_color ? `#${route.route_color}` : '#666',
                        color: route.route_text_color ? `#${route.route_text_color}` : '#fff',
                      }}
                    >
                      {route.route_short_name || '?'}
                    </span>
                    <div className="route-info">
                      <span className="route-name">
                        {route.route_long_name || route.route_short_name}
                      </span>
                      <span className="route-type">
                        {ROUTE_TYPE_NAMES[route.route_type] || `Type ${route.route_type}`}
                      </span>
                      {route.route_desc && (
                        <span className="route-desc">{route.route_desc}</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </section>
      )}
    </div>
  )
}
