import { useEffect, useState, type MouseEvent } from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faTimes, faDownload, faFileImport, faFolderOpen } from '@fortawesome/free-solid-svg-icons'
import { DownloadGTFS, ImportGTFS, ImportGTFSFromFile } from '../../wailsjs/go/main/App'
import { EventsOn } from '../../wailsjs/runtime/runtime'
import type { main } from '../../wailsjs/go/models'
import './GtfsSetupModal.css'

const DEFAULT_FEED_URL = 'https://download.gtfs.de/germany/nv_free/latest.zip'

interface GtfsProgress {
  phase: string
  file: string
  current: number
  total: number
  message: string
}

type Phase = 'idle' | 'downloading' | 'downloaded' | 'importing'

interface GtfsSetupModalProps {
  isOpen: boolean
  status: main.DatabaseStatus | null
  onClose?: () => void
  onImported: () => void
}

export default function GtfsSetupModal({ isOpen, status, onClose, onImported }: GtfsSetupModalProps) {
  const { t } = useTranslation()
  const [url, setUrl] = useState(DEFAULT_FEED_URL)
  const [phase, setPhase] = useState<Phase>('idle')
  const [downloadPct, setDownloadPct] = useState(0)
  const [importInfo, setImportInfo] = useState<{ file: string; rows: number }>({ file: '', rows: 0 })
  const [error, setError] = useState('')

  const busy = phase === 'downloading' || phase === 'importing'
  const isUpdate = status != null && status.state !== 'missing'

  useEffect(() => {
    if (!isOpen) {
      return
    }
    const unsubscribers = [
      EventsOn('gtfs:download:progress', (p: GtfsProgress) => {
        setDownloadPct(p.total > 0 ? p.current / p.total : 0)
      }),
      EventsOn('gtfs:download:done', () => setPhase('downloaded')),
      EventsOn('gtfs:download:error', (msg: string) => {
        setError(msg)
        setPhase('idle')
      }),
      EventsOn('gtfs:import:progress', (p: GtfsProgress) => {
        setImportInfo({ file: p.file, rows: p.current })
      }),
      EventsOn('gtfs:import:done', () => {
        setPhase('idle')
        onImported()
      }),
      EventsOn('gtfs:import:error', (msg: string) => {
        setError(msg)
        setPhase('idle')
      }),
    ]
    return () => {
      unsubscribers.forEach((unsub) => unsub())
    }
  }, [isOpen, onImported])

  useEffect(() => {
    if (!isOpen) {
      return
    }
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && onClose && !busy) {
        onClose()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [isOpen, onClose, busy])

  const handleBackdropClick = (event: MouseEvent<HTMLDivElement>) => {
    if (event.target === event.currentTarget && onClose && !busy) {
      onClose()
    }
  }

  const handleDownload = () => {
    setError('')
    setDownloadPct(0)
    setPhase('downloading')
    void DownloadGTFS(url).catch((err: unknown) => {
      setError(String(err))
      setPhase('idle')
    })
  }

  const handleImport = () => {
    setError('')
    setImportInfo({ file: '', rows: 0 })
    setPhase('importing')
    void ImportGTFS().catch((err: unknown) => {
      setError(String(err))
      setPhase('idle')
    })
  }

  const handleOpenFile = () => {
    setError('')
    setImportInfo({ file: '', rows: 0 })
    setPhase('importing')
    void ImportGTFSFromFile().catch((err: unknown) => {
      setError(String(err))
      setPhase('idle')
    })
  }

  if (!isOpen) {
    return null
  }

  const modalContent = (
    <div className="gtfs-setup-modal__backdrop" onClick={handleBackdropClick}>
      <div className="gtfs-setup-modal" role="dialog" aria-modal="true" aria-labelledby="gtfs-setup-modal-title">
        <header className="gtfs-setup-modal__header">
          <div>
            <h2 id="gtfs-setup-modal-title">
              {isUpdate ? t('gtfsSetup.updateTitle') : t('gtfsSetup.title')}
            </h2>
            <p className="gtfs-setup-modal__description">
              {isUpdate ? t('gtfsSetup.updateDescription') : t('gtfsSetup.description')}
            </p>
            {isUpdate && status && (
              <p className="gtfs-setup-modal__status">
                {t('gtfsSetup.validUntil', { date: status.lastDate, days: status.daysRemaining })}
              </p>
            )}
          </div>
          {onClose && !busy && (
            <button
              type="button"
              className="gtfs-setup-modal__close"
              onClick={onClose}
              aria-label={t('common.close')}
            >
              <FontAwesomeIcon icon={faTimes} />
            </button>
          )}
        </header>

        <div className="gtfs-setup-modal__content">
          {error && <div className="gtfs-setup-modal__error">{error}</div>}

          <section className="gtfs-setup-modal__section">
            <h3 className="gtfs-setup-modal__section-title">{t('gtfsSetup.online.title')}</h3>
            <p>{t('gtfsSetup.online.description')}</p>
            <input
              type="text"
              className="gtfs-setup-modal__input"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              disabled={busy}
              spellCheck={false}
            />
            <div className="gtfs-setup-modal__actions">
              <button
                type="button"
                className="gtfs-setup-modal__button"
                onClick={handleDownload}
                disabled={busy || !url}
              >
                <FontAwesomeIcon icon={faDownload} /> {t('gtfsSetup.online.download')}
              </button>
              <button
                type="button"
                className="gtfs-setup-modal__button gtfs-setup-modal__button--primary"
                onClick={handleImport}
                disabled={busy || phase !== 'downloaded'}
              >
                <FontAwesomeIcon icon={faFileImport} /> {t('gtfsSetup.online.import')}
              </button>
            </div>

            {phase === 'downloading' && (
              <div className="gtfs-setup-modal__progress">
                <div className="gtfs-setup-modal__progress-bar">
                  <div
                    className="gtfs-setup-modal__progress-fill"
                    style={{ width: `${Math.round(downloadPct * 100)}%` }}
                  />
                </div>
                <span className="gtfs-setup-modal__progress-label">
                  {t('gtfsSetup.downloading', { percent: Math.round(downloadPct * 100) })}
                </span>
              </div>
            )}

            {phase === 'downloaded' && (
              <p className="gtfs-setup-modal__hint">{t('gtfsSetup.downloadComplete')}</p>
            )}
          </section>

          <section className="gtfs-setup-modal__section gtfs-setup-modal__section--info">
            <h3 className="gtfs-setup-modal__section-title">{t('gtfsSetup.local.title')}</h3>
            <p>{t('gtfsSetup.local.description')}</p>
            <div className="gtfs-setup-modal__actions">
              <button
                type="button"
                className="gtfs-setup-modal__button"
                onClick={handleOpenFile}
                disabled={busy}
              >
                <FontAwesomeIcon icon={faFolderOpen} /> {t('gtfsSetup.local.open')}
              </button>
            </div>
          </section>

          {phase === 'importing' && (
            <div className="gtfs-setup-modal__progress">
              <div className="gtfs-setup-modal__progress-bar gtfs-setup-modal__progress-bar--indeterminate">
                <div className="gtfs-setup-modal__progress-fill" />
              </div>
              <span className="gtfs-setup-modal__progress-label">
                {importInfo.file
                  ? t('gtfsSetup.importing', { file: importInfo.file, rows: importInfo.rows.toLocaleString() })
                  : t('gtfsSetup.importingStart')}
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  )

  return createPortal(modalContent, document.body)
}
