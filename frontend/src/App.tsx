import { useState, useMemo, useCallback } from 'react'
import Map, { MapViewState } from './components/Map'
import Sidebar from './components/Sidebar'
import TripDetailModal from './components/TripDetailModal'
import { models } from '../wailsjs/go/models'
import { GetStationDetails, GetRouteByID, SaveJourney, LoadJourney, ShowConfirmDialog } from '../wailsjs/go/main/App'
import { useTrips, TripQueryParams } from './components/map/useTrips'
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
        // Set date/time to arrival + 5 minutes
        const { date, time } = addMinutesToDateTime(lastTrip.arrivalDateTime, 5)
        setSelectedDate(date)
        setSelectedTime(time)
      }

      return newTrips
    })
    setHasUnsavedChanges(true)
  }, [])

  // Handler to clear all saved trips
  const clearSavedTrips = useCallback(() => {
    setSavedTrips([])
    setHasUnsavedChanges(true)
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

    // Set date/time to arrival + 5 minutes
    const { date, time } = addMinutesToDateTime(arrivalDateTime, 5)
    setSelectedDate(date)
    setSelectedTime(time)
  }, [addSavedTrip])

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
    const now = new Date()
    setSelectedDate(formatDateForInput(now))
    setSelectedTime(formatTimeForInput(now))
    setCurrentFilePath(null)
    setHasUnsavedChanges(false)
  }, [hasUnsavedChanges, t])

  // Build trip query params when station is selected
  const tripQueryParams: TripQueryParams | null = useMemo(() => {
    if (!selectedStation) return null
    return {
      stopId: selectedStation.stop_id,
      datetime: combineToISO8601(selectedDate, selectedTime),
      limit: UPCOMING_TRIPS_LIMIT,
    }
  }, [selectedStation, selectedDate, selectedTime])

  // Fetch upcoming trips when a station is selected
  const { tripsData, isLoading: isLoadingTrips } = useTrips(tripQueryParams)

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
      />
      {tripModalData && selectedStation && (
        <TripDetailModal
          trip={tripModalData.trip}
          tripIndex={tripModalData.tripIndex}
          selectedStationId={selectedStation.stop_id}
          serviceDate={selectedDate.replace(/-/g, '')}
          onClose={closeTripModal}
        />
      )}
    </div>
  )
}

export default App
