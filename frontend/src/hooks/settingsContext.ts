import { createContext } from 'react'

export interface Settings {
  connectionTimeMinutes: number // in minutes, 0-30
}

export interface SettingsContextValue {
  settings: Settings
  updateSettings: (updates: Partial<Settings>) => void
}

export const SettingsContext = createContext<SettingsContextValue | null>(null)
