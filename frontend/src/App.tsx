import { useState, useMemo, useCallback, useEffect, useRef, type MouseEvent as ReactMouseEvent } from 'react'
import Map, { MapViewState } from './components/Map'
import Sidebar from './components/Sidebar'
import TripDetailModal from './components/TripDetailModal'
import GtfsSetupModal from './components/GtfsSetupModal'
import { models, main } from '../wailsjs/go/models'
import { GetStationDetails, GetRouteByID, SaveJourney, LoadJourney, ShowConfirmDialog, GetNearbyStations, GetUpcomingTripsForStations, GetDatabaseStatus, GetTransportCategories } from '../wailsjs/go/main/App'
import { useTrips, TripQueryParams } from './components/map/useTrips'
import { useJourneyView } from './hooks/useJourneyView'
import { useSettings } from './hooks/useSettings'
import { useTranslation } from 'react-i18next'
import { ALL_TRANSPORT_TYPES, sortTransportCategories } from './utils/transportType'
import { normalizeColor, FALLBACK_COLORS } from './components/map/geojson'
import './App.css'

const SIDEBAR_MIN_WIDTH = 280
const SIDEBAR_MAX_WIDTH = 680
const SIDEBAR_DEFAULT_WIDTH = 380

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
  // Resizable sidebar (persisted)
  const [sidebarWidth, setSidebarWidth] = useState<number>(() => {
    const saved = Number(localStorage.getItem('gtfs-planner-sidebar-width'))
    return saved >= SIDEBAR_MIN_WIDTH && saved <= SIDEBAR_MAX_WIDTH ? saved : SIDEBAR_DEFAULT_WIDTH
  })
  useEffect(() => {
    localStorage.setItem('gtfs-planner-sidebar-width', String(sidebarWidth))
  }, [sidebarWidth])

  const handleSidebarResize = useCallback((event: ReactMouseEvent) => {
    event.preventDefault()
    const startX = event.clientX
    const startWidth = sidebarWidth
    const onMove = (ev: MouseEvent) => {
      // Sidebar sits on the right, so dragging left widens it.
      const next = Math.min(SIDEBAR_MAX_WIDTH, Math.max(SIDEBAR_MIN_WIDTH, startWidth - (ev.clientX - startX)))
      setSidebarWidth(next)
    }
    const onUp = () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'
  }, [sidebarWidth])

  const [availableTransportTypes, setAvailableTransportTypes] = useState<number[]>(ALL_TRANSPORT_TYPES)
  const [selectedTransportTypes, setSelectedTransportTypes] = useState<Set<number>>(new Set(ALL_TRANSPORT_TYPES))

  // Accumulated trips state for load more functionality
  const [accumulatedTrips, setAccumulatedTrips] = useState<models.UpcomingTrip[]>([])
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  // Index of the first newly loaded trip, to scroll it into view after "load more".
  const pendingScrollIndexRef = useRef<number | null>(null)

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
  const [dbStatus, setDbStatus] = useState<main.DatabaseStatus | null>(null)

  // Planning mode state
  const [planningMode, setPlanningMode] = useState<PlanningMode>('initial')

  // Check the database status on startup; prompt for setup when it is missing,
  // expired, or close to expiry.
  const refreshDbStatus = useCallback(async (): Promise<main.DatabaseStatus | null> => {
    try {
      const status = await GetDatabaseStatus()
      setDbStatus(status)
      const needsSetup =
        status.state === 'missing' || status.state === 'expired' || status.state === 'critical'
      setShowGtfsSetupModal(needsSetup)
      if (status.hasData) {
        // Build the transport filter from the categories actually in this feed.
        try {
          const cats = await GetTransportCategories()
          if (cats && cats.length > 0) {
            const sorted = sortTransportCategories(cats)
            setAvailableTransportTypes(sorted)
            setSelectedTransportTypes(new Set(sorted))
          }
        } catch (catErr) {
          console.error('Failed to get transport categories:', catErr)
        }
      }
      return status
    } catch (err) {
      console.error('Failed to get database status:', err)
      setShowGtfsSetupModal(true)
      return null
    }
  }, [])

  useEffect(() => {
    void refreshDbStatus()
  }, [refreshDbStatus])

  // The settings screen dispatches this after deleting the database.
  useEffect(() => {
    const handler = () => {
      void refreshDbStatus()
    }
    window.addEventListener('gtfs:db-changed', handler)
    return () => {
      window.removeEventListener('gtfs:db-changed', handler)
    }
  }, [refreshDbStatus])

  const handleGtfsImported = useCallback(() => {
    void refreshDbStatus().then((status) => {
      if (status && (status.state === 'ok' || status.state === 'warning')) {
        setShowGtfsSetupModal(false)
      }
    })
  }, [refreshDbStatus])

  // Derived values
  const isViewingMode = planningMode === 'viewing'
  const hasJourney = savedTrips.length > 0
  const canEditTime = planningMode === 'initial' && savedTrips.length === 0

  // Handler for station selection that resets time to now when station is cleared
  const handleStationSelect = useCallback((station: models.StationDetails | null) => {
    setSelectedStation(station)
    if (station === null && !hasJourney) {
      // Reset time to now when deselecting station without journey
      const now = new Date()
      setSelectedDate(formatDateForInput(now))
      setSelectedTime(formatTimeForInput(now))
    }
  }, [hasJourney])

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
      const removed = prev.find(t => t.id === tripId)
      const newTrips = prev.filter(t => t.id !== tripId)

      // If all trips removed, return to the removed leg's departure station so
      // the user lands back at the previous stop, not on the empty start screen.
      if (newTrips.length === 0) {
        setPlanningMode('initial')
        if (removed) {
          GetStationDetails(removed.startStationId)
            .then(stationDetails => setSelectedStation(stationDetails))
            .catch(err => console.error('Failed to fetch station details:', err))
          const departure = new Date(removed.departureDateTime)
          setSelectedDate(formatDateForInput(departure))
          setSelectedTime(formatTimeForInput(departure))
        } else {
          handleStationSelect(null)
        }
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
  }, [settings.connectionTimeMinutes, handleStationSelect])

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
    // Warn about unsaved changes only if there are actual saved trips
    if (hasUnsavedChanges && savedTrips.length > 0) {
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
  }, [hasUnsavedChanges, savedTrips.length, t])

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

  // Build single source of truth for trips data using accumulated trips
  const currentTripsData = useMemo(() => {
    if (!tripsData) return null

    // Extract all unique stations from accumulated trips
    const stationsById: Record<string, models.Stop> = {}
    for (const trip of accumulatedTrips) {
      for (const stopTime of trip.stop_times) {
        if (!stationsById[stopTime.stop_id]) {
          stationsById[stopTime.stop_id] = new models.Stop({
            stop_id: stopTime.stop_id,
            stop_name: stopTime.stop_name,
            stop_lat: stopTime.stop_lat,
            stop_lon: stopTime.stop_lon,
          })
        }
      }
    }
    const stations = Object.values(stationsById)

    return new models.UpcomingTripsData({
      trips: accumulatedTrips,
      stations: stations,
    })
  }, [tripsData, accumulatedTrips])

  // Reset accumulated trips and transport filter when station changes
  useEffect(() => {
    setAccumulatedTrips([])
    // Reset to all types selected
    setSelectedTransportTypes(new Set(availableTransportTypes))
  }, [selectedStation, selectedDate, selectedTime, selectedNearbyStationIds, availableTransportTypes])

  // Handler to load more trips
  const handleLoadMore = useCallback(async () => {
    if (!selectedStation || accumulatedTrips.length === 0 || isLoadingMore) return

    const firstNewIndex = accumulatedTrips.length

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
        pendingScrollIndexRef.current = firstNewIndex
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

  // After "load more" completes, scroll the first newly loaded departure into view.
  useEffect(() => {
    if (pendingScrollIndexRef.current === null) return
    const index = pendingScrollIndexRef.current
    pendingScrollIndexRef.current = null
    requestAnimationFrame(() => {
      const el = document.querySelector(`[data-trip-index="${index}"]`)
      el?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    })
  }, [accumulatedTrips])

  // Quick "step back": same as the X button in the journey view — remove the
  // last boarded leg. When nothing is boarded, clear the current station.
  const handleStepBack = useCallback(() => {
    if (savedTrips.length > 0) {
      void removeSavedTrip(savedTrips[savedTrips.length - 1].id)
    } else if (selectedStation) {
      handleStationSelect(null)
    }
  }, [savedTrips, selectedStation, removeSavedTrip, handleStationSelect])

  // Fetch journey view data when in journey view mode
  // Compute journey geometry whenever a journey exists (not only in viewing
  // mode) so the route so far can be drawn as a faint backdrop while editing.
  const { data: journeyViewData, isLoading: isLoadingJourneyView } = useJourneyView(
    savedTrips,
    isViewingMode || savedTrips.length > 0
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
          onStationSelect={handleStationSelect}
          selectedStation={selectedStation}
          tripsData={currentTripsData}
          isLoadingTrips={isLoadingTrips}
          savedTrips={savedTrips}
          selectedDate={selectedDate}
          selectedTime={selectedTime}
          onDateChange={setSelectedDate}
          onTimeChange={setSelectedTime}
          onTripSelection={handleTripSelection}
          planningMode={planningMode}
          canEditTime={canEditTime}
          hasJourney={hasJourney}
          journeyViewData={journeyViewData}
          selectedTransportTypes={selectedTransportTypes}
          onToggleTransportType={setSelectedTransportTypes}
          availableTransportTypes={availableTransportTypes}
        />
      </div>
      <div
        className="sidebar-resize-handle"
        onMouseDown={handleSidebarResize}
        role="separator"
        aria-orientation="vertical"
        title={t('map.resizeSidebar')}
      />
      <Sidebar
        width={sidebarWidth}
        selectedStation={selectedStation}
        tripsData={currentTripsData}
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
        onLoadMore={handleLoadMore}
        isLoadingMore={isLoadingMore}
        onStepBack={handleStepBack}
        canStepBack={savedTrips.length > 0 || !!selectedStation}
        selectedDate={selectedDate}
        selectedTime={selectedTime}
      />
      {tripModalData && selectedStation && (
        <TripDetailModal
          trip={tripModalData.trip}
          tripIndex={tripModalData.tripIndex}
          serviceDate={tripModalData.trip.service_date || selectedDate.replace(/-/g, '')}
          onClose={closeTripModal}
          onTripSelection={handleTripSelection}
        />
      )}
      <GtfsSetupModal
        isOpen={showGtfsSetupModal}
        status={dbStatus}
        onClose={
          dbStatus && dbStatus.state !== 'missing'
            ? () => setShowGtfsSetupModal(false)
            : undefined
        }
        onImported={handleGtfsImported}
      />
    </div>
  )
}

export default App
