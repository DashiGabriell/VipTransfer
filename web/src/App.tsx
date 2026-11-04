import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import { TenantProvider } from './context/TenantContext'
import { AdminPage } from './pages/AdminPage'
import { AdminDashboard } from './pages/admin/AdminDashboard'
import { LandingPage } from './pages/LandingPage'
import { LoginPage } from './pages/LoginPage'

export default function App() {
  return (
    <AuthProvider>
      <TenantProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<LandingPage />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/admin" element={<AdminPage />}>
              <Route index element={<Navigate to="reservas" replace />} />
              <Route
                path="clientes/:customerId"
                element={<AdminDashboard />}
              />
              <Route path=":section" element={<AdminDashboard />} />
            </Route>
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </TenantProvider>
    </AuthProvider>
  )
}
