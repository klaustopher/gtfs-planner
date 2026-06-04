import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'
import './ConfirmDialog.css'

interface ConfirmDialogProps {
  title: string
  message: string
  // alert = a single OK button (acknowledgement), no cancel.
  alert?: boolean
  onConfirm: () => void
  onCancel: () => void
}

// In-app confirmation dialog. Replaces the native Wails MessageDialog, which on
// Linux ignores custom button labels and returns localized system strings, so the
// caller's result check never matched (see issue #16). This also keeps the buttons
// in the app's own language.
export default function ConfirmDialog({ title, message, alert = false, onConfirm, onCancel }: ConfirmDialogProps) {
  const { t } = useTranslation()
  // In alert mode dismissing == acknowledging.
  const dismiss = alert ? onConfirm : onCancel

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        dismiss()
      } else if (event.key === 'Enter') {
        onConfirm()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onConfirm, dismiss])

  return createPortal(
    <div className="confirm-dialog__backdrop" onClick={dismiss}>
      <div
        className="confirm-dialog"
        role="alertdialog"
        aria-modal="true"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="confirm-dialog__title">{title}</h2>
        <p className="confirm-dialog__message">{message}</p>
        <div className="confirm-dialog__actions">
          {!alert && (
            <button type="button" className="confirm-dialog__btn confirm-dialog__btn--cancel" onClick={onCancel}>
              {t('common.cancel')}
            </button>
          )}
          <button type="button" className="confirm-dialog__btn confirm-dialog__btn--confirm" onClick={onConfirm} autoFocus>
            {alert ? t('common.ok') : t('common.confirm')}
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}
