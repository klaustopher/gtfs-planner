import { useState, useCallback, useMemo, useRef, useEffect } from 'react'
import type { ChangeEvent } from 'react'
import MapGL, { ViewStateChangeEvent, Source, Layer, Popup, MapRef } from 'react-map-gl/maplibre'
import type {
  SymbolLayerSpecification,
  MapLayerMouseEvent,
} from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import { GetStationDetails } from '../../wailsjs/go/main/App'
import { models } from '../../wailsjs/go/models'
import { useStops, Bounds } from './map/useStops'
import { stopsToGeoJSON, tripsToGeoJSON, journeyLegsToGeoJSON, walkingConnectionsToGeoJSON } from './map/geojson'
import type { JourneyViewData } from '../hooks/useJourneyView'
import JourneyMarkerPopover from './map/JourneyMarkerPopover'
import { SavedTrip } from '../App'
import { useTranslation } from 'react-i18next'
import MapSearchPanel from './map/MapSearchPanel'
import TripLayers from './map/TripLayers'
import JourneyLayers from './map/JourneyLayers'
import StationHoverOverlay from './map/StationHoverOverlay'
import TransportFilterDropdown from './map/TransportFilterDropdown'
import { useFitBounds } from './map/hooks/useFitBounds'
import { STATION_MARKER_ICONS, stationCategoryIconExpression } from './map/markerIcons'
import { useHoverStationPanel } from './map/hooks/useHoverStationPanel'
import { useDefaultMapLocation } from '../hooks/useDefaultMapLocation'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faLocationCrosshairs, faSpinner } from '@fortawesome/free-solid-svg-icons'
import './Map.css'

export interface MapViewState {
  longitude: number
  latitude: number
  zoom: number
  bounds?: Bounds
}

type PlanningMode = 'initial' | 'planning' | 'viewing'

interface MapProps {
  onViewStateChange?: (viewState: MapViewState) => void
  onStationSelect?: (station: models.StationDetails | null) => void
  selectedStation?: models.StationDetails | null
  tripsData?: models.UpcomingTripsData | null
  isLoadingTrips?: boolean
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
  planningMode: PlanningMode
  canEditTime: boolean
  hasJourney: boolean
  journeyViewData?: JourneyViewData | null
  selectedTransportTypes: Set<number>
  onToggleTransportType: React.Dispatch<React.SetStateAction<Set<number>>>
  availableTransportTypes: number[]
}

const ZOOM_THRESHOLD = 8
const ROUTE_LINE_OPACITY = 0.8
const SEARCH_FOCUS_ZOOM = 12
// OpenFreeMap: free, unlimited, keyless vector tiles (https://openfreemap.org)
const MAP_STYLE_URL = 'https://tiles.openfreemap.org/styles/positron'

// SVG for selected station marker - larger and highlighted
const SELECTED_STOP_ICON = `
<svg width="36" height="44" viewBox="-2 -2 36 44" xmlns="http://www.w3.org/2000/svg">
  <!-- Pin shape -->
  <path d="M16 0C7.16 0 0 7.16 0 16c0 10.67 16 26.67 16 26.67s16-16 16-26.67C32 7.16 24.84 0 16 0z"
        fill="#3b82f6" stroke="#ffffff" stroke-width="3"/>
  <!-- H sign for bus stop -->
  <rect x="9" y="9" width="14" height="14" rx="1.5" fill="#ffffff"/>
  <text x="16" y="20" font-family="Arial, sans-serif" font-size="14" font-weight="bold"
        text-anchor="middle" fill="#3b82f6">H</text>
</svg>
`

// Bold so the marker labels stand out from the basemap's (regular) place labels.
const MARKER_FONT = ['Noto Sans Bold']

const stopsLayerStyle: SymbolLayerSpecification = {
  id: 'stops-layer',
  type: 'symbol',
  source: 'stops',
  layout: {
    'icon-image': stationCategoryIconExpression,
    'icon-size': 0.8,
    'icon-allow-overlap': true,
    'icon-anchor': 'bottom',
    'text-field': ['get', 'stop_name'],
    'text-font': MARKER_FONT,
    'text-size': 13,
    'text-anchor': 'top',
    'text-offset': [0, 0.3],
    'text-optional': true,
  },
  paint: {
    'text-color': '#111827',
    'text-halo-color': '#ffffff',
    'text-halo-width': 2,
  },
}

const searchResultsLayerStyle: SymbolLayerSpecification = {
  id: 'search-results-layer',
  type: 'symbol',
  source: 'search-results',
  layout: {
    'icon-image': stationCategoryIconExpression,
    'icon-size': ['case', ['get', 'active'], 1.0, 0.85],
    'icon-allow-overlap': true,
    'icon-anchor': 'bottom',
    'text-field': ['get', 'stop_name'],
    'text-font': MARKER_FONT,
    'text-size': 13,
    'text-anchor': 'top',
    'text-offset': [0, 0.4],
    'text-allow-overlap': true,
  },
  paint: {
    'text-color': '#111827',
    'text-halo-color': '#ffffff',
    'text-halo-width': 2,
  },
}

export default function Map({
  onViewStateChange,
  onStationSelect,
  selectedStation,
  tripsData,
  isLoadingTrips = false,
  selectedDate,
  selectedTime,
  onDateChange,
  onTimeChange,
  onTripSelection,
  planningMode,
  canEditTime,
  hasJourney,
  journeyViewData,
  selectedTransportTypes,
  onToggleTransportType,
  availableTransportTypes,
}: MapProps) {
  const { t } = useTranslation()
  const { location: defaultLocation, fetchLocation, isLoading: isLoadingLocation } = useDefaultMapLocation()

  // Derived values
  const isInitialMode = planningMode === 'initial' && !hasJourney
  const isViewingMode = planningMode === 'viewing'

  const [viewState, setViewState] = useState(defaultLocation)
  const [isLoadingStation, setIsLoadingStation] = useState(false)
  const [hoveredJourneyMarkerIndex, setHoveredJourneyMarkerIndex] = useState<number | null>(null)
  const [searchResults, setSearchResults] = useState<models.Stop[]>([])
  const [searchActiveIndex, setSearchActiveIndex] = useState(-1)
  const boundsRef = useRef<Bounds | undefined>(undefined)
  const mapRef = useRef<MapRef | null>(null)
  const lastSelectedStationIdRef = useRef<string | null>(null)
  const hoverTimeoutRef = useRef<number | null>(null)

  // Debounced hover handlers to prevent flickering
  const handleMarkerHoverEnter = useCallback((groupIndex: number) => {
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current)
    }
    setHoveredJourneyMarkerIndex(groupIndex)
  }, [])

  const handleMarkerHoverLeave = useCallback(() => {
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current)
    }
    hoverTimeoutRef.current = setTimeout(() => {
      setHoveredJourneyMarkerIndex(null)
    }, 200)
  }, [])

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (hoverTimeoutRef.current) {
        clearTimeout(hoverTimeoutRef.current)
      }
    }
  }, [])

  // Group markers that belong together (walking transfers create two markers)
  const groupedMarkers = useMemo(() => {
    if (!journeyViewData?.markers) return []

    const groups: Array<{
      indices: number[]
      markers: typeof journeyViewData.markers
      centerLon: number
      centerLat: number
      isWalkingTransfer: boolean
    }> = []

    const processed = new Set<number>()

    journeyViewData.markers.forEach((marker, index) => {
      if (processed.has(index)) return

      // Check if this is a walking transfer marker followed by another walking transfer
      const nextMarker = journeyViewData.markers[index + 1]
      const isWalkingGroup = marker.isWalkingTransfer &&
                            nextMarker?.isWalkingTransfer &&
                            marker.type === 'transfer' &&
                            nextMarker.type === 'transfer'

      if (isWalkingGroup && nextMarker) {
        // Group walking transfer markers together
        groups.push({
          indices: [index, index + 1],
          markers: [marker, nextMarker],
          centerLon: (marker.lon + nextMarker.lon) / 2,
          centerLat: (marker.lat + nextMarker.lat) / 2,
          isWalkingTransfer: true,
        })
        processed.add(index)
        processed.add(index + 1)
      } else {
        // Single marker group
        groups.push({
          indices: [index],
          markers: [marker],
          centerLon: marker.lon,
          centerLat: marker.lat,
          isWalkingTransfer: false,
        })
        processed.add(index)
      }
    })

    return groups
  }, [journeyViewData])

  // Update viewState when defaultLocation changes (after geolocation is fetched)
  useEffect(() => {
    setViewState(defaultLocation)
  }, [defaultLocation])

  // Handle locate button click
  const handleLocateClick = useCallback(() => {
    fetchLocation()
  }, [fetchLocation])

  // Fetch viewport stops when no station is selected
  const { stops: viewportStops, isLoading: isLoadingStops } = useStops({
    zoom: viewState.zoom,
    bounds: boundsRef.current,
    zoomThreshold: ZOOM_THRESHOLD,
    enabled: !selectedStation,
  })

  // Determine which stations to display:
  // - In journey view mode: only show journey stations
  // - When station is selected: show trip stations (already filtered by backend)
  // - Otherwise: show all viewport stops
  const displayStops = useMemo(() => {
    if (isViewingMode && journeyViewData?.markers) {
      // Extract unique stations from journey markers
      const journeyStops: models.Stop[] = journeyViewData.markers.map(marker => ({
        stop_id: marker.stationId,
        stop_name: marker.stationName,
        stop_lat: marker.lat,
        stop_lon: marker.lon,
        station_category: marker.stationCategory,
      }))
      // Remove duplicates
      return journeyStops.filter((stop, index, self) =>
        index === self.findIndex(s => s.stop_id === stop.stop_id)
      )
    }
    // Backend already filters trips by transport type, so stations are also filtered
    return tripsData?.stations ?? viewportStops
  }, [isViewingMode, journeyViewData, tripsData, viewportStops])

  const stopsGeojsonData = useMemo(() => stopsToGeoJSON(displayStops), [displayStops])

  // Separate GeoJSON for selected station with different icon
  const selectedStationGeojsonData = useMemo(() => {
    if (!selectedStation || isViewingMode) return stopsToGeoJSON([])
    return stopsToGeoJSON([{
      stop_id: selectedStation.stop_id,
      stop_name: selectedStation.stop_name,
      stop_lat: selectedStation.stop_lat,
      stop_lon: selectedStation.stop_lon,
    }])
  }, [selectedStation, isViewingMode])

  // Trips are already filtered by backend based on selectedTransportTypes
  const tripLinesGeojsonData = useMemo(() => {
    return tripsToGeoJSON(tripsData?.trips ?? [])
  }, [tripsData])
  const journeyLegsGeojsonData = useMemo(
    () => journeyLegsToGeoJSON(journeyViewData?.legs ?? []),
    [journeyViewData?.legs]
  )

  const walkingConnectionsGeojsonData = useMemo(
    () => walkingConnectionsToGeoJSON(journeyViewData?.walkingConnections ?? []),
    [journeyViewData?.walkingConnections]
  )

  // Toggle transport type selection - use the passed callback
  const handleToggleTransportType = useCallback((routeType: number) => {
    onToggleTransportType(prev => {
      const newSet = new Set(prev)
      if (newSet.has(routeType)) {
        newSet.delete(routeType)
      } else {
        newSet.add(routeType)
      }
      return newSet
    })
  }, [onToggleTransportType])

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
      // Register one marker image per transport category.
      for (const icon of STATION_MARKER_ICONS) {
        const img = new Image(28, 36)
        img.onload = () => {
          if (!map.hasImage(icon.name)) {
            map.addImage(icon.name, img)
          }
        }
        img.src = 'data:image/svg+xml;base64,' + btoa(icon.svg)
      }

      // Add selected stop icon
      const selectedImg = new Image(36, 44)
      selectedImg.onload = () => {
        if (!map.hasImage('selected-stop-marker')) {
          map.addImage('selected-stop-marker', selectedImg)
        }
      }
      selectedImg.src = 'data:image/svg+xml;base64,' + btoa(SELECTED_STOP_ICON)

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

  const {
    hoveredStation,
    isHoveringStation,
    handleMapMouseEnter,
    handleMapMouseLeave,
    openPanelForEvent,
    closePanel,
    handleHoverTripSelect,
  } = useHoverStationPanel({
    selectedStation,
    tripsData,
    onTripSelection,
  })

  const handleClick = useCallback(
    (evt: MapLayerMouseEvent) => {
      const features = evt.features
      if (features && features.length > 0) {
        const stopId = features[0].properties?.stop_id
        if (!stopId) {
          return
        }
        if (!selectedStation && !hasJourney) {
          // Initial mode: pick the origin station to show its departures.
          selectStationById(stopId)
        } else {
          // A station is selected: clicking a destination opens its booking panel.
          openPanelForEvent(evt)
        }
      } else {
        // Clicked empty map: just close any open booking panel. Deselecting the
        // station is done via the sidebar step-back button, not by map clicks.
        closePanel()
      }
    },
    [selectStationById, selectedStation, hasJourney, openPanelForEvent, closePanel]
  )

  const handleSearchResultSelect = useCallback(
    (stop: models.Stop) => {
      if (!stop) {
        return
      }

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

  // Mirror the search panel's results onto the map (markers + zoom-to-fit).
  const handleSearchResults = useCallback((results: models.Stop[], activeIndex: number) => {
    setSearchResults(results)
    setSearchActiveIndex(activeIndex)
  }, [])

  const searchResultsGeojsonData = useMemo(() => ({
    type: 'FeatureCollection' as const,
    features: searchResults.map((stop, index) => ({
      type: 'Feature' as const,
      geometry: {
        type: 'Point' as const,
        coordinates: [stop.stop_lon, stop.stop_lat] as [number, number],
      },
      properties: {
        stop_id: stop.stop_id,
        stop_name: stop.stop_name,
        category: stop.station_category ?? -1,
        active: index === searchActiveIndex,
      },
    })),
  }), [searchResults, searchActiveIndex])

  const showSearchResults = isInitialMode && searchResults.length > 0

  useFitBounds({
    mapRef,
    selectedStation,
    tripsData,
    journeyViewData,
    isViewingMode,
    searchResults: showSearchResults ? searchResults : undefined,
  })

  // Track last selected station to prevent re-centering
  useEffect(() => {
    if (selectedStation) {
      lastSelectedStationIdRef.current = selectedStation.stop_id
    } else {
      lastSelectedStationIdRef.current = null
    }
  }, [selectedStation])

  // Determine what is currently loading
  const loadingStatus = useMemo(() => {
    const statuses: string[] = []
    if (isLoadingStops && !selectedStation && viewState.zoom >= ZOOM_THRESHOLD) {
      statuses.push(t('map.loading.stops'))
    }
    if (isLoadingStation) {
      statuses.push(t('map.loading.stationDetails'))
    }
    if (isLoadingTrips) {
      statuses.push(t('map.loading.trips'))
    }
    if (isLoadingLocation) {
      statuses.push(t('map.loading.location'))
    }
    return statuses
  }, [isLoadingStops, isLoadingStation, isLoadingTrips, isLoadingLocation, selectedStation, viewState.zoom, t])

  const isLoading = loadingStatus.length > 0

  return (
    <div className="map-shell">
      <div className="map-controls-wrapper">
        {isInitialMode && (
          <MapSearchPanel
            onResultSelect={handleSearchResultSelect}
            onResultsChange={handleSearchResults}
          />
        )}
        {!hasJourney && (
          <div className="map-datetime-container">
            <div className="map-datetime__title">{t('map.datetime.title')}</div>
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
            </div>
          </div>
        )}
      </div>
      {availableTransportTypes.length > 0 && !isViewingMode && (
        <div className="map-controls-right">
          <TransportFilterDropdown
            availableTypes={availableTransportTypes}
            selectedTypes={selectedTransportTypes}
            onToggleType={handleToggleTransportType}
          />
        </div>
      )}
      <MapGL
        ref={mapRef}
        {...viewState}
        onLoad={handleLoad}
        onMove={handleMove}
        onClick={handleClick}
        onMouseEnter={handleMapMouseEnter}
        onMouseLeave={handleMapMouseLeave}
        interactiveLayerIds={['stops-layer']}
        cursor={isLoadingStation ? 'wait' : isHoveringStation ? 'pointer' : 'auto'}
        style={{ width: '100%', height: '100%' }}
        mapStyle={MAP_STYLE_URL}
        dragRotate={false}
        touchZoomRotate={false}
        touchPitch={false}
      >
        {/* Current journey as a faint backdrop while editing (under the trips) */}
        {!isViewingMode && journeyViewData && journeyViewData.legs.length > 0 && (
          <JourneyLayers
            journeyLegs={journeyLegsGeojsonData}
            walkingConnections={walkingConnectionsGeojsonData}
            lineOpacity={ROUTE_LINE_OPACITY}
            ghost
          />
        )}

        {tripsData && !isViewingMode && (
          <TripLayers data={tripLinesGeojsonData} lineOpacity={ROUTE_LINE_OPACITY} />
        )}

        {isViewingMode && journeyViewData && (
          <JourneyLayers
            journeyLegs={journeyLegsGeojsonData}
            walkingConnections={walkingConnectionsGeojsonData}
            lineOpacity={ROUTE_LINE_OPACITY}
          />
        )}

        <Source id="stops" type="geojson" data={stopsGeojsonData}>
          <Layer {...stopsLayerStyle} />
        </Source>

        {/* Search results as map markers (visual only; selection stays via the list) */}
        {showSearchResults && (
          <Source id="search-results" type="geojson" data={searchResultsGeojsonData}>
            <Layer {...searchResultsLayerStyle} />
          </Source>
        )}

        {/* Selected station with different icon */}
        {selectedStation && !isViewingMode && (
          <Source id="selected-stop" type="geojson" data={selectedStationGeojsonData}>
            <Layer
              id="selected-stop-layer"
              type="symbol"
              source="selected-stop"
              layout={{
                'icon-image': 'selected-stop-marker',
                'icon-size': 1,
                'icon-allow-overlap': true,
                'icon-anchor': 'bottom',
              }}
            />
          </Source>
        )}

        {/* Journey markers - grouped for walking transfers */}
        {isViewingMode && groupedMarkers.map((group, groupIndex) => (
          <div key={`journey-marker-group-${groupIndex}`}>
            {/* Invisible hover targets for each marker in the group */}
            {group.markers.map((marker, markerIndex) => (
              <Popup
                key={`hover-target-${groupIndex}-${markerIndex}`}
                longitude={marker.lon}
                latitude={marker.lat}
                anchor="bottom"
                offset={[0, 0]}
                closeButton={false}
                closeOnClick={false}
                className="journey-marker-target"
                onClose={() => {}}
              >
                <div
                  onMouseEnter={() => handleMarkerHoverEnter(groupIndex)}
                  onMouseLeave={handleMarkerHoverLeave}
                  style={{
                    width: '48px',
                    height: '56px',
                    cursor: 'pointer',
                  }}
                />
              </Popup>
            ))}

            {/* Single popover for the group, shown when any marker is hovered */}
            {hoveredJourneyMarkerIndex === groupIndex && (
              <Popup
                longitude={group.centerLon}
                latitude={group.centerLat}
                anchor={group.isWalkingTransfer ? 'bottom' : (group.markers[0].anchor || 'bottom')}
                offset={group.isWalkingTransfer ? [0, -15] : group.markers[0].offset}
                closeButton={false}
                closeOnClick={false}
                className="journey-marker-popup"
              >
                <div
                  onMouseEnter={() => handleMarkerHoverEnter(groupIndex)}
                  onMouseLeave={handleMarkerHoverLeave}
                >
                  <JourneyMarkerPopover markers={group.markers} />
                </div>
              </Popup>
            )}
          </div>
        ))}
      </MapGL>

      {/* Geolocation button */}
      <button
        className="map-locate-button"
        onClick={handleLocateClick}
        disabled={isLoadingLocation}
        title={t('map.locateButton')}
        aria-label={t('map.locateButton')}
      >
        <FontAwesomeIcon icon={faLocationCrosshairs} spin={isLoadingLocation} />
      </button>

      {/* Hover panel for trip selection - hidden in journey view mode */}
      <StationHoverOverlay
        hoveredStation={hoveredStation}
        trips={tripsData?.trips}
        isViewingMode={isViewingMode}
        onTripSelect={handleHoverTripSelect}
        onClose={closePanel}
      />

      {/* Loading indicator */}
      {isLoading && (
        <div className="map-loading-indicator">
          <FontAwesomeIcon icon={faSpinner} spin className="map-loading-indicator__spinner" />
          <span className="map-loading-indicator__text">{loadingStatus.join(', ')}</span>
        </div>
      )}
    </div>
  )
}
