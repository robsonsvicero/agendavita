import { Navigate, Route, Routes } from 'react-router-dom'
import { ProtectedRoute } from './components/ProtectedRoute'
import { HomePage } from './pages/HomePage'
import { LoginPage } from './pages/LoginPage'
import { ResetPasswordPage } from './pages/ResetPasswordPage'
import { OrganizationDashboardPage } from './pages/OrganizationDashboardPage'
import { PlatformDashboardPage } from './pages/PlatformDashboardPage'
import { PublicBookingPage } from './pages/PublicBookingPage'
import { TestClientBookingPage } from './pages/TestClientBookingPage'

export default function App() {
  return <Routes>
    <Route path="/" element={<HomePage />} />
    <Route path="/entrar" element={<LoginPage />} />
    <Route path="/redefinir-senha" element={<ResetPasswordPage />} />
    <Route path="/agendar/:slug" element={<PublicBookingPage />} />
    <Route path="/teste-agendamento" element={<TestClientBookingPage />} />
    <Route element={<ProtectedRoute />}>
      <Route path="/admin-geral" element={<PlatformDashboardPage />} />
      <Route path="/painel/*" element={<OrganizationDashboardPage />} />
    </Route>
    <Route path="*" element={<Navigate to="/" replace />} />
  </Routes>
}
