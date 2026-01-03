import { useState, useCallback, useMemo, useRef, useEffect } from 'react'
import type { ChangeEvent, KeyboardEvent } from 'react'
import MapGL, { ViewStateChangeEvent, Source, Layer, Popup, MapRef } from 'react-map-gl/maplibre'
import type {
  CircleLayerSpecification,
  MapLayerMouseEvent,
} from 'maplibre-gl'
import { LngLatBounds } from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import { GetStationDetails, SearchStations } from '../../wailsjs/go/main/App'
import { models } from '../../wailsjs/go/models'
import { useStops, Bounds } from './map/useStops'
import { stopsToGeoJSON, tripsToGeoJSON, journeyLegsToGeoJSON, walkingConnectionsToGeoJSON } from './map/geojson'
import type { JourneyViewData } from '../hooks/useJourneyView'
import StationHoverPanel from './map/StationHoverPanel'
import JourneyMarkerPopover from './map/JourneyMarkerPopover'
import { SavedTrip } from '../App'
import { useTranslation } from 'react-i18next'
import './Map.css'

export interface MapViewState {
  longitude: number
  latitude: number
  zoom: number
  bounds?: Bounds
}

// Info about a hovered station for showing trip selection
export interface HoveredStationInfo {
  stopId: string
  stopName: string
  screenX: number
  screenY: number
}

type PlanningMode = 'initial' | 'planning' | 'viewing'

interface MapProps {
  onViewStateChange?: (viewState: MapViewState) => void
  onStationSelect?: (station: models.StationDetails | null) => void
  selectedStation?: models.StationDetails | null
  tripsData?: models.UpcomingTripsData | null
  savedTrips: SavedTrip[]
  selectedDate: string
  selectedTime: string
  onDateChange: (date: string) => void
  onTimeChange: (time: string) => void
  onTripSelection?: (
    trip: models.UpcomingTrip,
    tripIndex: number,
    displayColor: string,
    destinationStopId: string,
    destinationStopName: string,
    arrivalTime: string
  ) => void
  onResetTime: () => void
  planningMode: PlanningMode
  canEditTime: boolean
  hasJourney: boolean
  journeyViewData?: JourneyViewData | null
}

const INITIAL_VIEW_STATE = {
  longitude: 8.193903437037271,
  latitude: 50.896877167303444,
  zoom: 12,
}

const ZOOM_THRESHOLD = 8
const ROUTE_LINE_OPACITY = 0.8
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
    'circle-opacity': 0.7,
  },
}

export default function Map({
  onViewStateChange,
  onStationSelect,
  selectedStation,
  tripsData,
  selectedDate,
  selectedTime,
  onDateChange,
  onTimeChange,
  onTripSelection,
  onResetTime,
  planningMode,
  canEditTime,
  hasJourney,
  journeyViewData,
}: MapProps) {
  const { t } = useTranslation()

  // Derived values
  const isInitialMode = planningMode === 'initial' && !hasJourney
  const isPlanningMode = planningMode === 'planning' || (planningMode === 'initial' && hasJourney)
  const isViewingMode = planningMode === 'viewing'

  const [viewState, setViewState] = useState(INITIAL_VIEW_STATE)
  const [isLoadingStation, setIsLoadingStation] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [searchResults, setSearchResults] = useState<models.Stop[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [activeResultIndex, setActiveResultIndex] = useState(-1)
  const [hoveredStation, setHoveredStation] = useState<HoveredStationInfo | null>(null)
  const [hoveredJourneyMarkerIndex, setHoveredJourneyMarkerIndex] = useState<number | null>(null)
  const hoverTimeoutRef = useRef<number | null>(null)
  const boundsRef = useRef<Bounds | undefined>(undefined)
  const mapRef = useRef<MapRef | null>(null)
  const searchDebounceRef = useRef<number | null>(null)
  const searchRequestIdRef = useRef(0)
  const lastSelectedStationIdRef = useRef<string | null>(null)

  // Fetch viewport stops when no station is selected
  const viewportStops = useStops({
    zoom: viewState.zoom,
    bounds: boundsRef.current,
    zoomThreshold: ZOOM_THRESHOLD,
    enabled: !selectedStation,
  })

  // Determine which stations to display:
  // - In journey view mode: only show journey stations
  // - When station is selected: show trip stations
  // - Otherwise: show all viewport stops
  const displayStops = useMemo(() => {
    if (isViewingMode && journeyViewData?.markers) {
      // Extract unique stations from journey markers
      const journeyStationIds = new Set(journeyViewData.markers.map(m => m.stationId))
      const journeyStops: models.Stop[] = journeyViewData.markers.map(marker => ({
        stop_id: marker.stationId,
        stop_name: marker.stationName,
        stop_lat: marker.lat,
        stop_lon: marker.lon,
      }))
      // Remove duplicates
      return journeyStops.filter((stop, index, self) =>
        index === self.findIndex(s => s.stop_id === stop.stop_id)
      )
    }
    return tripsData?.stations ?? viewportStops
  }, [isViewingMode, journeyViewData, tripsData, viewportStops])

  const stopsGeojsonData = useMemo(() => stopsToGeoJSON(displayStops), [displayStops])

  const tripLinesGeojsonData = useMemo(
    () => tripsToGeoJSON(tripsData?.trips ?? []),
    [tripsData]
  )

  // Journey view GeoJSON data
  const journeyLegsGeojsonData = useMemo(
    () => journeyLegsToGeoJSON(journeyViewData?.legs ?? []),
    [journeyViewData?.legs]
  )

  const walkingConnectionsGeojsonData = useMemo(
    () => walkingConnectionsToGeoJSON(journeyViewData?.walkingConnections ?? []),
    [journeyViewData?.walkingConnections]
  )

  // Handle date change
  const handleDateChange = useCallback(
    (evt: ChangeEvent<HTMLInputElement>) => {
      onDateChange(evt.target.value)
    },
    [onDateChange]
  )

  // Handle time change
  const handleTimeChange = useCallback(
    (evt: ChangeEvent<HTMLInputElement>) => {
      onTimeChange(evt.target.value)
    },
    [onTimeChange]
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

  // Handle initial map load - set bounds so stations load immediately
  const handleLoad = useCallback(() => {
    const map = mapRef.current?.getMap()
    if (map) {
      const bounds = map.getBounds()
      if (bounds) {
        boundsRef.current = {
          north: bounds.getNorth(),
          south: bounds.getSouth(),
          east: bounds.getEast(),
          west: bounds.getWest(),
        }
        // Trigger a re-render to fetch stops with the initial bounds
        setViewState(prev => ({ ...prev }))
      }
    }
  }, [])

  const handleClick = useCallback(
    (evt: MapLayerMouseEvent) => {
      const features = evt.features
      if (features && features.length > 0) {
        const feature = features[0]
        const stopId = feature.properties?.stop_id
        if (stopId && !selectedStation) {
          selectStationById(stopId)
        }
      }
    },
    [selectStationById, selectedStation]
  )

  const handleClosePopup = useCallback(() => {
    if (onStationSelect) {
      onStationSelect(null)
    }
  }, [onStationSelect])

  // Handle mouse enter on stops layer - show hover panel for trip selection
  const handleMouseEnter = useCallback(
    (evt: MapLayerMouseEvent) => {
      // Clear any pending hide timeout
      if (hoverTimeoutRef.current !== null) {
        window.clearTimeout(hoverTimeoutRef.current)
        hoverTimeoutRef.current = null
      }

      // Only show hover panel when trips are loaded and a station is selected
      if (!tripsData || !selectedStation) {
        return
      }
      const features = evt.features
      if (features && features.length > 0) {
        const feature = features[0]
        const stopId = feature.properties?.stop_id
        const stopName = feature.properties?.stop_name
        // Don't show hover panel for the currently selected station
        if (stopId && stopId !== selectedStation.stop_id) {
          // Only update if it's a different station (prevents flickering)
          setHoveredStation(prev => {
            if (prev?.stopId === stopId) {
              return prev // Keep existing position to prevent flickering
            }
            return {
              stopId,
              stopName: stopName || stopId,
              screenX: evt.point.x,
              screenY: evt.point.y,
            }
          })
        }
      }
    },
    [tripsData, selectedStation]
  )

  // Handle mouse leave on stops layer - hide hover panel with delay
  const handleMouseLeave = useCallback(() => {
    // Delay hiding to allow mouse to move to the panel
    hoverTimeoutRef.current = window.setTimeout(() => {
      setHoveredStation(null)
      hoverTimeoutRef.current = null
    }, 300)
  }, [])

  // Cancel hide when mouse enters the hover panel
  const handlePanelMouseEnter = useCallback(() => {
    if (hoverTimeoutRef.current !== null) {
      window.clearTimeout(hoverTimeoutRef.current)
      hoverTimeoutRef.current = null
    }
  }, [])

  // Hide panel when mouse leaves it
  const handlePanelMouseLeave = useCallback(() => {
    setHoveredStation(null)
  }, [])

  // Handle trip selection from hover panel
  const handleHoverTripSelect = useCallback(
    (
      trip: models.UpcomingTrip,
      tripIndex: number,
      displayColor: string,
      destinationStopId: string,
      destinationStopName: string,
      arrivalTime: string
    ) => {
      setHoveredStation(null)
      if (onTripSelection) {
        onTripSelection(trip, tripIndex, displayColor, destinationStopId, destinationStopName, arrivalTime)
      }
    },
    [onTripSelection]
  )

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

  // Track last selected station to prevent re-centering
  useEffect(() => {
    if (selectedStation) {
      lastSelectedStationIdRef.current = selectedStation.stop_id
    } else {
      lastSelectedStationIdRef.current = null
    }
  }, [selectedStation])

  // Fit map to show all trip routes when station is selected
  useEffect(() => {
    if (!selectedStation || !tripsData?.stations || tripsData.stations.length === 0 || isViewingMode) {
      return
    }

    const map = mapRef.current?.getMap()
    if (!map) {
      return
    }

    // Calculate bounds from all trip stations
    const bounds = new LngLatBounds()

    // Include selected station
    bounds.extend([selectedStation.stop_lon, selectedStation.stop_lat])

    // Include all destination stations
    for (const station of tripsData.stations) {
      bounds.extend([station.stop_lon, station.stop_lat])
    }

    // Fit the map to the bounds with padding
    map.fitBounds(bounds, {
      padding: { top: 80, bottom: 40, left: 350, right: 40 }, // Extra left padding for sidebar
      maxZoom: 13,
      duration: 500,
    })
  }, [selectedStation, tripsData, isViewingMode])

  // Fit map to journey bounds when entering journey view mode
  useEffect(() => {
    if (!isViewingMode || !journeyViewData || journeyViewData.legs.length === 0) {
      return
    }

    const map = mapRef.current?.getMap()
    if (!map) {
      return
    }

    // Calculate bounds from all leg coordinates
    const bounds = new LngLatBounds()
    for (const leg of journeyViewData.legs) {
      for (const coord of leg.coordinates) {
        bounds.extend([coord.lon, coord.lat])
      }
    }

    // Also include walking connection coordinates
    for (const walk of journeyViewData.walkingConnections) {
      bounds.extend([walk.fromLon, walk.fromLat])
      bounds.extend([walk.toLon, walk.toLat])
    }

    // Fit the map to the bounds with padding
    map.fitBounds(bounds, {
      padding: { top: 80, bottom: 40, left: 40, right: 40 },
      maxZoom: 14,
      duration: 500,
    })
  }, [isViewingMode, journeyViewData])

  const handleSearchInputChange = useCallback((evt: ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(evt.target.value)
  }, [])

  const handleSearchClear = useCallback(() => {
    setSearchTerm('')
    setSearchResults([])
    setActiveResultIndex(-1)
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
      <div className="map-controls-wrapper">
        {isInitialMode && (
          <div className="map-search" role="search">
            <label className="map-search__sr-only" htmlFor="map-search-input">
              {t('map.search.label')}
            </label>
            <div className="map-search__input-wrapper">
              <input
                id="map-search-input"
                type="text"
                placeholder={t('map.search.placeholder')}
                value={searchTerm}
                onChange={handleSearchInputChange}
                onKeyDown={handleSearchKeyDown}
                autoComplete="off"
                spellCheck={false}
              />
              {searchTerm && (
                <button
                  type="button"
                  className="map-search__clear"
                  onClick={handleSearchClear}
                  aria-label={t('map.search.clearButton')}
                  title={t('map.search.clearButton')}
                >
                  ×
                </button>
              )}
            </div>
            {(isSearching || showEmptyState) && (
              <div className="map-search__status-row">
                {isSearching && <span className="map-search__status">{t('map.search.status.searching')}</span>}
                {showEmptyState && <span className="map-search__status">{t('map.search.status.empty')}</span>}
              </div>
            )}
            {showResults && (
              <ul className="map-search__results" role="listbox" aria-label={t('map.search.resultsAria')}>
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
        )}
        <div className="map-datetime-container">
          <div className="map-datetime">
            <label className="map-datetime__label">
              <span>{t('map.datetime.date')}</span>
              <input
                type="date"
                value={selectedDate}
                onChange={handleDateChange}
                disabled={!canEditTime}
                readOnly={!canEditTime}
                className="map-datetime__input"
              />
            </label>
            <label className="map-datetime__label">
              <span>{t('map.datetime.time')}</span>
              <input
                type="time"
                value={selectedTime}
                onChange={handleTimeChange}
                disabled={!canEditTime}
                readOnly={!canEditTime}
                className="map-datetime__input"
              />
            </label>
            <button
              type="button"
              className="map-datetime__reset"
              onClick={onResetTime}
              title={t('map.datetime.resetTooltip')}
              aria-label={t('map.datetime.resetTooltip')}
            >
              ↺
            </button>
          </div>
        </div>
      </div>
      <MapGL
        ref={mapRef}
        {...viewState}
        onLoad={handleLoad}
        onMove={handleMove}
        onClick={handleClick}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        interactiveLayerIds={['stops-layer']}
        cursor={isLoadingStation ? 'wait' : hoveredStation ? 'pointer' : 'auto'}
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
        {/* Trip lines layer - only shown when a station is selected and NOT in journey view */}
        {tripsData && !isViewingMode && (
          <Source id="trip-lines" type="geojson" data={tripLinesGeojsonData}>
            <Layer
              id="trip-lines"
              type="line"
              layout={{
                'line-cap': 'round',
                'line-join': 'round',
              }}
              paint={{
                'line-color': ['get', 'line_color'],
                'line-width': ['get', 'line_width'],
                'line-opacity': ROUTE_LINE_OPACITY,
              }}
            />
          </Source>
        )}

        {/* Journey view layers - shown when in journey view mode */}
        {isViewingMode && journeyViewData && (
          <>
            {/* Walking connections - dashed gray lines */}
            <Source id="walking-connections" type="geojson" data={walkingConnectionsGeojsonData}>
              <Layer
                id="walking-connections"
                type="line"
                layout={{
                  'line-cap': 'round',
                  'line-join': 'round',
                }}
                paint={{
                  'line-color': '#6b7280',
                  'line-width': 3,
                  'line-opacity': 0.7,
                  'line-dasharray': [2, 2],
                }}
              />
            </Source>

            {/* Journey leg lines - colored by route */}
            <Source id="journey-legs" type="geojson" data={journeyLegsGeojsonData}>
              <Layer
                id="journey-legs"
                type="line"
                layout={{
                  'line-cap': 'round',
                  'line-join': 'round',
                }}
                paint={{
                  'line-color': ['get', 'line_color'],
                  'line-width': ['get', 'line_width'],
                  'line-opacity': ROUTE_LINE_OPACITY,
                }}
              />
            </Source>
          </>
        )}

        <Source id="stops" type="geojson" data={stopsGeojsonData}>
          <Layer {...stopsLayerStyle} />
        </Source>

        {selectedStation && !isViewingMode && (
          <Popup
            longitude={selectedStation.stop_lon}
            latitude={selectedStation.stop_lat}
            anchor="bottom"
            onClose={isInitialMode ? handleClosePopup : undefined}
            closeButton={isInitialMode}
            closeOnClick={false}
          >
            <strong>{selectedStation.stop_name}</strong>
          </Popup>
        )}

        {/* Journey markers - small dots that can be hovered */}
        {isViewingMode && journeyViewData?.markers.map((marker, index) => (
          <div key={`journey-marker-${marker.stationId}-${index}`}>
            {/* Invisible hover target */}
            <Popup
              longitude={marker.lon}
              latitude={marker.lat}
              anchor="center"
              closeButton={false}
              closeOnClick={false}
              className="journey-marker-target"
              onClose={() => {}}
            >
              <div
                onMouseEnter={() => setHoveredJourneyMarkerIndex(index)}
                onMouseLeave={() => setHoveredJourneyMarkerIndex(null)}
                style={{
                  width: '20px',
                  height: '20px',
                  cursor: 'pointer',
                }}
              />
            </Popup>

            {/* Popover shown only when hovered */}
            {hoveredJourneyMarkerIndex === index && (
              <Popup
                longitude={marker.lon}
                latitude={marker.lat}
                anchor={marker.anchor || 'bottom'}
                offset={marker.offset}
                closeButton={false}
                closeOnClick={false}
                className="journey-marker-popup"
              >
                <div
                  onMouseEnter={() => setHoveredJourneyMarkerIndex(index)}
                  onMouseLeave={() => setHoveredJourneyMarkerIndex(null)}
                >
                  <JourneyMarkerPopover marker={marker} />
                </div>
              </Popup>
            )}
          </div>
        ))}
      </MapGL>

      {/* Hover panel for trip selection - hidden in journey view mode */}
      {!isViewingMode && hoveredStation && tripsData?.trips && (
        <StationHoverPanel
          stopId={hoveredStation.stopId}
          stopName={hoveredStation.stopName}
          screenX={hoveredStation.screenX}
          screenY={hoveredStation.screenY}
          trips={tripsData.trips}
          onTripSelect={handleHoverTripSelect}
          onMouseEnter={handlePanelMouseEnter}
          onMouseLeave={handlePanelMouseLeave}
        />
      )}
    </div>
  )
}
