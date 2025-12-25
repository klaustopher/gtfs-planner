import { useState, useCallback, useMemo, useRef, useEffect } from 'react'
import type { ChangeEvent, KeyboardEvent } from 'react'
import MapGL, { ViewStateChangeEvent, Source, Layer, Popup } from 'react-map-gl/maplibre'
import type {
  CircleLayerSpecification,
  MapLayerMouseEvent,
  ExpressionSpecification,
  FilterSpecification,
} from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import { GetStationDetails, SearchStations } from '../../wailsjs/go/main/App'
import { models } from '../../wailsjs/go/models'
import { useStops, Bounds } from './map/useStops'
import { useRoutes } from './map/useRoutes'
import { stopsToGeoJSON, routesToGeoJSON } from './map/geojson'
import './Map.css'

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
const SEARCH_DEBOUNCE_MS = 250
const SEARCH_RESULT_LIMIT = 8
const SEARCH_MIN_LENGTH = 2
const SEARCH_FOCUS_ZOOM = 12

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
  const [searchTerm, setSearchTerm] = useState('')
  const [searchResults, setSearchResults] = useState<models.Stop[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [activeResultIndex, setActiveResultIndex] = useState(-1)
  const boundsRef = useRef<Bounds | undefined>(undefined)
  const searchDebounceRef = useRef<number | null>(null)
  const searchRequestIdRef = useRef(0)
  const lastSelectedStationIdRef = useRef<string | null>(null)

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

  const selectStationById = useCallback(
    (stopId: string) => {
      if (!stopId || !onStationSelect) {
        return
      }
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
    },
    [onStationSelect]
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
        if (stopId) {
          selectStationById(stopId)
        }
      }
    },
    [selectStationById]
  )

  const handleClosePopup = useCallback(() => {
    if (onStationSelect) {
      onStationSelect(null)
    }
  }, [onStationSelect])

  useEffect(() => {
    if (searchDebounceRef.current !== null) {
      window.clearTimeout(searchDebounceRef.current)
    }

    const trimmed = searchTerm.trim()
    if (trimmed.length < SEARCH_MIN_LENGTH) {
      setSearchResults([])
      setIsSearching(false)
      setActiveResultIndex(-1)
      return
    }

    searchDebounceRef.current = window.setTimeout(() => {
      setIsSearching(true)
      const currentRequestId = ++searchRequestIdRef.current

      SearchStations(trimmed, SEARCH_RESULT_LIMIT)
        .then((results) => {
          if (currentRequestId !== searchRequestIdRef.current) {
            return
          }
          setSearchResults(results ?? [])
          setActiveResultIndex(results && results.length > 0 ? 0 : -1)
        })
        .catch((err) => {
          if (currentRequestId === searchRequestIdRef.current) {
            console.error('Station search failed:', err)
            setSearchResults([])
            setActiveResultIndex(-1)
          }
        })
        .finally(() => {
          if (currentRequestId === searchRequestIdRef.current) {
            setIsSearching(false)
          }
        })
    }, SEARCH_DEBOUNCE_MS)

    return () => {
      if (searchDebounceRef.current !== null) {
        window.clearTimeout(searchDebounceRef.current)
      }
    }
  }, [searchTerm])

  useEffect(() => {
    if (selectedStation) {
      if (selectedStation.stop_id === lastSelectedStationIdRef.current) {
        return
      }
      lastSelectedStationIdRef.current = selectedStation.stop_id
      setViewState((prev) => ({
        ...prev,
        longitude: selectedStation.stop_lon,
        latitude: selectedStation.stop_lat,
        zoom: Math.max(prev.zoom, SEARCH_FOCUS_ZOOM),
      }))
    } else {
      lastSelectedStationIdRef.current = null
    }
  }, [selectedStation])

  const handleSearchInputChange = useCallback((evt: ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(evt.target.value)
  }, [])

  const handleSearchResultSelect = useCallback(
    (stop: models.Stop) => {
      if (!stop) {
        return
      }

      setSearchTerm(stop.stop_name)
      setSearchResults([])
      setActiveResultIndex(-1)

      setViewState((prev) => ({
        ...prev,
        longitude: stop.stop_lon,
        latitude: stop.stop_lat,
        zoom: Math.max(prev.zoom, SEARCH_FOCUS_ZOOM),
      }))

      boundsRef.current = undefined
      selectStationById(stop.stop_id)
    },
    [selectStationById]
  )

  const handleSearchKeyDown = useCallback(
    (evt: KeyboardEvent<HTMLInputElement>) => {
      if (evt.key === 'ArrowDown') {
        evt.preventDefault()
        setActiveResultIndex((prev) => {
          if (searchResults.length === 0) {
            return -1
          }
          const next = prev + 1
          return next >= searchResults.length ? 0 : next
        })
      } else if (evt.key === 'ArrowUp') {
        evt.preventDefault()
        setActiveResultIndex((prev) => {
          if (searchResults.length === 0) {
            return -1
          }
          const next = prev - 1
          return next < 0 ? searchResults.length - 1 : next
        })
      } else if (evt.key === 'Enter') {
        if (activeResultIndex >= 0 && activeResultIndex < searchResults.length) {
          evt.preventDefault()
          handleSearchResultSelect(searchResults[activeResultIndex])
        }
      } else if (evt.key === 'Escape') {
        if (searchResults.length > 0) {
          evt.preventDefault()
          setSearchResults([])
          setActiveResultIndex(-1)
        }
      }
    },
    [activeResultIndex, searchResults, handleSearchResultSelect]
  )

  const trimmedSearchTerm = searchTerm.trim()
  const showResults = searchResults.length > 0 && trimmedSearchTerm.length >= SEARCH_MIN_LENGTH
  const showEmptyState =
    !isSearching && trimmedSearchTerm.length >= SEARCH_MIN_LENGTH && searchResults.length === 0

  return (
    <div className="map-shell">
      <div className="map-search" role="search">
        <label className="map-search__sr-only" htmlFor="map-search-input">
          Station suchen
        </label>
        <input
          id="map-search-input"
          type="text"
          placeholder="Station suchen..."
          value={searchTerm}
          onChange={handleSearchInputChange}
          onKeyDown={handleSearchKeyDown}
          autoComplete="off"
          spellCheck={false}
        />
        {(isSearching || showEmptyState) && (
          <div className="map-search__status-row">
            {isSearching && <span className="map-search__status">Suche läuft...</span>}
            {showEmptyState && <span className="map-search__status">Keine Station gefunden</span>}
          </div>
        )}
        {showResults && (
          <ul className="map-search__results" role="listbox" aria-label="Stationsempfehlungen">
            {searchResults.map((stop, index) => {
              const isActive = index === activeResultIndex
              return (
                <li key={stop.stop_id}>
                  <button
                    type="button"
                    className={`map-search__result${isActive ? ' is-active' : ''}`}
                    onClick={() => handleSearchResultSelect(stop)}
                    onMouseEnter={() => setActiveResultIndex(index)}
                  >
                    <span className="map-search__result-name">{stop.stop_name}</span>
                    <span className="map-search__result-meta">{stop.stop_id}</span>
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </div>
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
    </div>
  )
}
