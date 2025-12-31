import { useState, useCallback, useEffect } from 'react'

const STORAGE_KEY = 'bus-planning-settings'

export interface Settings {
  nearbyStationRadius: number // in meters, 0-200
  connectionTimeMinutes: number // in minutes, 0-30
}

const DEFAULT_SETTINGS: Settings = {
  nearbyStationRadius: 50,
  connectionTimeMinutes: 5,
}

export function useSettings() {
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

  return { settings, updateSettings }
}
