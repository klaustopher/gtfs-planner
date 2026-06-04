import { useCallback, useRef, useState } from 'react'
import ConfirmDialog from '../components/ConfirmDialog'

interface DialogState {
  title: string
  message: string
  alert: boolean // alert = single OK button (notice), not a yes/no confirmation
}

// Promise-based dialogs: `confirm(title, message)` resolves to a boolean,
// `alert(title, message)` resolves when acknowledged. Render `confirmDialog`
// somewhere in the tree. Replaces the native Wails dialog (broken on Linux, #16).
export function useConfirm() {
  const [state, setState] = useState<DialogState | null>(null)
  const resolverRef = useRef<((value: boolean) => void) | null>(null)

  const confirm = useCallback((title: string, message: string): Promise<boolean> => {
    setState({ title, message, alert: false })
    return new Promise<boolean>((resolve) => {
      resolverRef.current = resolve
    })
  }, [])

  const alert = useCallback((title: string, message: string): Promise<void> => {
    setState({ title, message, alert: true })
    return new Promise<void>((resolve) => {
      resolverRef.current = () => resolve()
    })
  }, [])

  const resolve = useCallback((value: boolean) => {
    resolverRef.current?.(value)
    resolverRef.current = null
    setState(null)
  }, [])

  const confirmDialog = state ? (
    <ConfirmDialog
      title={state.title}
      message={state.message}
      alert={state.alert}
      onConfirm={() => resolve(true)}
      onCancel={() => resolve(false)}
    />
  ) : null

  return { confirm, alert, confirmDialog }
}
