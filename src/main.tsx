import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { HashRouter } from 'react-router-dom'
import './index.css'
import App from './App.tsx'
import { initDatabase } from '@/lib/db'

function renderApp() {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <HashRouter>
        <App />
      </HashRouter>
    </StrictMode>,
  )
}

// The native SQLite database must be opened and seeded before the UI reads
// from it, so we wait for initialization before mounting the app.
initDatabase()
  .catch((err) => console.error('Database init failed:', err))
  .finally(renderApp)
