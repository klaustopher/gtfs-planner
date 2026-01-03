import { useState, useCallback, useMemo, useRef, useEffect } from 'react'
import type { ChangeEvent } from 'react'
import MapGL, { ViewStateChangeEvent, Source, Layer, Popup, MapRef } from 'react-map-gl/maplibre'
import type {
  CircleLayerSpecification,
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
import { useHoverStationPanel } from './map/hooks/useHoverStationPanel'
import { useDefaultMapLocation } from '../hooks/useDefaultMapLocation'
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
  selectedTransportTypes: Set<number>
  onToggleTransportType: React.Dispatch<React.SetStateAction<Set<number>>>
  availableTransportTypes: number[]
}

const ZOOM_THRESHOLD = 8
const ROUTE_LINE_OPACITY = 0.8
const SEARCH_FOCUS_ZOOM = 12
const MAPTILER_API_KEY='REDACTED_MAPTILER_KEY'
const MAPTILER_STYLE_URL = `https://api.maptiler.com/maps/dataviz-v4/style.json?key=${MAPTILER_API_KEY}`

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
  selectedTransportTypes,
  onToggleTransportType,
  availableTransportTypes,
}: MapProps) {
  const { t } = useTranslation()
  const defaultLocation = useDefaultMapLocation()

  // Derived values
  const isInitialMode = planningMode === 'initial' && !hasJourney
  const isViewingMode = planningMode === 'viewing'

  const [viewState, setViewState] = useState(defaultLocation)
  const [isLoadingStation, setIsLoadingStation] = useState(false)
  const [hoveredJourneyMarkerIndex, setHoveredJourneyMarkerIndex] = useState<number | null>(null)
  const boundsRef = useRef<Bounds | undefined>(undefined)
  const mapRef = useRef<MapRef | null>(null)
  const lastSelectedStationIdRef = useRef<string | null>(null)

  // Update viewState when defaultLocation changes (after geolocation is fetched)
  useEffect(() => {
    setViewState(defaultLocation)
  }, [defaultLocation])

  // Fetch viewport stops when no station is selected
  const viewportStops = useStops({
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

  const {
    hoveredStation,
    handleMapMouseEnter,
    handleMapMouseLeave,
    handlePanelMouseEnter,
    handlePanelMouseLeave,
    handleHoverTripSelect,
  } = useHoverStationPanel({
    selectedStation,
    tripsData,
    onTripSelection,
  })

  useFitBounds({
    mapRef,
    selectedStation,
    tripsData,
    journeyViewData,
    isViewingMode,
  })

  // Track last selected station to prevent re-centering
  useEffect(() => {
    if (selectedStation) {
      lastSelectedStationIdRef.current = selectedStation.stop_id
    } else {
      lastSelectedStationIdRef.current = null
    }
  }, [selectedStation])

  return (
    <div className="map-shell">
      <div className="map-controls-wrapper">
        {isInitialMode && <MapSearchPanel onResultSelect={handleSearchResultSelect} />}
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
        cursor={isLoadingStation ? 'wait' : hoveredStation ? 'pointer' : 'auto'}
        style={{ width: '100%', height: '100%' }}
        mapStyle={MAPTILER_STYLE_URL}
      >
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
      <StationHoverOverlay
        hoveredStation={hoveredStation}
        trips={tripsData?.trips}
        isViewingMode={isViewingMode}
        onTripSelect={handleHoverTripSelect}
        onMouseEnter={handlePanelMouseEnter}
        onMouseLeave={handlePanelMouseLeave}
      />
    </div>
  )
}
