import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import { ImpersonationProvider } from './context/ImpersonationContext'
import { TenantProvider } from './context/TenantContext'
import { AdminPage } from './pages/AdminPage'
import { AdminDashboard } from './pages/admin/AdminDashboard'
import { DriverLayout } from './pages/driver/DriverLayout'
import { DriverJobsPage } from './pages/driver/DriverJobsPage'
import { DriverProfilePage } from './pages/driver/DriverProfilePage'
import { AcceptInvitePage } from './pages/AcceptInvitePage'
import { LandingPage } from './pages/LandingPage'
import { LegalPage } from './pages/LegalPage'
import { LoginPage } from './pages/LoginPage'
import { PlatformPage } from './pages/dashitecnology/PlatformPage'
import { PlatformOverviewPage } from './pages/dashitecnology/PlatformOverviewPage'
import { PlatformOrgsPage } from './pages/dashitecnology/PlatformOrgsPage'
import { PlatformOrgDetailPage } from './pages/dashitecnology/PlatformOrgDetailPage'
import { PlatformUsersPage } from './pages/dashitecnology/PlatformUsersPage'
import { PlatformAuditPage } from './pages/dashitecnology/PlatformAuditPage'
import { PlatformOpsPage } from './pages/dashitecnology/PlatformOpsPage'
import { PlatformSettingsPage } from './pages/dashitecnology/PlatformSettingsPage'

export default function App() {
  return (
    <AuthProvider>
      <TenantProvider>
        <ImpersonationProvider>
          <BrowserRouter>
            <Routes>
              <Route path="/" element={<LandingPage />} />
              <Route path="/termos" element={<LegalPage />} />
              <Route path="/privacidade" element={<LegalPage />} />
              <Route path="/login" element={<LoginPage />} />
              <Route path="/aceitar-convite" element={<AcceptInvitePage />} />
              <Route path="/motorista" element={<DriverLayout />}>
                <Route index element={<Navigate to="ofertas" replace />} />
                {/* Shared shell so ofertas ↔ aceitas does not remount/refetch */}
                <Route element={<DriverJobsPage />}>
                  <Route path="ofertas" />
                  <Route path="aceitas" />
                </Route>
                <Route path="perfil" element={<DriverProfilePage />} />
              </Route>
              <Route path="/admin" element={<AdminPage />}>
                <Route index element={<Navigate to="reservas" replace />} />
                <Route
                  path="clientes/:customerId"
                  element={<AdminDashboard />}
                />
                <Route
                  path="motoristas/:driverId"
                  element={<AdminDashboard />}
                />
                <Route path=":section" element={<AdminDashboard />} />
              </Route>
              <Route path="/dashitecnology" element={<PlatformPage />}>
                <Route index element={<PlatformOverviewPage />} />
                <Route path="orgs" element={<PlatformOrgsPage />} />
                <Route path="orgs/:id" element={<PlatformOrgDetailPage />} />
                <Route path="users" element={<PlatformUsersPage />} />
                <Route path="audit" element={<PlatformAuditPage />} />
                <Route path="ops" element={<PlatformOpsPage />} />
                <Route path="settings" element={<PlatformSettingsPage />} />
              </Route>
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </BrowserRouter>
        </ImpersonationProvider>
      </TenantProvider>
    </AuthProvider>
  )
}
