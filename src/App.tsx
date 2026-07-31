import { Navigate, Route, Routes } from 'react-router-dom'
import { ProtectedRoute } from './components/ProtectedRoute'
import { LoginPage } from './pages/LoginPage'
import { OrganizationDashboardPage } from './pages/OrganizationDashboardPage'
import { PlatformDashboardPage } from './pages/PlatformDashboardPage'
import { PublicBookingPage } from './pages/PublicBookingPage'

export default function App() {
  return <Routes>
    <Route path="/" element={<LoginPage />} />
    <Route path="/agendar/:slug" element={<PublicBookingPage />} />
    <Route path="/entrar" element={<LoginPage />} />
    <Route element={<ProtectedRoute />}>
      <Route path="/admin-geral" element={<PlatformDashboardPage />} />
      <Route path="/painel/*" element={<OrganizationDashboardPage />} />
    </Route>
    <Route path="*" element={<Navigate to="/" replace />} />
  </Routes>
}
