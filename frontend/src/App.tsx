import { useState } from 'react'
import Map, { MapViewState } from './components/Map'
import DebugSidebar from './components/DebugSidebar'
import { main } from '../wailsjs/go/models'
import './App.css'

function App() {
  const [viewState, setViewState] = useState<MapViewState | null>(null)
  const [selectedStation, setSelectedStation] = useState<main.StationDetails | null>(null)

  return (
    <div className="app-container">
      <div className="map-container">
        <Map
          onViewStateChange={setViewState}
          onStationSelect={setSelectedStation}
          selectedStation={selectedStation}
        />
      </div>
      <DebugSidebar viewState={viewState} selectedStation={selectedStation} />
    </div>
  )
}

export default App
