import { useEffect } from 'react'
import type { RefObject } from 'react'
import { LngLatBounds } from 'maplibre-gl'
import type { MapRef } from 'react-map-gl/maplibre'
import { models } from '../../../../wailsjs/go/models'
import type { JourneyViewData } from '../../../hooks/useJourneyView'

interface UseFitBoundsOptions {
  mapRef: RefObject<MapRef | null>
  selectedStation?: models.StationDetails | null
  tripsData?: models.UpcomingTripsData | null
  journeyViewData?: JourneyViewData | null
  isViewingMode: boolean
  searchResults?: models.Stop[]
}

export function useFitBounds({
  mapRef,
  selectedStation,
  tripsData,
  journeyViewData,
  isViewingMode,
  searchResults,
}: UseFitBoundsOptions) {
  // Fit map to the current search results so all hits are visible at once
  useEffect(() => {
    if (!searchResults || searchResults.length === 0) {
      return
    }

    const map = mapRef.current?.getMap()
    if (!map) {
      return
    }

    const bounds = new LngLatBounds()
    for (const stop of searchResults) {
      bounds.extend([stop.stop_lon, stop.stop_lat])
    }

    map.fitBounds(bounds, {
      padding: { top: 80, bottom: 40, left: 350, right: 40 },
      maxZoom: 14,
      duration: 500,
    })
  }, [searchResults, mapRef])

  // Fit map to show trip routes when viewing a station
  useEffect(() => {
    if (!selectedStation || !tripsData?.stations || tripsData.stations.length === 0 || isViewingMode) {
      return
    }

    const map = mapRef.current?.getMap()
    if (!map) {
      return
    }

    const bounds = new LngLatBounds()
    bounds.extend([selectedStation.stop_lon, selectedStation.stop_lat])

    for (const station of tripsData.stations) {
      bounds.extend([station.stop_lon, station.stop_lat])
    }

    map.fitBounds(bounds, {
      padding: { top: 80, bottom: 40, left: 350, right: 40 },
      maxZoom: 13,
      duration: 500,
    })
  }, [selectedStation, tripsData, isViewingMode, mapRef])

  // Fit map to journey bounds when switching to viewing mode
  useEffect(() => {
    if (!isViewingMode || !journeyViewData || journeyViewData.legs.length === 0) {
      return
    }

    const map = mapRef.current?.getMap()
    if (!map) {
      return
    }

    const bounds = new LngLatBounds()
    for (const leg of journeyViewData.legs) {
      for (const coord of leg.coordinates) {
        bounds.extend([coord.lon, coord.lat])
      }
    }

    for (const walk of journeyViewData.walkingConnections) {
      bounds.extend([walk.fromLon, walk.fromLat])
      bounds.extend([walk.toLon, walk.toLat])
    }

    map.fitBounds(bounds, {
      padding: { top: 80, bottom: 40, left: 40, right: 40 },
      maxZoom: 14,
      duration: 500,
    })
  }, [isViewingMode, journeyViewData, mapRef])
}
