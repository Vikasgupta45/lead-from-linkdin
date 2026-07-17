import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { AdminPanel } from './components/AdminPanel.tsx'

// Minimal path-based routing: /admin serves the password-protected reset panel,
// everything else serves the public lead tool.
const isAdminRoute = window.location.pathname.replace(/\/+$/, '') === '/admin'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {isAdminRoute ? <AdminPanel /> : <App />}
  </StrictMode>,
)
