import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App.tsx'
import { AuthProvider } from './state/AuthProvider.tsx'
import { TicketStoreProvider } from './state/TicketStoreProvider.tsx'
import './index.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <TicketStoreProvider>
          <App />
        </TicketStoreProvider>
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>,
)
