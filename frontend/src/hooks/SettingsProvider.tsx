import { useState, useCallback, useEffect, type ReactNode } from 'react'
import { SettingsContext, type Settings } from './settingsContext'

const STORAGE_KEY = 'bus-planning-settings'

const DEFAULT_SETTINGS: Settings = {
  nearbyStationRadius: 50,
  connectionTimeMinutes: 5,
}

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<Settings>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (stored) {
        const parsed = JSON.parse(stored)
        return { ...DEFAULT_SETTINGS, ...parsed }
      }
    } catch (err) {
      console.error('Failed to load settings:', err)
    }
    return DEFAULT_SETTINGS
  })

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(settings))
    } catch (err) {
      console.error('Failed to save settings:', err)
    }
  }, [settings])

  const updateSettings = useCallback((updates: Partial<Settings>) => {
    setSettings(prev => ({ ...prev, ...updates }))
  }, [])

  return (
    <SettingsContext.Provider value={{ settings, updateSettings }}>
      {children}
    </SettingsContext.Provider>
  )
}
