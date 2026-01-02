import { useState, useMemo, useCallback, useEffect, useRef } from 'react'
import Map, { MapViewState } from './components/Map'
import Sidebar from './components/Sidebar'
import TripDetailModal from './components/TripDetailModal'
import { models } from '../wailsjs/go/models'
import { GetStationDetails, GetRouteByID, SaveJourney, LoadJourney, ShowConfirmDialog } from '../wailsjs/go/main/App'
import { useTrips, TripQueryParams } from './components/map/useTrips'
import { useJourneyView } from './hooks/useJourneyView'
import { useSettings } from './hooks/useSettings'
import { useTranslation } from 'react-i18next'
import './App.css'

const UPCOMING_TRIPS_LIMIT = 10

// Saved trip for the journey planner
export interface SavedTrip {
  id: string
  tripId: string
  routeId: string
  routeType: number
  routeShortName: string
  routeColor: string
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

  // Journey view mode - displays the complete journey on the map
  const [journeyViewMode, setJourneyViewMode] = useState(false)

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

  // Handler to clear all saved trips
  const clearSavedTrips = useCallback(() => {
    setSavedTrips([])
    setJourneyViewMode(false)
    setHasUnsavedChanges(true)
  }, [])

  // Toggle journey view mode
  const toggleJourneyView = useCallback(() => {
    setJourneyViewMode(prev => !prev)
  }, [])

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
      startStationId: trip.start_station_id,
      startStationName: trip.start_station_name,
      departureDateTime: trip.departure_datetime,
      endStationId: destinationStopId,
      endStationName: destinationStopName,
      arrivalDateTime: arrivalDateTime,
    }
    addSavedTrip(savedTrip)

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
  }, [addSavedTrip, settings.connectionTimeMinutes])

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
        for (const tripData of journey.savedTrips) {
          try {
            // Fetch route info
            const route = await GetRouteByID(tripData.routeId)
            // Fetch station names
            const startStation = await GetStationDetails(tripData.startStationId)
            const endStation = await GetStationDetails(tripData.endStationId)

            hydratedTrips.push({
              id: `${tripData.tripId}-${tripData.endStationId}-${Date.now()}`,
              tripId: tripData.tripId,
              routeId: tripData.routeId,
              routeType: route.route_type,
              routeShortName: route.route_short_name,
              routeColor: route.route_color,
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
          setJourneyViewMode(true)
        }
      }
    } catch (err) {
      console.error('Failed to load journey:', err)
    }
  }, [hasUnsavedChanges, t])

  // Start new journey
  const handleNewJourney = useCallback(async () => {
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

    // Reset all journey state
    setSavedTrips([])
    setSelectedStation(null)
    setJourneyViewMode(false)
    const now = new Date()
    setSelectedDate(formatDateForInput(now))
    setSelectedTime(formatTimeForInput(now))
    setCurrentFilePath(null)
    setHasUnsavedChanges(false)
  }, [hasUnsavedChanges, t])

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
    return {
      stopId: selectedStation.stop_id,
      datetime: combineToISO8601(selectedDate, selectedTime),
      limit: UPCOMING_TRIPS_LIMIT,
      radiusMeters: settings.nearbyStationRadius,
    }
  }, [selectedStation, selectedDate, selectedTime, settings.nearbyStationRadius])

  // Fetch upcoming trips when a station is selected
  const { tripsData, isLoading: isLoadingTrips } = useTrips(tripQueryParams)

  // Fetch journey view data when in journey view mode
  const { data: journeyViewData, isLoading: isLoadingJourneyView } = useJourneyView(
    savedTrips,
    journeyViewMode
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
          journeyViewMode={journeyViewMode}
          journeyViewData={journeyViewData}
        />
      </div>
      <Sidebar
        selectedStation={selectedStation}
        tripsData={tripsData}
        isLoadingTrips={isLoadingTrips}
        savedTrips={savedTrips}
        onRemoveSavedTrip={removeSavedTrip}
        onClearSavedTrips={clearSavedTrips}
        onTripClick={handleTripClick}
        hasUnsavedChanges={hasUnsavedChanges}
        currentFilePath={currentFilePath}
        onSaveJourney={handleSaveJourney}
        onLoadJourney={handleLoadJourney}
        onNewJourney={handleNewJourney}
        journeyViewMode={journeyViewMode}
        onToggleJourneyView={toggleJourneyView}
        journeyViewData={journeyViewData}
        isLoadingJourneyView={isLoadingJourneyView}
        journeyData={journeyData}
      />
      {tripModalData && selectedStation && (
        <TripDetailModal
          trip={tripModalData.trip}
          tripIndex={tripModalData.tripIndex}
          selectedStationId={selectedStation.stop_id}
          serviceDate={selectedDate.replace(/-/g, '')}
          onClose={closeTripModal}
          onTripSelection={handleTripSelection}
        />
      )}
    </div>
  )
}

export default App
