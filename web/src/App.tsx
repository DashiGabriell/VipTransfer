import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { TenantProvider } from './context/TenantContext'
import { AdminPage } from './pages/AdminPage'
import { LandingPage } from './pages/LandingPage'

export default function App() {
  return (
    <TenantProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/admin" element={<AdminPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </TenantProvider>
  )
}
