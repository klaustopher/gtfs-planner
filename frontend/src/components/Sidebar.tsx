import { models } from '../../wailsjs/go/models'
import { SavedTrip } from '../App'
import { useTranslation } from 'react-i18next'
import SettingsModal from './SettingsModal'
import JourneySummaryPanel from './JourneySummaryPanel'
import JourneyExportModal from './JourneyExportModal'
import type { JourneyViewData } from '../hooks/useJourneyView'
import JourneyActionsBar from './JourneyActionsBar'
import StationDeparturesCard from './StationDeparturesCard'
import SavedJourneyTimeline from './SavedJourneyTimeline'
import { useJourneyFileActions } from './hooks/useJourneyFileActions'
import './Sidebar.css'

type PlanningMode = 'initial' | 'planning' | 'viewing'

interface SidebarProps {
  width?: number
  selectedStation: models.StationDetails | null
  tripsData: models.UpcomingTripsData | null
  isLoadingTrips: boolean
  savedTrips: SavedTrip[]
  onRemoveSavedTrip: (tripId: string) => void
  onTripClick: (trip: models.UpcomingTrip, tripIndex: number) => void
  hasUnsavedChanges: boolean
  currentFilePath: string | null
  onSaveJourney: () => void
  onLoadJourney: () => void
  onNewJourney: () => void
  planningMode: PlanningMode
  onEnterViewMode: () => void
  onReturnToPlanning: () => void
  journeyViewData: JourneyViewData | null
  isLoadingJourneyView: boolean
  journeyData: models.JourneyData | null
  nearbyStations: models.Stop[]
  selectedNearbyStationIds: Set<string>
  onToggleNearbyStation: (stationId: string) => void
  onLoadMore: () => void
  isLoadingMore: boolean
  onStepBack: () => void
  canStepBack: boolean
  selectedDate: string
  selectedTime: string
  // ISO arrival time at the currently selected station (last booked leg), or null
  // when this is the journey's first station.
  currentArrivalDateTime: string | null
}

export default function Sidebar({
  width,
  selectedStation,
  tripsData,
  isLoadingTrips,
  savedTrips,
  onRemoveSavedTrip,
  onTripClick,
  hasUnsavedChanges,
  currentFilePath,
  onSaveJourney,
  onLoadJourney,
  onNewJourney,
  planningMode,
  onEnterViewMode,
  onReturnToPlanning,
  journeyViewData,
  isLoadingJourneyView,
  journeyData,
  nearbyStations,
  selectedNearbyStationIds,
  onToggleNearbyStation,
  onLoadMore,
  isLoadingMore,
  onStepBack,
  canStepBack,
  selectedDate,
  selectedTime,
  currentArrivalDateTime,
}: SidebarProps) {
  const { t, i18n } = useTranslation()
  const rawLanguage = i18n.resolvedLanguage || i18n.language || 'en'
  const timeLocale = i18n.language || rawLanguage

  // Combine date and time for selectedDateTime
  const selectedDateTime = `${selectedDate}T${selectedTime}:00`

  const {
    isSettingsOpen,
    isExportModalOpen,
    openSettings,
    closeSettings,
    openExportModal,
    closeExportModal,
  } = useJourneyFileActions()

  // Derived values
  const isViewingMode = planningMode === 'viewing'
  const savedTripsCount = savedTrips.length

  return (
    <div className="sidebar" style={width ? { width } : undefined}>
      <JourneyActionsBar
        currentFilePath={currentFilePath}
        savedTripsCount={savedTripsCount}
        hasUnsavedChanges={hasUnsavedChanges}
        onNewJourney={onNewJourney}
        onLoadJourney={onLoadJourney}
        onSaveJourney={onSaveJourney}
        onOpenExportModal={openExportModal}
        onOpenSettings={openSettings}
      />

      {!isViewingMode && (
        <StationDeparturesCard
          selectedStation={selectedStation}
          savedTripsCount={savedTripsCount}
          tripsData={tripsData}
          isLoadingTrips={isLoadingTrips}
          onTripClick={onTripClick}
          timeLocale={timeLocale}
          nearbyStations={nearbyStations}
          selectedNearbyStationIds={selectedNearbyStationIds}
          onToggleNearbyStation={onToggleNearbyStation}
          onLoadMore={onLoadMore}
          isLoadingMore={isLoadingMore}
          onStepBack={onStepBack}
          canStepBack={canStepBack}
          selectedDateTime={selectedDateTime}
          currentArrivalDateTime={currentArrivalDateTime}
        />
      )}

      {/* Planned Journey - shown after station card in planning mode, or first in viewing mode */}
      {savedTrips.length > 0 && (
        <div className="sidebar-card">
          <div className="sidebar-card__header">
            <h3 className="sidebar-card__title">{t('journey.plannedTitle')}</h3>
            <div className="sidebar-card__actions">
              {!isViewingMode ? (
                <button
                  className="journey-view-btn"
                  onClick={onEnterViewMode}
                  disabled={savedTrips.length === 0}
                  title={t('journey.viewJourneyTooltip')}
                >
                  {t('journey.viewJourney')}
                </button>
              ) : (
                <button
                  className="journey-edit-btn"
                  onClick={onReturnToPlanning}
                  title={t('journey.returnToPlanningTooltip')}
                >
                  {t('journey.editJourney')}
                </button>
              )}
            </div>
          </div>

          {/* Journey Summary and trip list - only shown in viewing mode */}
          {isViewingMode && (
            <>
              {journeyViewData?.summary && (
                <JourneySummaryPanel
                  summary={journeyViewData.summary}
                  isLoading={isLoadingJourneyView}
                />
              )}
              <SavedJourneyTimeline
                savedTrips={savedTrips}
                isViewingMode={isViewingMode}
                onRemoveSavedTrip={onRemoveSavedTrip}
                timeLocale={timeLocale}
              />
            </>
          )}
        </div>
      )}

      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={closeSettings}
      />
      {isExportModalOpen && journeyData && (
        <JourneyExportModal
          journeyData={journeyData}
          savedTrips={savedTrips}
          onClose={closeExportModal}
        />
      )}
    </div>
  )
}
