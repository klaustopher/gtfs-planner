import { useEffect, useState, useCallback, type ChangeEvent, type MouseEvent } from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faTimes, faTrash } from '@fortawesome/free-solid-svg-icons'
import { useSettings } from '../hooks/useSettings'
import { GetDatabaseInfo, GetDatabaseStatus, DeleteDatabase } from '../../wailsjs/go/main/App'
import { useConfirm } from '../hooks/useConfirm'
import type { main } from '../../wailsjs/go/models'
import './SettingsModal.css'

interface SettingsModalProps {
  isOpen: boolean
  onClose: () => void
}

function formatBytes(bytes: number): string {
  if (bytes >= 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${bytes} B`
}

export default function SettingsModal({ isOpen, onClose }: SettingsModalProps) {
  const { t, i18n } = useTranslation()
  const { settings, updateSettings } = useSettings()
  const { confirm, confirmDialog } = useConfirm()
  const rawLanguage = i18n.resolvedLanguage || i18n.language || 'en'
  const normalizedLanguage = rawLanguage.split('-')[0]
  const [dbInfo, setDbInfo] = useState<main.DatabaseInfo | null>(null)
  const [dbStatus, setDbStatus] = useState<main.DatabaseStatus | null>(null)

  const refreshDbInfo = useCallback(() => {
    void GetDatabaseInfo().then(setDbInfo).catch((err: unknown) => {
      console.error('Failed to get database info:', err)
    })
    void GetDatabaseStatus().then(setDbStatus).catch((err: unknown) => {
      console.error('Failed to get database status:', err)
    })
  }, [])

  useEffect(() => {
    if (isOpen) {
      refreshDbInfo()
    }
  }, [isOpen, refreshDbInfo])

  const handleDeleteDatabase = useCallback(async () => {
    const confirmed = await confirm(
      t('settings.database.confirmTitle'),
      t('settings.database.confirmMessage'),
    )
    if (!confirmed) {
      return
    }
    try {
      await DeleteDatabase()
      refreshDbInfo()
      window.dispatchEvent(new Event('gtfs:db-changed'))
    } catch (err) {
      console.error('Failed to delete database:', err)
    }
  }, [t, refreshDbInfo, confirm])

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

  const handleConnectionTimeChange = (event: ChangeEvent<HTMLInputElement>) => {
    const value = parseInt(event.target.value, 10)
    if (!isNaN(value)) {
      updateSettings({ connectionTimeMinutes: value })
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
            <FontAwesomeIcon icon={faTimes} />
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
          <label htmlFor="settings-connection-time" className="settings-modal__section-title">
            {t('settings.connectionTimeLabel')}
          </label>
          <p className="settings-modal__hint">{t('settings.connectionTimeHint')}</p>
          <div className="settings-modal__slider-container">
            <input
              id="settings-connection-time"
              type="range"
              min="0"
              max="30"
              step="1"
              value={settings.connectionTimeMinutes}
              onChange={handleConnectionTimeChange}
              className="settings-modal__slider"
            />
            <div className="settings-modal__slider-value">
              <strong>{settings.connectionTimeMinutes}</strong> {t('settings.connectionTimeUnit')}
            </div>
          </div>
        </section>
        <section className="settings-modal__section">
          <h3 className="settings-modal__section-title">{t('settings.database.title')}</h3>
          <p className="settings-modal__hint">{t('settings.database.hint')}</p>
          <dl className="settings-modal__db-info">
            <dt>{t('settings.database.pathLabel')}</dt>
            <dd className="settings-modal__db-path">{dbInfo?.path ?? '—'}</dd>
            <dt>{t('settings.database.sizeLabel')}</dt>
            <dd>
              {dbInfo?.exists
                ? formatBytes(dbInfo.sizeBytes)
                : t('settings.database.notPresent')}
            </dd>
            {dbStatus?.hasData && (
              <>
                <dt>{t('settings.database.firstDate')}</dt>
                <dd>{dbStatus.firstDate}</dd>
                <dt>{t('settings.database.lastDate')}</dt>
                <dd>{dbStatus.lastDate}</dd>
                <dt>{t('settings.database.daysRemaining')}</dt>
                <dd className={dbStatus.daysRemaining < 7 ? 'settings-modal__db-warn' : ''}>
                  {dbStatus.daysRemaining < 0
                    ? t('settings.database.expired')
                    : t('settings.database.daysValue', { days: dbStatus.daysRemaining })}
                </dd>
              </>
            )}
          </dl>
          <button
            type="button"
            className="settings-modal__delete-button"
            onClick={() => void handleDeleteDatabase()}
            disabled={!dbInfo?.exists}
          >
            <FontAwesomeIcon icon={faTrash} /> {t('settings.database.delete')}
          </button>
        </section>
      </div>
      {confirmDialog}
    </div>
  )

  return createPortal(modalContent, document.body)
}
