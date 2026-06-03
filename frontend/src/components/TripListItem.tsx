import { useTranslation } from 'react-i18next'
import { models } from '../../wailsjs/go/models'
import { getTripColor } from './map/geojson'
import { getTransportTypeLabel } from '../utils/transportType'
import { formatTimeDisplay } from '../utils/time'
import { getContrastTextColor } from '../utils/colorContrast'

interface TripListItemProps {
  trip: models.UpcomingTrip
  index: number
  selectedStation: models.StationDetails | null
  onTripClick: (trip: models.UpcomingTrip, tripIndex: number) => void
  timeLocale: string
  selectedDateTime: string
}

export default function TripListItem({
  trip,
  index,
  selectedStation,
  onTripClick,
  timeLocale,
  selectedDateTime,
}: TripListItemProps) {
  const { t } = useTranslation()
  const tripColor = getTripColor(trip, index)
  const isNearbyTrip = selectedStation && trip.start_station_id !== selectedStation.stop_id

  // Calculate day offset - compare dates only, not times
  // This handles GTFS 24+ hour notation correctly (e.g., 25:00 on day 1 becomes 01:00 on day 2)
  const selectedDate = new Date(selectedDateTime)
  const tripDate = new Date(trip.departure_datetime)

  // Normalize to midnight for date-only comparison
  const selectedDateOnly = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), selectedDate.getDate())
  const tripDateOnly = new Date(tripDate.getFullYear(), tripDate.getMonth(), tripDate.getDate())

  const daysDiff = Math.round((tripDateOnly.getTime() - selectedDateOnly.getTime()) / (1000 * 60 * 60 * 24))

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
              style={{
                backgroundColor: tripColor,
                color: getContrastTextColor(tripColor)
              }}
            >
              {trip.display_name}
            </span>
          )}
          {isNearbyTrip && (
            <span className="trip-nearby-badge" title={trip.start_station_name}>
              ↔ <span className="trip-nearby-station">{trip.start_station_name}</span>
            </span>
          )}
          {daysDiff > 0 && (
            <span className="trip-day-offset-badge" title={t('stationSection.dayOffsetTitle', { days: daysDiff })}>
              +{daysDiff}d
            </span>
          )}
        </div>
        <span className="trip-destination" title={trip.destination}>{trip.destination}</span>
      </div>
    </button>
  )
}
