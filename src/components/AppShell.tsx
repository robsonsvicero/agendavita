import { useState } from 'react'
import { Building2, CalendarDays, LogOut, ShieldCheck } from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../providers/AuthProvider'

export type OrganizationHeaderInfo = {
  name: string
  logo_url?: string | null
  specialty?: string | null
  organization_type?: 'clinic' | 'professional'
  role?: string
}

export type AppShellProps = {
  title?: string
  organization?: OrganizationHeaderInfo
  headerActions?: React.ReactNode
  children: React.ReactNode
}

export function AppShell({ title, organization, headerActions, children }: AppShellProps) {
  const { user, signOut } = useAuth()
  const navigate = useNavigate()
  const [logoFailed, setLogoFailed] = useState(false)
  const leave = async () => { await signOut(); navigate('/entrar') }

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white sticky top-0 z-20">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-5">
          <div className="flex items-center gap-3">
            <Link to="/" className="flex items-center gap-2 font-bold text-vita-700 hover:text-vita-800 transition">
              <CalendarDays size={22} /> Agenda Vita
            </Link>

            {organization && (
              <div className="hidden sm:flex items-center gap-2 border-l border-slate-200 pl-3">
                {organization.logo_url && !logoFailed ? (
                  <img
                    src={organization.logo_url}
                    alt={organization.name}
                    onError={() => setLogoFailed(true)}
                    className="size-7 rounded-md object-cover border border-slate-200 shadow-xs"
                  />
                ) : (
                  <div className="grid size-7 place-items-center rounded-md bg-vita-50 text-vita-700 border border-vita-100">
                    <Building2 size={14} />
                  </div>
                )}
                <span className="text-sm font-semibold text-slate-800 max-w-[200px] truncate">
                  {organization.name}
                </span>
              </div>
            )}
          </div>

          <div className="flex items-center gap-4 text-sm text-slate-600">
            <span className="hidden md:inline">{user?.email}</span>
            <button
              onClick={leave}
              className="inline-flex items-center gap-2 rounded-lg px-3 py-2 hover:bg-slate-100 transition text-slate-700"
            >
              <LogOut size={16} /> Sair
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-5 py-8">
        {organization ? (
          <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-slate-200/80 pb-6">
            <div className="flex items-center gap-4">
              {organization.logo_url && !logoFailed ? (
                <div className="size-16 shrink-0 overflow-hidden rounded-2xl border border-slate-200 bg-white p-0.5 shadow-xs">
                  <img
                    src={organization.logo_url}
                    alt={`Logotipo de ${organization.name}`}
                    onError={() => setLogoFailed(true)}
                    className="size-full rounded-[14px] object-cover"
                  />
                </div>
              ) : (
                <div className="grid size-16 shrink-0 place-items-center rounded-2xl border border-vita-100 bg-vita-50 text-vita-700 shadow-xs">
                  <Building2 size={30} />
                </div>
              )}
              <div>
                <div className="flex flex-wrap items-center gap-2.5">
                  <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
                    {organization.name}
                  </h1>
                  {organization.organization_type && (
                    <span className="rounded-md bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-600">
                      {organization.organization_type === 'professional' ? 'Profissional' : 'Clínica'}
                    </span>
                  )}
                </div>
                <p className="mt-1 text-sm text-slate-500">
                  {organization.specialty && (
                    <span className="font-medium text-slate-700">{organization.specialty} · </span>
                  )}
                  {organization.role && (
                    <>
                      Permissão: <strong className="text-slate-700">{organization.role}</strong>
                    </>
                  )}
                </p>
              </div>
            </div>
            {headerActions && <div>{headerActions}</div>}
          </div>
        ) : (
          <div className="mb-8 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="rounded-xl bg-vita-50 p-3 text-vita-700">
                <ShieldCheck size={22} />
              </div>
              <h1 className="text-2xl font-bold">{title}</h1>
            </div>
            {headerActions && <div>{headerActions}</div>}
          </div>
        )}

        {children}
      </main>
    </div>
  )
}
