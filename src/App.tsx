import { lazy, Suspense } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { ProtectedRoute } from './components/ProtectedRoute'

const HomePage = lazy(() => import('./pages/HomePage').then(module => ({ default: module.HomePage })))
const LoginPage = lazy(() => import('./pages/LoginPage').then(module => ({ default: module.LoginPage })))
const ResetPasswordPage = lazy(() => import('./pages/ResetPasswordPage').then(module => ({ default: module.ResetPasswordPage })))
const OrganizationDashboardPage = lazy(() => import('./pages/OrganizationDashboardPage').then(module => ({ default: module.OrganizationDashboardPage })))
const PlatformDashboardPage = lazy(() => import('./pages/PlatformDashboardPage').then(module => ({ default: module.PlatformDashboardPage })))
const PublicBookingPage = lazy(() => import('./pages/PublicBookingPage').then(module => ({ default: module.PublicBookingPage })))
const TestClientBookingPage = lazy(() => import('./pages/TestClientBookingPage').then(module => ({ default: module.TestClientBookingPage })))

export default function App() {
  return <Suspense fallback={<main className="grid min-h-screen place-items-center text-sm text-slate-500">Carregando página...</main>}><Routes>
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
  </Routes></Suspense>
}
