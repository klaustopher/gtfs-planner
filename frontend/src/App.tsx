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
  departureTime: string
  endStationId: string
  endStationName: string
  arrivalTime: string
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

// Convert YYYY-MM-DD to YYYYMMDD
function inputDateToYYYYMMDD(inputDate: string): string {
  return inputDate.replace(/-/g, '')
}

// Convert HH:MM to HH:MM:SS
function inputTimeToHHMMSS(inputTime: string): string {
  return `${inputTime}:00`
}

// Add minutes to a time string (HH:MM or HH:MM:SS) and return HH:MM
function addMinutesToTime(time: string, minutes: number): string {
  const parts = time.split(':')
  const hours = parseInt(parts[0], 10)
  const mins = parseInt(parts[1], 10)
  const totalMinutes = hours * 60 + mins + minutes
  const newHours = Math.floor(totalMinutes / 60) % 24
  const newMins = totalMinutes % 60
  return `${String(newHours).padStart(2, '0')}:${String(newMins).padStart(2, '0')}`
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
  const removeSavedTrip = useCallback((tripId: string) => {
    setSavedTrips(prev => prev.filter(t => t.id !== tripId))
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
    arrivalTime: string
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
      departureTime: trip.departure_time,
      endStationId: destinationStopId,
      endStationName: destinationStopName,
      arrivalTime: arrivalTime,
    }
    addSavedTrip(savedTrip)

    // Fetch destination station details and set as selected
    try {
      const stationDetails = await GetStationDetails(destinationStopId)
      setSelectedStation(stationDetails)
    } catch (err) {
      console.error('Failed to fetch station details:', err)
    }

    // Set time to arrival + 5 minutes
    const newTime = addMinutesToTime(arrivalTime, 5)
    setSelectedTime(newTime)
  }, [addSavedTrip])

  // Build trip query params when station is selected
  const tripQueryParams: TripQueryParams | null = useMemo(() => {
    if (!selectedStation) return null
    return {
      stopId: selectedStation.stop_id,
      date: inputDateToYYYYMMDD(selectedDate),
      time: inputTimeToHHMMSS(selectedTime),
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
