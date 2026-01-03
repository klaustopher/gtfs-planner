import React from 'react'
import {createRoot} from 'react-dom/client'
import './style.css'
import './i18n'
import App from './App'
import { SettingsProvider } from './hooks/SettingsProvider'

const container = document.getElementById('root')

const root = createRoot(container!)

root.render(
    <React.StrictMode>
        <SettingsProvider>
            <App/>
        </SettingsProvider>
    </React.StrictMode>
)
