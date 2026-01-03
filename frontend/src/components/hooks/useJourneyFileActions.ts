import { useState, useCallback } from 'react'

export interface JourneyFileActionsState {
  isSettingsOpen: boolean
  isExportModalOpen: boolean
  openSettings: () => void
  closeSettings: () => void
  openExportModal: () => void
  closeExportModal: () => void
}

export function useJourneyFileActions(): JourneyFileActionsState {
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)
  const [isExportModalOpen, setIsExportModalOpen] = useState(false)

  const openSettings = useCallback(() => setIsSettingsOpen(true), [])
  const closeSettings = useCallback(() => setIsSettingsOpen(false), [])
  const openExportModal = useCallback(() => setIsExportModalOpen(true), [])
  const closeExportModal = useCallback(() => setIsExportModalOpen(false), [])

  return {
    isSettingsOpen,
    isExportModalOpen,
    openSettings,
    closeSettings,
    openExportModal,
    closeExportModal,
  }
}
