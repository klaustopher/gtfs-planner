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
  nearbyStations: models.Stop[]
  selectedNearbyStationIds: Set<string>
  onToggleNearbyStation: (stationId: string) => void
  onLoadMore: () => void
  isLoadingMore: boolean
  selectedDateTime: string
}

export default function StationDeparturesCard({
  selectedStation,
  savedTripsCount,
  tripsData,
  isLoadingTrips,
  onTripClick,
  timeLocale,
  nearbyStations,
  selectedNearbyStationIds,
  onToggleNearbyStation,
  onLoadMore,
  isLoadingMore,
  selectedDateTime,
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
        <>
          {nearbyStations.length > 0 && (
            <div className="nearby-stations-section">
              <h4 className="nearby-stations-title">{t('stationSection.nearbyStations')}</h4>
              <div className="nearby-stations-list">
                {nearbyStations.map((station) => (
                  <label key={station.stop_id} className="nearby-station-checkbox">
                    <input
                      type="checkbox"
                      checked={selectedNearbyStationIds.has(station.stop_id)}
                      onChange={() => onToggleNearbyStation(station.stop_id)}
                    />
                    <span className="nearby-station-name">{station.stop_name}</span>
                  </label>
                ))}
              </div>
            </div>
          )}

          <div className="trips-section">
          {isLoadingTrips && <p className="sidebar-hint">{t('stationSection.loading')}</p>}
          {!isLoadingTrips && tripsData?.trips && tripsData.trips.length > 0 && (
            <>
              <div className="trips-list">
                {tripsData.trips.map((trip, index) => (
                  <TripListItem
                    key={`${trip.trip_id}-${trip.departure_datetime}-${index}`}
                    trip={trip}
                    index={index}
                    selectedStation={selectedStation}
                    onTripClick={onTripClick}
                    timeLocale={timeLocale}
                    selectedDateTime={selectedDateTime}
                  />
                ))}
              </div>
              <button
                className="load-more-button"
                onClick={onLoadMore}
                disabled={isLoadingMore}
              >
                {isLoadingMore ? t('stationSection.loadingMore') : t('stationSection.loadMore')}
              </button>
            </>
          )}
          {!isLoadingTrips && (!tripsData?.trips || tripsData.trips.length === 0) && (
            <p className="sidebar-hint">{t('stationSection.empty')}</p>
          )}
        </div>
        </>
      )}
    </div>
  )
}
