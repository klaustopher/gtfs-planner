import { useEffect, type MouseEvent } from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'
import './GtfsSetupModal.css'

interface GtfsSetupModalProps {
  isOpen: boolean
  onClose?: () => void
}

export default function GtfsSetupModal({ isOpen, onClose }: GtfsSetupModalProps) {
  const { t } = useTranslation()

  useEffect(() => {
    if (!isOpen) {
      return
    }
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && onClose) {
        onClose()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [isOpen, onClose])

  const handleBackdropClick = (event: MouseEvent<HTMLDivElement>) => {
    if (event.target === event.currentTarget && onClose) {
      onClose()
    }
  }

  if (!isOpen) {
    return null
  }

  const modalContent = (
    <div className="gtfs-setup-modal__backdrop" onClick={handleBackdropClick}>
      <div className="gtfs-setup-modal" role="dialog" aria-modal="true" aria-labelledby="gtfs-setup-modal-title">
        <header className="gtfs-setup-modal__header">
          <div>
            <h2 id="gtfs-setup-modal-title">{t('gtfsSetup.title')}</h2>
            <p className="gtfs-setup-modal__description">{t('gtfsSetup.description')}</p>
          </div>
          {onClose && (
            <button
              type="button"
              className="gtfs-setup-modal__close"
              onClick={onClose}
              aria-label={t('common.close')}
            >
              ×
            </button>
          )}
        </header>

        <div className="gtfs-setup-modal__content">
          <section className="gtfs-setup-modal__section">
            <h3 className="gtfs-setup-modal__section-title">{t('gtfsSetup.steps.title')}</h3>

            <div className="gtfs-setup-modal__step">
              <div className="gtfs-setup-modal__step-number">1</div>
              <div className="gtfs-setup-modal__step-content">
                <h4>{t('gtfsSetup.steps.openTerminal.title')}</h4>
                <p>{t('gtfsSetup.steps.openTerminal.description')}</p>
              </div>
            </div>

            <div className="gtfs-setup-modal__step">
              <div className="gtfs-setup-modal__step-number">2</div>
              <div className="gtfs-setup-modal__step-content">
                <h4>{t('gtfsSetup.steps.download.title')}</h4>
                <p>{t('gtfsSetup.steps.download.description')}</p>
                <code className="gtfs-setup-modal__code">./build/bin/gtfs-manager download</code>
                <p className="gtfs-setup-modal__hint">{t('gtfsSetup.steps.download.hint')}</p>
              </div>
            </div>

            <div className="gtfs-setup-modal__step">
              <div className="gtfs-setup-modal__step-number">3</div>
              <div className="gtfs-setup-modal__step-content">
                <h4>{t('gtfsSetup.steps.import.title')}</h4>
                <p>{t('gtfsSetup.steps.import.description')}</p>
                <code className="gtfs-setup-modal__code">./build/bin/gtfs-manager import</code>
                <p className="gtfs-setup-modal__hint">{t('gtfsSetup.steps.import.hint')}</p>
              </div>
            </div>

            <div className="gtfs-setup-modal__step">
              <div className="gtfs-setup-modal__step-number">4</div>
              <div className="gtfs-setup-modal__step-content">
                <h4>{t('gtfsSetup.steps.restart.title')}</h4>
                <p>{t('gtfsSetup.steps.restart.description')}</p>
              </div>
            </div>
          </section>

          <section className="gtfs-setup-modal__section gtfs-setup-modal__section--info">
            <h3 className="gtfs-setup-modal__section-title">{t('gtfsSetup.info.title')}</h3>
            <p>{t('gtfsSetup.info.description')}</p>
            <code className="gtfs-setup-modal__code">./build/bin/gtfs-manager status</code>
          </section>

          <section className="gtfs-setup-modal__section gtfs-setup-modal__section--note">
            <h3 className="gtfs-setup-modal__section-title">{t('gtfsSetup.note.title')}</h3>
            <p>{t('gtfsSetup.note.description')}</p>
          </section>
        </div>
      </div>
    </div>
  )

  return createPortal(modalContent, document.body)
}
