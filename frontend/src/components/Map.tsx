import { useState, useCallback, useMemo, useRef } from 'react'
import MapGL, { ViewStateChangeEvent, Source, Layer, Popup } from 'react-map-gl/maplibre'
import type {
  CircleLayerSpecification,
  MapLayerMouseEvent,
  ExpressionSpecification,
  FilterSpecification,
} from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import { GetStationDetails } from '../../wailsjs/go/main/App'
import { models } from '../../wailsjs/go/models'
import { useStops, Bounds } from './map/useStops'
import { useRoutes } from './map/useRoutes'
import { stopsToGeoJSON, routesToGeoJSON } from './map/geojson'

export interface MapViewState {
  longitude: number
  latitude: number
  zoom: number
  bounds?: Bounds
}

interface MapProps {
  onViewStateChange?: (viewState: MapViewState) => void
  onStationSelect?: (station: models.StationDetails | null) => void
  selectedStation?: models.StationDetails | null
}

const INITIAL_VIEW_STATE = {
  longitude: 10.4515,
  latitude: 51.1657,
  zoom: 6,
}

const ZOOM_THRESHOLD = 8
const ROUTE_LINE_OPACITY = 0.8
const ROUTE_STYLE_VARIANTS = [
  { id: 'solid', dashArray: undefined },
  { id: 'dash', dashArray: [2.5, 1.5] },
  { id: 'dot', dashArray: [0.4, 1.2] },
  { id: 'longdash', dashArray: [4, 2, 1, 2] },
] as const

const stopsLayerStyle: CircleLayerSpecification = {
  id: 'stops-layer',
  type: 'circle',
  source: 'stops',
  paint: {
    'circle-radius': 6,
    'circle-color': '#e74c3c',
    'circle-stroke-width': 2,
    'circle-stroke-color': '#ffffff',
  },
}

export default function Map({ onViewStateChange, onStationSelect, selectedStation }: MapProps) {
  const [viewState, setViewState] = useState(INITIAL_VIEW_STATE)
  const [isLoadingStation, setIsLoadingStation] = useState(false)
  const boundsRef = useRef<Bounds | undefined>(undefined)

  // Fetch routes when a station is selected
  const routesData = useRoutes(selectedStation ?? null)

  // Fetch viewport stops when no station is selected
  const viewportStops = useStops({
    zoom: viewState.zoom,
    bounds: boundsRef.current,
    zoomThreshold: ZOOM_THRESHOLD,
    enabled: !selectedStation,
  })

  // Use route stations when a station is selected, otherwise use all stops in view
  const displayStops = routesData?.stations ?? viewportStops

  const stopsGeojsonData = useMemo(() => stopsToGeoJSON(displayStops), [displayStops])

  const routeLinesGeojsonData = useMemo(
    () => routesToGeoJSON(routesData?.routes ?? [], { dashVariantCount: ROUTE_STYLE_VARIANTS.length }),
    [routesData]
  )

  const handleMove = useCallback(
    (evt: ViewStateChangeEvent) => {
      setViewState(evt.viewState)

      const map = evt.target
      const bounds = map.getBounds()
      const boundsObj = bounds
        ? {
            north: bounds.getNorth(),
            south: bounds.getSouth(),
            east: bounds.getEast(),
            west: bounds.getWest(),
          }
        : undefined

      boundsRef.current = boundsObj

      if (onViewStateChange) {
        onViewStateChange({
          longitude: evt.viewState.longitude,
          latitude: evt.viewState.latitude,
          zoom: evt.viewState.zoom,
          bounds: boundsObj,
        })
      }
    },
    [onViewStateChange]
  )

  const handleClick = useCallback(
    (evt: MapLayerMouseEvent) => {
      const features = evt.features
      if (features && features.length > 0) {
        const feature = features[0]
        const stopId = feature.properties?.stop_id
        if (stopId && onStationSelect) {
          setIsLoadingStation(true)
          GetStationDetails(stopId)
            .then((details) => {
              onStationSelect(details)
            })
            .catch((err) => {
              console.error('Failed to fetch station details:', err)
              onStationSelect(null)
            })
            .finally(() => {
              setIsLoadingStation(false)
            })
        }
      }
    },
    [onStationSelect]
  )

  const handleClosePopup = useCallback(() => {
    if (onStationSelect) {
      onStationSelect(null)
    }
  }, [onStationSelect])

  return (
    <MapGL
      {...viewState}
      onMove={handleMove}
      onClick={handleClick}
      interactiveLayerIds={['stops-layer']}
      cursor={isLoadingStation ? 'wait' : 'auto'}
      style={{ width: '100%', height: '100%' }}
      mapStyle={{
        version: 8,
        sources: {
          osm: {
            type: 'raster',
            tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
            tileSize: 256,
            attribution: '© OpenStreetMap contributors',
          },
        },
        layers: [
          {
            id: 'osm',
            type: 'raster',
            source: 'osm',
          },
        ],
      }}
    >
      {/* Route lines layer - only shown when a station is selected */}
      {routesData && (
        <Source id="route-lines" type="geojson" data={routeLinesGeojsonData}>
          {ROUTE_STYLE_VARIANTS.map((variant, index) => (
            <Layer
              key={variant.id}
              id={`route-lines-${variant.id}`}
              type="line"
              filter={['==', ['get', 'dash_variant'], index] as FilterSpecification}
              layout={{
                'line-cap': 'round',
                'line-join': 'round',
              }}
              paint={{
                'line-color': ['get', 'line_color'],
                'line-width': ['get', 'line_width'],
                'line-opacity': ROUTE_LINE_OPACITY,
                'line-offset': ['get', 'line_offset'],
                ...(variant.dashArray
                  ? { 'line-dasharray': ['literal', variant.dashArray] as ExpressionSpecification }
                  : {}),
              }}
            />
          ))}
        </Source>
      )}

      <Source id="stops" type="geojson" data={stopsGeojsonData}>
        <Layer {...stopsLayerStyle} />
      </Source>

      {selectedStation && (
        <Popup
          longitude={selectedStation.stop_lon}
          latitude={selectedStation.stop_lat}
          anchor="bottom"
          onClose={handleClosePopup}
          closeOnClick={false}
        >
          <div style={{ maxWidth: 250 }}>
            <strong>{selectedStation.stop_name}</strong>
            {selectedStation.routes && selectedStation.routes.length > 0 && (
              <div style={{ marginTop: 8, fontSize: 12 }}>
                <div style={{ fontWeight: 500, marginBottom: 4 }}>
                  Routes ({selectedStation.routes.length}):
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                  {selectedStation.routes.slice(0, 10).map((route: models.Route) => (
                    <span
                      key={route.route_id}
                      style={{
                        padding: '2px 6px',
                        borderRadius: 4,
                        backgroundColor: route.route_color ? `#${route.route_color}` : '#666',
                        color: '#fff',
                        fontSize: 11,
                      }}
                    >
                      {route.route_short_name || route.route_long_name}
                    </span>
                  ))}
                  {selectedStation.routes.length > 10 && (
                    <span style={{ fontSize: 11, color: '#666' }}>
                      +{selectedStation.routes.length - 10} more
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>
        </Popup>
      )}
    </MapGL>
  )
}
