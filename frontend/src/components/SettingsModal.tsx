import { useEffect, type ChangeEvent, type MouseEvent } from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'
import './SettingsModal.css'

interface SettingsModalProps {
  isOpen: boolean
  onClose: () => void
  nearbyStationRadius: number
  onNearbyStationRadiusChange: (radius: number) => void
}

export default function SettingsModal({ isOpen, onClose, nearbyStationRadius, onNearbyStationRadiusChange }: SettingsModalProps) {
  const { t, i18n } = useTranslation()
  const rawLanguage = i18n.resolvedLanguage || i18n.language || 'en'
  const normalizedLanguage = rawLanguage.split('-')[0]

  useEffect(() => {
    if (!isOpen) {
      return
    }
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [isOpen, onClose])

  const handleLanguageChange = (event: ChangeEvent<HTMLSelectElement>) => {
    void i18n.changeLanguage(event.target.value)
  }

  const handleRadiusChange = (event: ChangeEvent<HTMLInputElement>) => {
    const value = parseInt(event.target.value, 10)
    if (!isNaN(value)) {
      onNearbyStationRadiusChange(value)
    }
  }

  const handleBackdropClick = (event: MouseEvent<HTMLDivElement>) => {
    if (event.target === event.currentTarget) {
      onClose()
    }
  }

  if (!isOpen) {
    return null
  }

  const modalContent = (
    <div className="settings-modal__backdrop" onClick={handleBackdropClick}>
      <div className="settings-modal" role="dialog" aria-modal="true" aria-labelledby="settings-modal-title">
        <header className="settings-modal__header">
          <div>
            <h2 id="settings-modal-title">{t('settings.title')}</h2>
            <p className="settings-modal__description">{t('settings.description')}</p>
          </div>
          <button
            type="button"
            className="settings-modal__close"
            onClick={onClose}
            aria-label={t('settings.close')}
          >
            ×
          </button>
        </header>
        <section className="settings-modal__section">
          <label htmlFor="settings-language" className="settings-modal__section-title">
            {t('settings.languageLabel')}
          </label>
          <p className="settings-modal__hint">{t('settings.languageHint')}</p>
          <select
            id="settings-language"
            value={normalizedLanguage}
            onChange={handleLanguageChange}
            className="settings-modal__select"
          >
            <option value="de">{t('common.language.options.de')}</option>
            <option value="en">{t('common.language.options.en')}</option>
          </select>
        </section>
        <section className="settings-modal__section">
          <label htmlFor="settings-nearby-radius" className="settings-modal__section-title">
            {t('settings.nearbyStationRadiusLabel')}
          </label>
          <p className="settings-modal__hint">{t('settings.nearbyStationRadiusHint')}</p>
          <div className="settings-modal__slider-container">
            <input
              id="settings-nearby-radius"
              type="range"
              min="0"
              max="200"
              step="10"
              value={nearbyStationRadius}
              onChange={handleRadiusChange}
              className="settings-modal__slider"
            />
            <div className="settings-modal__slider-value">
              {nearbyStationRadius === 0
                ? t('settings.nearbyStationRadiusDisabled')
                : t('settings.nearbyStationRadiusValue', { meters: nearbyStationRadius })}
            </div>
          </div>
        </section>
      </div>
    </div>
  )

  return createPortal(modalContent, document.body)
}
