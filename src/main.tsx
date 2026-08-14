import React from 'react'
import ReactDOM from 'react-dom/client'
import { Capacitor } from '@capacitor/core'
import { Preferences } from '@capacitor/preferences'
import App from './App'
import './main.scss'
import { initI18n } from './i18n'

async function bootstrap() {
  // iOS: route preferences through the App Group suite so the home-screen
  // widget can read user_lang. Android ignores groups and the native Java
  // layer reads the literal "CapacitorStorage" file — so this is iOS-only.
  if (Capacitor.getPlatform() === 'ios') {
    await Preferences.configure({ group: 'group.com.salo.alahmuhammed' })
  }

  await initI18n()

  ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>,
  )
}

bootstrap()
