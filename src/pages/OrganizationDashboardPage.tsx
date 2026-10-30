import { useEffect, useMemo, useState, type ChangeEvent, type FormEvent } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Building2,
  CalendarDays,
  Camera,
  ClipboardList,
  ExternalLink,
  LayoutDashboard,
  LogOut,
  Menu,
  Settings2,
  ShieldAlert,
  UsersRound,
  X,
} from 'lucide-react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { AppShell } from '../components/AppShell'
import { AgendaSection } from '../components/AgendaSection'
import { ChangePasswordCard } from '../components/ChangePasswordCard'
import { DashboardSection } from '../components/DashboardSection'
import { OrganizationTeamSection } from '../components/OrganizationTeamSection'
import { PatientsSection } from '../components/PatientsSection'
import { ScheduleSettingsSection } from '../components/ScheduleSettingsSection'
import {
  listMyOrganizations,
  updateOrganizationProfile,
  uploadOrganizationLogo,
  type OrganizationMembership,
  type OrganizationProfile,
} from '../lib/organization'
import { useAuth } from '../providers/AuthProvider'

const canManageProfile = (role: OrganizationMembership['role']) => role === 'owner' || role === 'manager'

export function OrganizationDashboardPage() {
  const { user, signOut } = useAuth()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [logoFailed, setLogoFailed] = useState(false)

  const { data: memberships = [], isLoading, error } = useQuery({
    queryKey: ['my-organizations', user?.id],
    queryFn: () => listMyOrganizations(user!.id),
    enabled: Boolean(user?.id),
  })

  const [selectedId, setSelectedId] = useState<number | null>(null)
  const location = useLocation()
  const selected = useMemo(
    () => memberships.find(item => item.clinic_id === selectedId) ?? memberships[0],
    [memberships, selectedId]
  )

  useEffect(() => {
    if (!selectedId && memberships[0]) setSelectedId(memberships[0].clinic_id)
  }, [memberships, selectedId])

  // Reset logo failed status when switching organizations
  useEffect(() => {
    setLogoFailed(false)
  }, [selected?.clinic_id])

  if (isLoading) return <LoadingScreen />
  if (error)
    return (
      <AppShell title="Painel da organização">
        <ErrorState message="Não foi possível carregar sua organização. Confirme se o schema foi aplicado e se seu usuário foi vinculado à organização." />
      </AppShell>
    )
  if (!selected)
    return (
      <AppShell title="Painel da organização">
        <ErrorState message="Seu usuário ainda não está vinculado a uma organização. Peça ao administrador geral para criar ou vincular sua conta." />
      </AppShell>
    )

  const rawSection = location.pathname.split('/')[2]
  const section = rawSection || 'dashboard'

  const navigation = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'agenda', label: 'Agenda', icon: CalendarDays },
    { id: 'pacientes', label: 'Pacientes', icon: UsersRound },
    { id: 'equipe', label: 'Equipe e recursos', icon: ClipboardList },
    { id: 'configuracoes', label: 'Configurações', icon: Settings2 },
  ]

  const leave = async () => {
    await signOut()
    navigate('/entrar')
  }

  const renderSidebarContent = () => (
    <div className="flex h-full flex-col justify-between">
      {/* Top section: Organization Branding & Navigation */}
      <div>
        {/* Organization Brand Card */}
        <div className="p-5 border-b border-slate-200">
          <div className="flex items-center gap-3">
            {selected.clinic.logo_url && !logoFailed ? (
              <div className="size-11 shrink-0 overflow-hidden rounded-xl border border-slate-200 bg-white p-0.5 shadow-2xs">
                <img
                  src={selected.clinic.logo_url}
                  alt={selected.clinic.name}
                  onError={() => setLogoFailed(true)}
                  className="size-full rounded-[9px] object-cover"
                />
              </div>
            ) : (
              <div className="grid size-11 shrink-0 place-items-center rounded-xl bg-vita-50 text-vita-700 border border-vita-100 shadow-2xs">
                <Building2 size={20} />
              </div>
            )}
            <div className="min-w-0 flex-1">
              <h2 className="text-sm font-extrabold text-slate-900 truncate leading-tight">
                {selected.clinic.name}
              </h2>
              <div className="mt-0.5 flex items-center gap-1.5">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  {selected.clinic.organization_type === 'professional' ? 'Profissional' : 'Clínica'}
                </span>
                {selected.clinic.specialty && (
                  <>
                    <span className="text-slate-300">·</span>
                    <span className="text-[11px] text-slate-500 truncate max-w-[100px]">
                      {selected.clinic.specialty}
                    </span>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Multi-organization Switcher */}
          {memberships.length > 1 && (
            <div className="mt-3.5">
              <label className="text-[11px] font-semibold text-slate-500 block mb-1">
                Trocar organização:
              </label>
              <select
                value={selected.clinic_id}
                onChange={event => setSelectedId(Number(event.target.value))}
                className="w-full rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs font-semibold text-slate-700 outline-none focus:border-vita-600 transition"
              >
                {memberships.map(item => (
                  <option key={item.clinic_id} value={item.clinic_id}>
                    {item.clinic.name}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* Navigation Items */}
        <nav className="p-3 space-y-1">
          {navigation.map(item => {
            const isActive = section === item.id
            const Icon = item.icon
            return (
              <Link
                key={item.id}
                to={item.id === 'dashboard' ? '/painel' : `/painel/${item.id}`}
                onClick={() => setMobileMenuOpen(false)}
                className={`flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-semibold transition ${
                  isActive
                    ? 'bg-vita-50 text-vita-700 border border-vita-200/80 shadow-2xs font-bold'
                    : 'text-slate-600 hover:bg-slate-100/80 hover:text-slate-900'
                }`}
              >
                <Icon
                  size={18}
                  className={isActive ? 'text-vita-700 stroke-[2.2]' : 'text-slate-400'}
                />
                <span>{item.label}</span>
              </Link>
            )
          })}
        </nav>
      </div>

      {/* Bottom section: Public Booking card & User Profile */}
      <div>
        {/* Public Booking Shortcut */}
        <div className="mx-3 mb-3 rounded-xl border border-slate-200 bg-slate-50/70 p-3 text-xs">
          <div className="flex items-center justify-between">
            <span className="font-bold text-slate-700">Agendamento online</span>
            <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-800">
              Ativo
            </span>
          </div>
          <p className="mt-1 text-[11px] text-slate-500 truncate">agendar/{selected.clinic.slug}</p>
          <a
            href={`/#/agendar/${selected.clinic.slug}`}
            target="_blank"
            rel="noreferrer"
            className="mt-2.5 inline-flex w-full items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white py-1.5 text-xs font-semibold text-slate-700 shadow-2xs transition hover:bg-slate-50 hover:text-slate-900"
          >
            <ExternalLink size={13} />
            <span>Ver página pública</span>
          </a>
        </div>

        {/* User bar */}
        <div className="flex items-center justify-between gap-3 border-t border-slate-200 bg-white p-4">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="grid size-9 shrink-0 place-items-center rounded-xl bg-vita-50 text-vita-700 font-bold text-xs border border-vita-100 shadow-2xs">
              {(user?.email?.[0] || 'U').toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-bold text-slate-900 truncate">{user?.email}</p>
              <p className="text-[11px] text-slate-500 font-medium">
                {roleLabel(selected.role)}
              </p>
            </div>
          </div>
          <button
            onClick={leave}
            title="Sair da plataforma"
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition shrink-0"
          >
            <LogOut size={16} />
          </button>
        </div>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col lg:flex-row antialiased">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex w-64 xl:w-72 shrink-0 flex-col border-r border-slate-200 bg-white sticky top-0 h-screen z-20">
        {renderSidebarContent()}
      </aside>

      {/* Mobile Topbar */}
      <header className="lg:hidden sticky top-0 z-30 flex h-16 items-center justify-between border-b border-slate-200 bg-white px-5 shadow-2xs">
        <div className="flex items-center gap-2.5 min-w-0">
          <button
            onClick={() => setMobileMenuOpen(true)}
            className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 transition"
            aria-label="Abrir menu"
          >
            <Menu size={20} />
          </button>
          <div className="flex items-center gap-2 min-w-0">
            {selected.clinic.logo_url && !logoFailed ? (
              <img
                src={selected.clinic.logo_url}
                alt={selected.clinic.name}
                onError={() => setLogoFailed(true)}
                className="size-7 rounded-md object-cover border border-slate-200 shadow-2xs"
              />
            ) : (
              <div className="grid size-7 place-items-center rounded-md bg-vita-50 text-vita-700 border border-vita-100">
                <Building2 size={14} />
              </div>
            )}
            <span className="font-bold text-slate-900 text-sm truncate">
              {selected.clinic.name}
            </span>
          </div>
        </div>

        <button
          onClick={leave}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900"
        >
          <LogOut size={15} /> Sair
        </button>
      </header>

      {/* Mobile Sidebar Overlay Drawer */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div
            className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs transition-opacity"
            onClick={() => setMobileMenuOpen(false)}
          />
          <div className="relative w-72 max-w-[85vw] bg-white h-full shadow-xl flex flex-col z-10">
            <button
              onClick={() => setMobileMenuOpen(false)}
              className="absolute top-4 right-4 rounded-lg p-1.5 text-slate-400 hover:text-slate-700"
              aria-label="Fechar menu"
            >
              <X size={18} />
            </button>
            {renderSidebarContent()}
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex-1 min-w-0 flex flex-col">
        {/* Top Header on Desktop */}
        <header className="hidden lg:flex h-16 border-b border-slate-200/80 bg-white sticky top-0 z-10 items-center justify-between px-8">
          <div className="flex items-center gap-2.5">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Painel
            </span>
            <span className="text-slate-300">/</span>
            <h1 className="text-base font-extrabold text-slate-900 capitalize">
              {navigation.find(n => n.id === section)?.label || 'Dashboard'}
            </h1>
          </div>

          <div className="flex items-center gap-4">
            <a
              href={`/#/agendar/${selected.clinic.slug}`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-2xs hover:bg-slate-50 transition"
            >
              <ExternalLink size={13} />
              <span>Link de agendamento</span>
            </a>
            <div className="h-4 w-px bg-slate-200" />
            <span className="text-xs font-semibold text-slate-600">
              {selected.clinic.name}
            </span>
          </div>
        </header>

        {/* Content Container */}
        <main className="flex-1 p-5 sm:p-8 max-w-7xl w-full mx-auto">
          {/* Organization Status Alert */}
          {selected.clinic.status !== 'active' && (
            <div className="mb-6 flex gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
              <ShieldAlert className="shrink-0" size={20} />
              Esta organização está {selected.clinic.status === 'suspended' ? 'suspensa' : 'arquivada'};
              alterações e operações estão bloqueadas.
            </div>
          )}

          {/* Section Router */}
          {section === 'dashboard' && (
            <DashboardSection
              clinicId={selected.clinic_id}
              clinicSlug={selected.clinic.slug}
              organizationType={selected.clinic.organization_type}
            />
          )}

          {section === 'agenda' && (
            <AgendaSection
              clinicId={selected.clinic_id}
              enabled={selected.clinic.status === 'active'}
              organizationType={selected.clinic.organization_type}
            />
          )}

          {section === 'pacientes' && (
            <PatientsSection
              clinicId={selected.clinic_id}
              enabled={selected.clinic.status === 'active'}
            />
          )}

          {section === 'equipe' && (
            <OrganizationTeamSection
              clinicId={selected.clinic_id}
              enabled={canManageProfile(selected.role) && selected.clinic.status === 'active'}
            />
          )}

          {section === 'configuracoes' && (
            <div className="space-y-8">
              <OrganizationProfileForm
                membership={selected}
                onSaved={() =>
                  queryClient.invalidateQueries({ queryKey: ['my-organizations', user?.id] })
                }
              />
              <ScheduleSettingsSection
                clinicId={selected.clinic_id}
                enabled={canManageProfile(selected.role) && selected.clinic.status === 'active'}
              />
              <ChangePasswordCard />
            </div>
          )}
        </main>
      </div>
    </div>
  )
}

function OrganizationProfileForm({
  membership,
  onSaved,
}: {
  membership: OrganizationMembership
  onSaved: () => void
}) {
  const editable = canManageProfile(membership.role) && membership.clinic.status === 'active'
  const [profile, setProfile] = useState<OrganizationProfile>(membership.clinic)
  const [message, setMessage] = useState('')
  const [errors, setErrors] = useState<Record<string, string>>({})
  useEffect(() => {
    setProfile(membership.clinic)
    setMessage('')
    setErrors({})
  }, [membership])
  const save = useMutation({
    mutationFn: updateOrganizationProfile,
    onSuccess: () => {
      setMessage('Dados salvos com sucesso.')
      setErrors({})
      onSaved()
    },
    onError: (error: Error) => setMessage(`Erro: ${error.message}`),
  })
  const upload = useMutation({
    mutationFn: (file: File) => uploadOrganizationLogo(profile.id, file),
    onSuccess: url => {
      setProfile(current => ({ ...current, logo_url: url }))
      setMessage('Logotipo atualizado com sucesso.')
      onSaved()
    },
    onError: (error: Error) => setMessage(`Erro: ${error.message}`),
  })

  const updateProfileField = <K extends keyof OrganizationProfile>(
    field: K,
    value: OrganizationProfile[K]
  ) => {
    setProfile(prev => ({ ...prev, [field]: value }))
    if (errors[field as string]) {
      setErrors(prev => {
        const next = { ...prev }
        delete next[field as string]
        return next
      })
    }
  }

  const validate = () => {
    const errs: Record<string, string> = {}
    if (!profile.name.trim()) errs.name = 'Nome é obrigatório.'
    if (profile.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(profile.email)) {
      errs.email = 'Informe um e-mail válido.'
    }
    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  const submit = (event: FormEvent) => {
    event.preventDefault()
    setMessage('')
    if (!validate()) {
      setMessage('Erro: Corrija os campos destacados em vermelho.')
      return
    }
    save.mutate(profile)
  }
  const logoChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file) {
      setMessage('')
      upload.mutate(file)
    }
    event.target.value = ''
  }

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs">
      <div className="flex flex-col justify-between gap-4 sm:flex-row">
        <div>
          <h2 className="font-bold text-slate-900">Perfil da organização</h2>
          <p className="mt-1 text-sm text-slate-600">
            Dados exibidos no painel e na página pública de agendamento.
          </p>
        </div>
        <Logo
          profile={profile}
          editable={editable}
          uploading={upload.isPending}
          onChange={logoChange}
        />
      </div>
      <form onSubmit={submit} className="mt-6 grid gap-4 md:grid-cols-2">
        <Field
          label="Nome"
          value={profile.name}
          onChange={value => updateProfileField('name', value)}
          error={errors.name}
          disabled={!editable}
          required
        />
        <Field
          label="E-mail"
          type="email"
          value={profile.email ?? ''}
          onChange={value => updateProfileField('email', value)}
          error={errors.email}
          disabled={!editable}
        />
        <Field
          label="Especialidade"
          value={profile.specialty ?? ''}
          onChange={value => updateProfileField('specialty', value)}
          disabled={!editable}
        />
        <Field
          label="Telefone"
          value={profile.phone ?? ''}
          onChange={value => updateProfileField('phone', value)}
          disabled={!editable}
        />
        <Field
          label="Endereço"
          value={profile.address ?? ''}
          onChange={value => updateProfileField('address', value)}
          disabled={!editable}
        />
        <div className="hidden md:block" />
        {profile.organization_type === 'professional' ? (
          <Field
            label="Registro no conselho de classe"
            value={profile.professional_council_registration ?? ''}
            onChange={value => updateProfileField('professional_council_registration', value)}
            disabled={!editable}
          />
        ) : (
          <>
            <Field
              label="Responsável técnico (RT)"
              value={profile.technical_responsible ?? ''}
              onChange={value => updateProfileField('technical_responsible', value)}
              disabled={!editable}
            />
            <Field
              label="Registro da clínica no conselho"
              value={profile.clinic_council_registration ?? ''}
              onChange={value => updateProfileField('clinic_council_registration', value)}
              disabled={!editable}
            />
          </>
        )}
        {editable && (
          <div className="flex items-end">
            <button
              disabled={save.isPending || upload.isPending}
              className="w-full rounded-lg bg-vita-600 px-4 py-2.5 font-semibold text-white shadow-xs transition hover:bg-vita-700 active:scale-[0.98] disabled:opacity-60"
            >
              {save.isPending ? 'Salvando…' : 'Salvar alterações'}
            </button>
          </div>
        )}
      </form>
      {message && (
        <p
          className={`mt-4 rounded-lg p-3 text-sm ${
            message.startsWith('Erro:') ? 'bg-red-50 text-red-700' : 'bg-vita-50 text-vita-700'
          }`}
        >
          {message}
        </p>
      )}
    </section>
  )
}

function Logo({
  profile,
  editable,
  uploading,
  onChange,
}: {
  profile: OrganizationProfile
  editable: boolean
  uploading: boolean
  onChange: (event: ChangeEvent<HTMLInputElement>) => void
}) {
  return (
    <div className="flex items-center gap-3">
      <div className="grid size-16 place-items-center overflow-hidden rounded-2xl bg-vita-50 text-vita-700 border border-vita-100 shadow-2xs">
        {profile.logo_url ? (
          <img
            src={profile.logo_url}
            alt={`Logotipo de ${profile.name}`}
            className="size-full object-cover"
          />
        ) : (
          <Building2 size={28} />
        )}
      </div>
      {editable && (
        <label className="cursor-pointer rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 shadow-2xs hover:bg-slate-50 transition">
          <span className="inline-flex items-center gap-2">
            <Camera size={16} />
            {uploading ? 'Enviando…' : 'Enviar logo'}
          </span>
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={onChange}
            disabled={uploading}
            className="hidden"
          />
        </label>
      )}
    </div>
  )
}

function Field({
  label,
  value,
  onChange,
  type = 'text',
  error,
  disabled = false,
  required = false,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  type?: string
  error?: string
  disabled?: boolean
  required?: boolean
}) {
  const isInvalid = Boolean(error)
  const borderClass = isInvalid
    ? 'border-red-500 focus:border-red-600 bg-red-50/20 text-red-950'
    : 'border-slate-300 focus:border-vita-600 bg-white'
  return (
    <label className="text-sm font-medium text-slate-700">
      {label}
      <input
        type={type}
        value={value}
        onChange={event => onChange(event.target.value)}
        disabled={disabled}
        required={required}
        className={`mt-1.5 block w-full rounded-lg border px-3 py-2.5 text-sm outline-none transition-colors ${borderClass} disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-500`}
      />
      {error && <span className="mt-1 block text-xs font-normal text-red-600">{error}</span>}
    </label>
  )
}

function ErrorState({ message }: { message: string }) {
  return (
    <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6 text-amber-950">
      <ShieldAlert size={24} />
      <p className="mt-3 font-semibold">Acesso à organização indisponível</p>
      <p className="mt-1 text-sm">{message}</p>
    </div>
  )
}

function LoadingScreen() {
  return (
    <AppShell title="Painel da organização">
      <p className="text-slate-500">Carregando organização…</p>
    </AppShell>
  )
}

function roleLabel(role: OrganizationMembership['role']) {
  return (
    {
      owner: 'Dono',
      manager: 'Gestor',
      secretary: 'Secretária',
      professional: 'Profissional',
    }[role] || role
  )
}
