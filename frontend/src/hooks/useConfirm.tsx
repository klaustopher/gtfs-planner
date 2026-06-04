import { useCallback, useRef, useState } from 'react'
import ConfirmDialog from '../components/ConfirmDialog'

interface ConfirmState {
  title: string
  message: string
}

// Promise-based confirmation: call `confirm(title, message)` and await a boolean.
// Render `confirmDialog` somewhere in the tree. Replaces the native Wails dialog
// (broken on Linux, see issue #16).
export function useConfirm() {
  const [state, setState] = useState<ConfirmState | null>(null)
  const resolverRef = useRef<((value: boolean) => void) | null>(null)

  const confirm = useCallback((title: string, message: string): Promise<boolean> => {
    setState({ title, message })
    return new Promise<boolean>((resolve) => {
      resolverRef.current = resolve
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
      onConfirm={() => resolve(true)}
      onCancel={() => resolve(false)}
    />
  ) : null

  return { confirm, confirmDialog }
}
