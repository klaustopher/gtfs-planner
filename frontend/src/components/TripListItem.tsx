import { useTranslation } from 'react-i18next'
import { models } from '../../wailsjs/go/models'
import { getTripColor } from './map/geojson'
import { getTransportTypeLabel } from '../utils/transportType'
import { formatTimeDisplay } from '../utils/time'

interface TripListItemProps {
  trip: models.UpcomingTrip
  index: number
  selectedStation: models.StationDetails | null
  onTripClick: (trip: models.UpcomingTrip, tripIndex: number) => void
  timeLocale: string
}

export default function TripListItem({
  trip,
  index,
  selectedStation,
  onTripClick,
  timeLocale,
}: TripListItemProps) {
  const { t } = useTranslation()
  const tripColor = getTripColor(trip, index)
  const isNearbyTrip = selectedStation && trip.start_station_id !== selectedStation.stop_id

  return (
    <button
      className="trip-item"
      style={{ borderLeftColor: tripColor }}
      onClick={() => onTripClick(trip, index)}
      aria-label={isNearbyTrip ? t('stationSection.nearbyStationAria') : undefined}
    >
      <span className="trip-time">{formatTimeDisplay(trip.departure_datetime, timeLocale)}</span>
      <div className="trip-details">
        <div className="trip-badges">
          <span className="trip-type-badge">
            {getTransportTypeLabel(trip.route_type, t)}
          </span>
          {trip.display_name && (
            <span
              className="trip-route-badge"
              style={{ backgroundColor: tripColor }}
            >
              {trip.display_name}
            </span>
          )}
          {isNearbyTrip && (
            <span className="trip-nearby-badge" title={trip.start_station_name}>
              ↔ <span className="trip-nearby-station">{trip.start_station_name}</span>
            </span>
          )}
        </div>
        <span className="trip-destination">{trip.destination}</span>
      </div>
    </button>
  )
}
