import { useTranslation } from 'react-i18next'
import { models } from '../../wailsjs/go/models'
import TripListItem from './TripListItem'

interface StationDeparturesCardProps {
  selectedStation: models.StationDetails | null
  savedTripsCount: number
  tripsData: models.UpcomingTripsData | null
  isLoadingTrips: boolean
  onTripClick: (trip: models.UpcomingTrip, tripIndex: number) => void
  timeLocale: string
}

export default function StationDeparturesCard({
  selectedStation,
  savedTripsCount,
  tripsData,
  isLoadingTrips,
  onTripClick,
  timeLocale,
}: StationDeparturesCardProps) {
  const { t } = useTranslation()

  return (
    <div className="sidebar-card sidebar-card--flex">
      <div className="sidebar-card__header">
        <h3 className="sidebar-card__title">
          {selectedStation ? selectedStation.stop_name : t('stationSection.selectPrompt')}
        </h3>
      </div>

      {!selectedStation && savedTripsCount === 0 && (
        <p className="sidebar-hint">{t('stationSection.initialHint')}</p>
      )}

      {!selectedStation && savedTripsCount > 0 && (
        <p className="sidebar-hint">{t('stationSection.hint')}</p>
      )}

      {selectedStation && (
        <div className="trips-section">
          {isLoadingTrips && <p className="sidebar-hint">{t('stationSection.loading')}</p>}
          {!isLoadingTrips && tripsData && tripsData.trips && tripsData.trips.length > 0 && (
            <div className="trips-list">
              {tripsData.trips.map((trip, index) => (
                <TripListItem
                  key={trip.trip_id}
                  trip={trip}
                  index={index}
                  selectedStation={selectedStation}
                  onTripClick={onTripClick}
                  timeLocale={timeLocale}
                />
              ))}
            </div>
          )}
          {!isLoadingTrips && tripsData && (!tripsData.trips || tripsData.trips.length === 0) && (
            <p className="sidebar-hint">{t('stationSection.empty')}</p>
          )}
        </div>
      )}
    </div>
  )
}
