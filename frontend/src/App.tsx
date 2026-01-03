import { useState, useMemo, useCallback, useEffect, useRef } from 'react'
import Map, { MapViewState } from './components/Map'
import Sidebar from './components/Sidebar'
import TripDetailModal from './components/TripDetailModal'
import GtfsSetupModal from './components/GtfsSetupModal'
import { models } from '../wailsjs/go/models'
import { GetStationDetails, GetRouteByID, SaveJourney, LoadJourney, ShowConfirmDialog, GetNearbyStations, GetUpcomingTripsForStations, CheckDatabaseExists } from '../wailsjs/go/main/App'
import { useTrips, TripQueryParams } from './components/map/useTrips'
import { useJourneyView } from './hooks/useJourneyView'
import { useSettings } from './hooks/useSettings'
import { useTranslation } from 'react-i18next'
import { ALL_TRANSPORT_TYPES } from './utils/transportType'
import { normalizeColor, FALLBACK_COLORS } from './components/map/geojson'
import './App.css'

const UPCOMING_TRIPS_LIMIT = 10

// Planning mode state
type PlanningMode = 'initial' | 'planning' | 'viewing'

// Saved trip for the journey planner
export interface SavedTrip {
  id: string
  tripId: string
  routeId: string
  routeType: number
  routeShortName: string
  routeColor: string // Raw GTFS route color (may be empty/invalid)
  displayColor: string // Computed display color (with fallback applied) - always set
  startStationId: string
  startStationName: string
  departureDateTime: string // ISO 8601 format
  endStationId: string
  endStationName: string
  arrivalDateTime: string // ISO 8601 format
}

// Helper to format date for input[type="date"] (YYYY-MM-DD)
function formatDateForInput(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

// Helper to format time for input[type="time"] (HH:MM)
function formatTimeForInput(date: Date): string {
  const hours = String(date.getHours()).padStart(2, '0')
  const minutes = String(date.getMinutes()).padStart(2, '0')
  return `${hours}:${minutes}`
}

// Combine date and time inputs into ISO 8601 datetime string
function combineToISO8601(date: string, time: string): string {
  return `${date}T${time}:00`
}

// Add minutes to an ISO 8601 datetime and return updated date and time
function addMinutesToDateTime(isoDateTime: string, minutes: number): { date: string; time: string } {
  const d = new Date(isoDateTime)
  d.setMinutes(d.getMinutes() + minutes)
  return {
    date: formatDateForInput(d),
    time: formatTimeForInput(d),
  }
}

function App() {
  const { t } = useTranslation()
  const { settings } = useSettings()
  const [viewState, setViewState] = useState<MapViewState | null>(null)
  const [selectedStation, setSelectedStation] = useState<models.StationDetails | null>(null)

  // Nearby stations state
  const [nearbyStations, setNearbyStations] = useState<models.Stop[]>([])
  const [selectedNearbyStationIds, setSelectedNearbyStationIds] = useState<Set<string>>(new Set())

  // Transport type filter state - always show all GTFS route types
  const [selectedTransportTypes, setSelectedTransportTypes] = useState<Set<number>>(new Set(ALL_TRANSPORT_TYPES))

  // Accumulated trips state for load more functionality
  const [accumulatedTrips, setAccumulatedTrips] = useState<models.UpcomingTrip[]>([])
  const [isLoadingMore, setIsLoadingMore] = useState(false)

  // Date/time state - initialize with current date and time
  const now = useMemo(() => new Date(), [])
  const [selectedDate, setSelectedDate] = useState(() => formatDateForInput(now))
  const [selectedTime, setSelectedTime] = useState(() => formatTimeForInput(now))

  // Saved trips for journey planner
  const [savedTrips, setSavedTrips] = useState<SavedTrip[]>([])

  // Journey persistence state
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)
  const [currentFilePath, setCurrentFilePath] = useState<string | null>(null)

  // Modal state for trip details
  const [tripModalData, setTripModalData] = useState<{
    trip: models.UpcomingTrip
    tripIndex: number
  } | null>(null)

  // GTFS Setup Modal state
  const [showGtfsSetupModal, setShowGtfsSetupModal] = useState(false)

  // Planning mode state
  const [planningMode, setPlanningMode] = useState<PlanningMode>('initial')

  // Check if database exists on startup
  useEffect(() => {
    const checkDatabase = async () => {
      try {
        const dbExists = await CheckDatabaseExists()
        console.log('Database exists check:', dbExists)
        if (!dbExists) {
          console.log('Database not found, showing setup modal')
          setShowGtfsSetupModal(true)
        }
      } catch (err) {
        console.error('Failed to check database:', err)
        setShowGtfsSetupModal(true)
      }
    }
    void checkDatabase()
  }, [])

  // Derived values
  const isViewingMode = planningMode === 'viewing'
  const hasJourney = savedTrips.length > 0
  const canEditTime = planningMode === 'initial' && savedTrips.length === 0

  // Fetch nearby stations when selected station changes
  useEffect(() => {
    if (!selectedStation) {
      setNearbyStations([])
      setSelectedNearbyStationIds(new Set())
      setAccumulatedTrips([])
      return
    }

    const fetchNearbyStations = async () => {
      try {
        const nearby = await GetNearbyStations(selectedStation.stop_id, 200)
        setNearbyStations(nearby || [])
        // Reset selected nearby stations when main station changes
        setSelectedNearbyStationIds(new Set())
        setAccumulatedTrips([])
      } catch (err) {
        console.error('Failed to fetch nearby stations:', err)
        setNearbyStations([])
        setSelectedNearbyStationIds(new Set())
        setAccumulatedTrips([])
      }
    }

    void fetchNearbyStations()
  }, [selectedStation])

  // Handler to toggle nearby station selection
  const toggleNearbyStation = useCallback((stationId: string) => {
    setSelectedNearbyStationIds(prev => {
      const newSet = new Set(prev)
      if (newSet.has(stationId)) {
        newSet.delete(stationId)
      } else {
        newSet.add(stationId)
      }
      return newSet
    })
  }, [])

  // Handler to add a trip to the saved list
  const addSavedTrip = useCallback((trip: SavedTrip) => {
    setSavedTrips(prev => [...prev, trip])
    setHasUnsavedChanges(true)
  }, [])

  // Handler to remove a trip from the saved list
  // When removing the last trip, reset to the arrival station of the remaining trips
  const removeSavedTrip = useCallback(async (tripId: string) => {
    setSavedTrips(prev => {
      const newTrips = prev.filter(t => t.id !== tripId)

      // If all trips removed, return to initial mode and clear station
      if (newTrips.length === 0) {
        setPlanningMode('initial')
        setSelectedStation(null)
      }

      // If there are remaining trips, reset to the last trip's arrival station
      if (newTrips.length > 0) {
        const lastTrip = newTrips[newTrips.length - 1]
        // Fetch station details and update state (async, outside of setState)
        GetStationDetails(lastTrip.endStationId)
          .then(stationDetails => {
            setSelectedStation(stationDetails)
          })
          .catch(err => {
            console.error('Failed to fetch station details:', err)
          })
        // Set date/time to arrival + connection time
        const { date, time } = addMinutesToDateTime(lastTrip.arrivalDateTime, settings.connectionTimeMinutes)
        setSelectedDate(date)
        setSelectedTime(time)
      }

      return newTrips
    })
    setHasUnsavedChanges(true)
  }, [settings.connectionTimeMinutes])

  // Enter journey view mode
  const enterViewMode = useCallback(() => {
    if (savedTrips.length === 0) return
    setPlanningMode('viewing')
  }, [savedTrips.length])

  // Return to planning mode from viewing
  const returnToPlanning = useCallback(async () => {
    setPlanningMode('planning')

    // Auto-select last arrival station
    if (savedTrips.length > 0) {
      const lastTrip = savedTrips[savedTrips.length - 1]
      try {
        const stationDetails = await GetStationDetails(lastTrip.endStationId)
        setSelectedStation(stationDetails)
      } catch (err) {
        console.error('Failed to fetch station details:', err)
      }

      // Set time to last arrival + connection time
      const { date, time } = addMinutesToDateTime(
        lastTrip.arrivalDateTime,
        settings.connectionTimeMinutes
      )
      setSelectedDate(date)
      setSelectedTime(time)
    }
  }, [savedTrips, settings.connectionTimeMinutes])

  // Handler to open trip detail modal
  const handleTripClick = useCallback((trip: models.UpcomingTrip, tripIndex: number) => {
    setTripModalData({ trip, tripIndex })
  }, [])

  // Handler to close trip detail modal
  const closeTripModal = useCallback(() => {
    setTripModalData(null)
  }, [])

  // Handler when user selects a trip from the hover panel
  // This adds the trip to saved list, sets destination as selected station, and advances time
  const handleTripSelection = useCallback(async (
    trip: models.UpcomingTrip,
    tripIndex: number,
    displayColor: string,
    destinationStopId: string,
    destinationStopName: string,
    arrivalDateTime: string
  ) => {
    // Create the saved trip
    const savedTrip: SavedTrip = {
      id: `${trip.trip_id}-${destinationStopId}-${Date.now()}`,
      tripId: trip.trip_id,
      routeId: trip.route_id,
      routeType: trip.route_type,
      routeShortName: trip.display_name,
      routeColor: trip.route_color,
      displayColor: displayColor,
      startStationId: trip.start_station_id,
      startStationName: trip.start_station_name,
      departureDateTime: trip.departure_datetime,
      endStationId: destinationStopId,
      endStationName: destinationStopName,
      arrivalDateTime: arrivalDateTime,
    }
    addSavedTrip(savedTrip)

    // Enter planning mode when first trip is added
    if (savedTrips.length === 0) {
      setPlanningMode('planning')
    }

    // Fetch destination station details and set as selected
    try {
      const stationDetails = await GetStationDetails(destinationStopId)
      setSelectedStation(stationDetails)
    } catch (err) {
      console.error('Failed to fetch station details:', err)
    }

    // Set date/time to arrival + connection time
    const { date, time } = addMinutesToDateTime(arrivalDateTime, settings.connectionTimeMinutes)
    setSelectedDate(date)
    setSelectedTime(time)
  }, [addSavedTrip, savedTrips.length, settings.connectionTimeMinutes])

  // Save journey to file
  const handleSaveJourney = useCallback(async () => {
    try {
      const journeyData = new models.JourneyData({
        version: 1,
        createdAt: '',
        modifiedAt: '',
        savedTrips: savedTrips.map(t => new models.SavedTripData({
          tripId: t.tripId,
          routeId: t.routeId,
          startStationId: t.startStationId,
          departureDateTime: t.departureDateTime,
          endStationId: t.endStationId,
          arrivalDateTime: t.arrivalDateTime,
        })),
        selectedStationId: selectedStation?.stop_id || '',
        currentDateTime: combineToISO8601(selectedDate, selectedTime),
        mapView: viewState ? new models.MapView({
          longitude: viewState.longitude,
          latitude: viewState.latitude,
          zoom: viewState.zoom,
        }) : undefined,
      })
      const filePath = await SaveJourney(journeyData)
      if (filePath) {
        setCurrentFilePath(filePath)
        setHasUnsavedChanges(false)
      }
    } catch (err) {
      console.error('Failed to save journey:', err)
    }
  }, [savedTrips, selectedStation, selectedDate, selectedTime, viewState])

  // Load journey from file
  const handleLoadJourney = useCallback(async () => {
    // Warn about unsaved changes
    if (hasUnsavedChanges) {
      const confirmed = await ShowConfirmDialog(
        t('journey.unsaved.title'),
        t('journey.unsaved.message')
      )
      if (!confirmed) {
        return
      }
    }

    try {
      const result = await LoadJourney()
      if (result && result.journey) {
        const journey = result.journey

        // Hydrate saved trips from database
        const hydratedTrips: SavedTrip[] = []
        for (let i = 0; i < journey.savedTrips.length; i++) {
          const tripData = journey.savedTrips[i]
          try {
            // Fetch route info
            const route = await GetRouteByID(tripData.routeId)
            // Fetch station names
            const startStation = await GetStationDetails(tripData.startStationId)
            const endStation = await GetStationDetails(tripData.endStationId)

            // Compute display color with fallback (using trip index in journey)
            const normalizedColor = normalizeColor(route.route_color)
            const displayColor = normalizedColor ?? FALLBACK_COLORS[i % FALLBACK_COLORS.length]

            hydratedTrips.push({
              id: `${tripData.tripId}-${tripData.endStationId}-${Date.now()}`,
              tripId: tripData.tripId,
              routeId: tripData.routeId,
              routeType: route.route_type,
              routeShortName: route.route_short_name,
              routeColor: route.route_color,
              displayColor: displayColor,
              startStationId: tripData.startStationId,
              startStationName: startStation.stop_name,
              departureDateTime: tripData.departureDateTime,
              endStationId: tripData.endStationId,
              endStationName: endStation.stop_name,
              arrivalDateTime: tripData.arrivalDateTime,
            })
          } catch (err) {
            console.error('Failed to hydrate trip:', err)
          }
        }
        setSavedTrips(hydratedTrips)

        // Restore date/time from ISO 8601
        if (journey.currentDateTime) {
          const dt = new Date(journey.currentDateTime)
          setSelectedDate(formatDateForInput(dt))
          setSelectedTime(formatTimeForInput(dt))
        }

        // Restore selected station
        if (journey.selectedStationId) {
          try {
            const stationDetails = await GetStationDetails(journey.selectedStationId)
            setSelectedStation(stationDetails)
          } catch (err) {
            console.error('Failed to fetch station details:', err)
            setSelectedStation(null)
          }
        } else {
          setSelectedStation(null)
        }

        setCurrentFilePath(result.filePath)
        setHasUnsavedChanges(false)

        // Automatically enter journey view mode if there are trips
        if (hydratedTrips.length > 0) {
          setPlanningMode('viewing')
        }
      }
    } catch (err) {
      console.error('Failed to load journey:', err)
    }
  }, [hasUnsavedChanges, t])

  // Start new journey
  const handleNewJourney = useCallback(async () => {
    // Warn about unsaved changes or existing journey
    if (hasUnsavedChanges || savedTrips.length > 0) {
      const title = hasUnsavedChanges ? t('journey.unsaved.title') : t('journey.clearConfirm.title')
      const message = hasUnsavedChanges ? t('journey.unsaved.message') : t('journey.clearConfirm.message')

      const confirmed = await ShowConfirmDialog(title, message)
      if (!confirmed) {
        return
      }
    }

    // Reset all journey state
    setSavedTrips([])
    setSelectedStation(null)
    setPlanningMode('initial')
    const now = new Date()
    setSelectedDate(formatDateForInput(now))
    setSelectedTime(formatTimeForInput(now))
    setCurrentFilePath(null)
    setHasUnsavedChanges(false)
  }, [hasUnsavedChanges, savedTrips.length, t])

  // Handler to reset time to current time or last arrival + connection time
  const handleResetTime = useCallback(() => {
    if (savedTrips.length === 0) {
      // No saved trips - reset to current time
      const now = new Date()
      setSelectedDate(formatDateForInput(now))
      setSelectedTime(formatTimeForInput(now))
    } else {
      // Has saved trips - reset to last arrival + connection time
      const lastTrip = savedTrips[savedTrips.length - 1]
      const { date, time } = addMinutesToDateTime(lastTrip.arrivalDateTime, settings.connectionTimeMinutes)
      setSelectedDate(date)
      setSelectedTime(time)
    }
  }, [savedTrips, settings.connectionTimeMinutes])

  // Track previous connection time to detect changes
  const prevConnectionTimeRef = useRef(settings.connectionTimeMinutes)

  // Auto-adjust time when connection time setting changes and saved trips exist
  useEffect(() => {
    const prevConnectionTime = prevConnectionTimeRef.current
    if (savedTrips.length > 0 && prevConnectionTime !== settings.connectionTimeMinutes) {
      const lastTrip = savedTrips[savedTrips.length - 1]
      const { date, time } = addMinutesToDateTime(lastTrip.arrivalDateTime, settings.connectionTimeMinutes)
      setSelectedDate(date)
      setSelectedTime(time)
    }
    prevConnectionTimeRef.current = settings.connectionTimeMinutes
  }, [settings.connectionTimeMinutes, savedTrips])

  // Build trip query params when station is selected
  const tripQueryParams: TripQueryParams | null = useMemo(() => {
    if (!selectedStation) return null

    // Build array of station IDs: main station + selected nearby stations
    const stationIds = [selectedStation.stop_id, ...Array.from(selectedNearbyStationIds)]

    return {
      stopIds: stationIds,
      datetime: combineToISO8601(selectedDate, selectedTime),
      limit: UPCOMING_TRIPS_LIMIT,
      routeTypes: Array.from(selectedTransportTypes),
    }
  }, [selectedStation, selectedDate, selectedTime, selectedNearbyStationIds, selectedTransportTypes])

  // Fetch upcoming trips when a station is selected
  const { tripsData, isLoading: isLoadingTrips } = useTrips(tripQueryParams)

  // Update accumulated trips when new trips are fetched (reset on parameter change)
  useEffect(() => {
    if (tripsData && tripsData.trips) {
      setAccumulatedTrips(tripsData.trips)
    }
  }, [tripsData])

  // Reset accumulated trips and transport filter when station changes
  useEffect(() => {
    setAccumulatedTrips([])
    // Reset to all types selected
    setSelectedTransportTypes(new Set(ALL_TRANSPORT_TYPES))
  }, [selectedStation, selectedDate, selectedTime, selectedNearbyStationIds])

  // Handler to load more trips
  const handleLoadMore = useCallback(async () => {
    if (!selectedStation || accumulatedTrips.length === 0 || isLoadingMore) return

    // Find the trip with the latest departure time
    const latestTrip = accumulatedTrips.reduce((latest, trip) => {
      return trip.departure_datetime > latest.departure_datetime ? trip : latest
    }, accumulatedTrips[0])

    const stationIds = [selectedStation.stop_id, ...Array.from(selectedNearbyStationIds)]

    // Add one second to the latest trip's departure time to avoid loading the same trip again
    const latestTripTime = new Date(latestTrip.departure_datetime)
    latestTripTime.setSeconds(latestTripTime.getSeconds() + 1)

    // Format as local time (not UTC) to match backend expectations
    const year = latestTripTime.getFullYear()
    const month = String(latestTripTime.getMonth() + 1).padStart(2, '0')
    const day = String(latestTripTime.getDate()).padStart(2, '0')
    const hours = String(latestTripTime.getHours()).padStart(2, '0')
    const minutes = String(latestTripTime.getMinutes()).padStart(2, '0')
    const seconds = String(latestTripTime.getSeconds()).padStart(2, '0')
    const nextLoadTime = `${year}-${month}-${day}T${hours}:${minutes}:${seconds}`

    setIsLoadingMore(true)
    try {
      const moreTrips = await GetUpcomingTripsForStations(
        stationIds,
        nextLoadTime,
        UPCOMING_TRIPS_LIMIT,
        Array.from(selectedTransportTypes)
      )
      if (moreTrips && moreTrips.trips && moreTrips.trips.length > 0) {
        setAccumulatedTrips(prev => {
          const combined = [...prev, ...moreTrips.trips]
          // Sort by departure_datetime to ensure chronological order
          return combined.sort((a, b) =>
            a.departure_datetime.localeCompare(b.departure_datetime)
          )
        })
      }
    } catch (err) {
      console.error('Failed to load more trips:', err)
    } finally {
      setIsLoadingMore(false)
    }
  }, [selectedStation, selectedNearbyStationIds, accumulatedTrips, isLoadingMore, selectedTransportTypes])

  // Fetch journey view data when in journey view mode
  const { data: journeyViewData, isLoading: isLoadingJourneyView } = useJourneyView(
    savedTrips,
    isViewingMode
  )

  // Build journey data for export
  const journeyData = useMemo(() => {
    if (savedTrips.length === 0) return null

    return new models.JourneyData({
      version: 1,
      createdAt: '',
      modifiedAt: '',
      savedTrips: savedTrips.map(t => new models.SavedTripData({
        tripId: t.tripId,
        routeId: t.routeId,
        startStationId: t.startStationId,
        departureDateTime: t.departureDateTime,
        endStationId: t.endStationId,
        arrivalDateTime: t.arrivalDateTime,
      })),
      selectedStationId: selectedStation?.stop_id || '',
      currentDateTime: combineToISO8601(selectedDate, selectedTime),
      mapView: viewState ? new models.MapView({
        longitude: viewState.longitude,
        latitude: viewState.latitude,
        zoom: viewState.zoom,
      }) : undefined,
    })
  }, [savedTrips, selectedStation, selectedDate, selectedTime, viewState])

  return (
    <div className="app-container">
      <div className="map-container">
        <Map
          onViewStateChange={setViewState}
          onStationSelect={setSelectedStation}
          selectedStation={selectedStation}
          tripsData={tripsData}
          savedTrips={savedTrips}
          selectedDate={selectedDate}
          selectedTime={selectedTime}
          onDateChange={setSelectedDate}
          onTimeChange={setSelectedTime}
          onTripSelection={handleTripSelection}
          onResetTime={handleResetTime}
          planningMode={planningMode}
          canEditTime={canEditTime}
          hasJourney={hasJourney}
          journeyViewData={journeyViewData}
          selectedTransportTypes={selectedTransportTypes}
          onToggleTransportType={setSelectedTransportTypes}
          availableTransportTypes={ALL_TRANSPORT_TYPES}
        />
      </div>
      <Sidebar
        selectedStation={selectedStation}
        tripsData={tripsData}
        isLoadingTrips={isLoadingTrips}
        savedTrips={savedTrips}
        onRemoveSavedTrip={removeSavedTrip}
        onTripClick={handleTripClick}
        hasUnsavedChanges={hasUnsavedChanges}
        currentFilePath={currentFilePath}
        onSaveJourney={handleSaveJourney}
        onLoadJourney={handleLoadJourney}
        onNewJourney={handleNewJourney}
        planningMode={planningMode}
        onEnterViewMode={enterViewMode}
        onReturnToPlanning={returnToPlanning}
        journeyViewData={journeyViewData}
        isLoadingJourneyView={isLoadingJourneyView}
        journeyData={journeyData}
        nearbyStations={nearbyStations}
        selectedNearbyStationIds={selectedNearbyStationIds}
        onToggleNearbyStation={toggleNearbyStation}
        accumulatedTrips={accumulatedTrips}
        onLoadMore={handleLoadMore}
        isLoadingMore={isLoadingMore}
        selectedDate={selectedDate}
        selectedTime={selectedTime}
      />
      {tripModalData && selectedStation && (
        <TripDetailModal
          trip={tripModalData.trip}
          tripIndex={tripModalData.tripIndex}
          serviceDate={selectedDate.replace(/-/g, '')}
          onClose={closeTripModal}
          onTripSelection={handleTripSelection}
        />
      )}
      <GtfsSetupModal
        isOpen={showGtfsSetupModal}
        onClose={undefined}
      />
    </div>
  )
}

export default App
