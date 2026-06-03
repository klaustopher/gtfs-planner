import { useEffect, useState, type MouseEvent } from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faTimes, faDownload, faFileImport, faFolderOpen, faArrowUpRightFromSquare } from '@fortawesome/free-solid-svg-icons'
import { DownloadGTFS, ImportGTFS, ImportGTFSFromFile, CancelGTFS } from '../../wailsjs/go/main/App'
import { EventsOn, BrowserOpenURL } from '../../wailsjs/runtime/runtime'
import type { main } from '../../wailsjs/go/models'
import './GtfsSetupModal.css'

const DEFAULT_FEED_URL = 'https://download.gtfs.de/germany/free/latest.zip'
const GTFS_DE_INFO_URL = 'https://gtfs.de/de/feeds/'
const DELFI_URL =
  'https://www.opendata-oepnv.de/ht/de/organisation/delfi/startseite?tx_vrrkit_view%5Baction%5D=details&tx_vrrkit_view%5Bcontroller%5D=View&tx_vrrkit_view%5Bdataset_name%5D=deutschlandweite-sollfahrplandaten-gtfs'

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
  const [importProg, setImportProg] = useState<{ pct: number; label: string }>({ pct: 0, label: '' })
  const [error, setError] = useState('')

  const busy = phase === 'downloading' || phase === 'importing'
  const isUpdate = status != null && status.state !== 'missing'

  useEffect(() => {
    if (!isOpen) {
      return
    }
    const importLabel = (p: GtfsProgress): string => {
      if (p.message === 'normalize') return t('gtfsSetup.normalizing')
      if (p.message === 'index') return t('gtfsSetup.indexing')
      return p.file
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
      EventsOn('gtfs:download:cancelled', () => {
        setPhase('idle')
        setDownloadPct(0)
      }),
      EventsOn('gtfs:import:progress', (p: GtfsProgress) => {
        setImportProg({ pct: p.total > 0 ? p.current / p.total : 0, label: importLabel(p) })
      }),
      EventsOn('gtfs:import:done', () => {
        setPhase('idle')
        onImported()
      }),
      EventsOn('gtfs:import:error', (msg: string) => {
        setError(msg)
        setPhase('idle')
      }),
      EventsOn('gtfs:import:cancelled', () => {
        setPhase('idle')
        setImportProg({ pct: 0, label: '' })
      }),
    ]
    return () => {
      unsubscribers.forEach((unsub) => unsub())
    }
  }, [isOpen, onImported, t])

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
    setImportProg({ pct: 0, label: '' })
    setPhase('importing')
    void ImportGTFS().catch((err: unknown) => {
      setError(String(err))
      setPhase('idle')
    })
  }

  const handleOpenFile = () => {
    setError('')
    setImportProg({ pct: 0, label: '' })
    setPhase('importing')
    void ImportGTFSFromFile().catch((err: unknown) => {
      setError(String(err))
      setPhase('idle')
    })
  }

  const handleCancel = () => {
    void CancelGTFS()
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

          <div className="gtfs-setup-modal__columns">
            <section className="gtfs-setup-modal__column">
              <h3 className="gtfs-setup-modal__section-title">{t('gtfsSetup.online.title')}</h3>
              <p>{t('gtfsSetup.online.description')}</p>
              <button
                type="button"
                className="gtfs-setup-modal__link"
                onClick={() => BrowserOpenURL(GTFS_DE_INFO_URL)}
              >
                {t('gtfsSetup.online.learnMore')} <FontAwesomeIcon icon={faArrowUpRightFromSquare} />
              </button>
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
                  <div className="gtfs-setup-modal__progress-row">
                    <span className="gtfs-setup-modal__progress-label">
                      {t('gtfsSetup.downloading', { percent: Math.round(downloadPct * 100) })}
                    </span>
                    <button type="button" className="gtfs-setup-modal__cancel" onClick={handleCancel}>
                      {t('gtfsSetup.cancel')}
                    </button>
                  </div>
                </div>
              )}

              {phase === 'downloaded' && (
                <p className="gtfs-setup-modal__hint">{t('gtfsSetup.downloadComplete')}</p>
              )}
            </section>

            <section className="gtfs-setup-modal__column gtfs-setup-modal__column--delfi">
              <h3 className="gtfs-setup-modal__section-title">{t('gtfsSetup.delfi.title')}</h3>
              <p>{t('gtfsSetup.delfi.description')}</p>
              <p className="gtfs-setup-modal__hint">{t('gtfsSetup.delfi.registration')}</p>
              <button
                type="button"
                className="gtfs-setup-modal__link"
                onClick={() => BrowserOpenURL(DELFI_URL)}
              >
                {t('gtfsSetup.delfi.link')} <FontAwesomeIcon icon={faArrowUpRightFromSquare} />
              </button>
              <div className="gtfs-setup-modal__actions">
                <button
                  type="button"
                  className="gtfs-setup-modal__button"
                  onClick={handleOpenFile}
                  disabled={busy}
                >
                  <FontAwesomeIcon icon={faFolderOpen} /> {t('gtfsSetup.delfi.open')}
                </button>
              </div>
            </section>
          </div>

          {phase === 'importing' && (
            <div className="gtfs-setup-modal__progress">
              <div className="gtfs-setup-modal__progress-bar">
                <div
                  className="gtfs-setup-modal__progress-fill"
                  style={{ width: `${Math.round(importProg.pct * 100)}%` }}
                />
              </div>
              <div className="gtfs-setup-modal__progress-row">
                <span className="gtfs-setup-modal__progress-label">
                  {importProg.label
                    ? t('gtfsSetup.importingFile', {
                        file: importProg.label,
                        percent: Math.round(importProg.pct * 100),
                      })
                    : t('gtfsSetup.importingStart')}
                </span>
                <button type="button" className="gtfs-setup-modal__cancel" onClick={handleCancel}>
                  {t('gtfsSetup.cancel')}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )

  return createPortal(modalContent, document.body)
}
