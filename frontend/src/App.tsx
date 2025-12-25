import { useState, useMemo } from 'react'
import Map, { MapViewState } from './components/Map'
import DebugSidebar from './components/DebugSidebar'
import { models } from '../wailsjs/go/models'
import { useTrips, TripQueryParams } from './components/map/useTrips'
import './App.css'

const UPCOMING_TRIPS_LIMIT = 10

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

function App() {
  const [viewState, setViewState] = useState<MapViewState | null>(null)
  const [selectedStation, setSelectedStation] = useState<models.StationDetails | null>(null)

  // Date/time state - initialize with current date and time
  const now = useMemo(() => new Date(), [])
  const [selectedDate, setSelectedDate] = useState(() => formatDateForInput(now))
  const [selectedTime, setSelectedTime] = useState(() => formatTimeForInput(now))

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
        />
      </div>
      <DebugSidebar
        viewState={viewState}
        selectedStation={selectedStation}
        tripsData={tripsData}
        isLoadingTrips={isLoadingTrips}
      />
    </div>
  )
}

export default App
