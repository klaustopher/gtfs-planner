import { useState, useCallback, useEffect, useRef, useMemo } from 'react'
import MapGL, { ViewStateChangeEvent, Source, Layer, Popup } from 'react-map-gl/maplibre'
import type { CircleLayerSpecification, MapLayerMouseEvent } from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import { GetStops, GetStationDetails } from '../../wailsjs/go/main/App'
import { main } from '../../wailsjs/go/models'

export interface MapViewState {
  longitude: number
  latitude: number
  zoom: number
  bounds?: {
    north: number
    south: number
    east: number
    west: number
  }
}

interface MapProps {
  onViewStateChange?: (viewState: MapViewState) => void
  onStationSelect?: (station: main.StationDetails | null) => void
  selectedStation?: main.StationDetails | null
}

const INITIAL_VIEW_STATE = {
  longitude: 10.4515,
  latitude: 51.1657,
  zoom: 6,
}

const ZOOM_THRESHOLD = 8
const DEBOUNCE_MS = 300

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
  const [stops, setStops] = useState<main.Stop[]>([])
  const boundsRef = useRef<MapViewState['bounds']>(undefined)
  const debounceTimerRef = useRef<number | null>(null)
  const requestIdRef = useRef(0)
  const [isLoadingStation, setIsLoadingStation] = useState(false)

  const geojsonData = useMemo(
    () => ({
      type: 'FeatureCollection' as const,
      features: stops.map((stop) => ({
        type: 'Feature' as const,
        geometry: {
          type: 'Point' as const,
          coordinates: [stop.stop_lon, stop.stop_lat],
        },
        properties: {
          stop_id: stop.stop_id,
          stop_name: stop.stop_name,
        },
      })),
    }),
    [stops]
  )

  useEffect(() => {
    // Clear any pending debounce timer
    if (debounceTimerRef.current !== null) {
      window.clearTimeout(debounceTimerRef.current)
    }

    if (viewState.zoom >= ZOOM_THRESHOLD && boundsRef.current) {
      const { north, south, east, west } = boundsRef.current

      // Debounce the fetch request
      debounceTimerRef.current = window.setTimeout(() => {
        // Increment request ID to track the latest request
        const currentRequestId = ++requestIdRef.current

        GetStops(north, south, east, west)
          .then((fetchedStops) => {
            // Only update if this is still the latest request
            if (currentRequestId === requestIdRef.current) {
              setStops(fetchedStops || [])
            }
          })
          .catch((err) => {
            if (currentRequestId === requestIdRef.current) {
              console.error('Failed to fetch stops:', err)
            }
          })
      }, DEBOUNCE_MS)
    } else {
      setStops([])
    }

    // Cleanup on unmount or before next effect
    return () => {
      if (debounceTimerRef.current !== null) {
        window.clearTimeout(debounceTimerRef.current)
      }
    }
  }, [viewState.zoom, viewState.longitude, viewState.latitude])

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
      <Source id="stops" type="geojson" data={geojsonData}>
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
                  {selectedStation.routes.slice(0, 10).map((route) => (
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
