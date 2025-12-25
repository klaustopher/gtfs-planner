import { useState, useMemo, useCallback } from 'react'
import Map, { MapViewState } from './components/Map'
import DebugSidebar from './components/DebugSidebar'
import { models } from '../wailsjs/go/models'
import { GetStationDetails } from '../wailsjs/go/main/App'
import { useTrips, TripQueryParams } from './components/map/useTrips'
import './App.css'

const UPCOMING_TRIPS_LIMIT = 10

// Saved trip for the journey planner
export interface SavedTrip {
  id: string
  tripId: string
  routeId: string
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
  const [viewState, setViewState] = useState<MapViewState | null>(null)
  const [selectedStation, setSelectedStation] = useState<models.StationDetails | null>(null)

  // Date/time state - initialize with current date and time
  const now = useMemo(() => new Date(), [])
  const [selectedDate, setSelectedDate] = useState(() => formatDateForInput(now))
  const [selectedTime, setSelectedTime] = useState(() => formatTimeForInput(now))

  // Saved trips for journey planner
  const [savedTrips, setSavedTrips] = useState<SavedTrip[]>([])

  // Handler to add a trip to the saved list
  const addSavedTrip = useCallback((trip: SavedTrip) => {
    setSavedTrips(prev => [...prev, trip])
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
  }, [])

  // Handler to clear all saved trips
  const clearSavedTrips = useCallback(() => {
    setSavedTrips([])
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
          selectedDate={selectedDate}
          selectedTime={selectedTime}
          onDateChange={setSelectedDate}
          onTimeChange={setSelectedTime}
          onTripSelection={handleTripSelection}
        />
      </div>
      <DebugSidebar
        viewState={viewState}
        selectedStation={selectedStation}
        tripsData={tripsData}
        isLoadingTrips={isLoadingTrips}
        savedTrips={savedTrips}
        onRemoveSavedTrip={removeSavedTrip}
        onClearSavedTrips={clearSavedTrips}
      />
    </div>
  )
}

export default App
