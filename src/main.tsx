import '@fontsource/nunito/400.css'
import '@fontsource/nunito/700.css'
import '@fontsource/nunito/800.css'
import './styles/theme.css'
import './styles/base.css'
import './shell/shell.css'
import './report/report.css'
import './map/map.css'
import './ranking/ranking.css'
import './i18n'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './App'
import { listenForInstallPrompt } from './install/installPrompt'

listenForInstallPrompt()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
