import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faRotateLeft, faFolderOpen, faSave, faFileExport, faCog } from '@fortawesome/free-solid-svg-icons'
import { useTranslation } from 'react-i18next'

interface JourneyActionsBarProps {
  currentFilePath: string | null
  savedTripsCount: number
  hasUnsavedChanges: boolean
  onNewJourney: () => void
  onLoadJourney: () => void
  onSaveJourney: () => void
  onOpenExportModal: () => void
  onOpenSettings: () => void
}

export default function JourneyActionsBar({
  currentFilePath,
  savedTripsCount,
  hasUnsavedChanges,
  onNewJourney,
  onLoadJourney,
  onSaveJourney,
  onOpenExportModal,
  onOpenSettings,
}: JourneyActionsBarProps) {
  const { t } = useTranslation()
  const fileName = currentFilePath ? currentFilePath.split('/').pop() : null

  return (
    <>
      {fileName && <div className="sidebar-filename">{fileName}</div>}
      <div className="journey-actions">
        <button
          className="journey-btn journey-btn--icon"
          onClick={onNewJourney}
          disabled={savedTripsCount === 0}
          title={t('journey.actions.newTooltip')}
          aria-label={t('journey.actions.newTooltip')}
        >
          <FontAwesomeIcon icon={faRotateLeft} />
        </button>
        <button
          className="journey-btn journey-btn--icon"
          onClick={onLoadJourney}
          title={t('journey.actions.loadTooltip')}
          aria-label={t('journey.actions.loadTooltip')}
        >
          <FontAwesomeIcon icon={faFolderOpen} />
        </button>
        <button
          className="journey-btn journey-btn--icon"
          onClick={onSaveJourney}
          disabled={savedTripsCount === 0}
          title={t('journey.actions.saveTooltip')}
          aria-label={t('journey.actions.saveTooltip')}
        >
          <FontAwesomeIcon icon={faSave} />
          {hasUnsavedChanges && savedTripsCount > 0 && <span className="journey-btn__indicator">*</span>}
        </button>
        <button
          className="journey-btn journey-btn--icon"
          onClick={onOpenExportModal}
          disabled={savedTripsCount === 0}
          title={t('journey.actions.exportTooltip')}
          aria-label={t('journey.actions.exportTooltip')}
        >
          <FontAwesomeIcon icon={faFileExport} />
        </button>
        <button
          className="journey-btn journey-btn--icon"
          onClick={onOpenSettings}
          title={t('settings.openButtonTooltip')}
          aria-label={t('settings.openButtonTooltip')}
        >
          <FontAwesomeIcon icon={faCog} />
        </button>
      </div>
    </>
  )
}
