import { useEffect, useMemo, useState, type ChangeEvent, type FormEvent } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Building2, Camera, CalendarDays, ClipboardList, Settings2, ShieldAlert, UsersRound } from 'lucide-react'
import { Link, useLocation } from 'react-router-dom'
import { AppShell } from '../components/AppShell'
import { OrganizationTeamSection } from '../components/OrganizationTeamSection'
import { ScheduleSettingsSection } from '../components/ScheduleSettingsSection'
import { PatientsSection } from '../components/PatientsSection'
import { AgendaSection } from '../components/AgendaSection'
import { listMyOrganizations, updateOrganizationProfile, uploadOrganizationLogo, type OrganizationMembership, type OrganizationProfile } from '../lib/organization'
import { useAuth } from '../providers/AuthProvider'

const canManageProfile = (role: OrganizationMembership['role']) => role === 'owner' || role === 'manager'

export function OrganizationDashboardPage() {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const { data: memberships = [], isLoading, error } = useQuery({
    queryKey: ['my-organizations', user?.id], queryFn: () => listMyOrganizations(user!.id), enabled: Boolean(user?.id),
  })
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const location = useLocation()
  const selected = useMemo(() => memberships.find(item => item.clinic_id === selectedId) ?? memberships[0], [memberships, selectedId])
  useEffect(() => { if (!selectedId && memberships[0]) setSelectedId(memberships[0].clinic_id) }, [memberships, selectedId])

  if (isLoading) return <LoadingScreen />
  if (error) return <AppShell title="Painel da organização"><ErrorState message="Não foi possível carregar sua organização. Confirme se o schema foi aplicado e se seu usuário foi vinculado à organização." /></AppShell>
  if (!selected) return <AppShell title="Painel da organização"><ErrorState message="Seu usuário ainda não está vinculado a uma organização. Peça ao administrador geral para criar ou vincular sua conta." /></AppShell>

  const section = location.pathname.split('/')[2] || 'agenda'
  const navigation = [
    { id: 'agenda', label: 'Agenda', icon: <CalendarDays size={17} /> },
    { id: 'pacientes', label: 'Pacientes', icon: <UsersRound size={17} /> },
    { id: 'equipe', label: 'Equipe e recursos', icon: <ClipboardList size={17} /> },
    { id: 'configuracoes', label: 'Configurações', icon: <Settings2 size={17} /> },
  ]
  return <AppShell title="Painel da organização">
    <div className="mb-7 flex flex-col justify-between gap-4 sm:flex-row sm:items-center"><div><p className="text-slate-600">Gerencie os dados e a operação da sua organização.</p><p className="mt-1 text-sm text-slate-500">Permissão atual: <strong>{roleLabel(selected.role)}</strong></p></div>
      {memberships.length > 1 && <label className="text-sm font-medium">Organização<select value={selected.clinic_id} onChange={event => setSelectedId(Number(event.target.value))} className="ml-2 rounded-lg border border-slate-300 bg-white px-3 py-2"><>{memberships.map(item => <option key={item.clinic_id} value={item.clinic_id}>{item.clinic.name}</option>)}</></select></label>}</div>
    {selected.clinic.status !== 'active' && <div className="mb-6 flex gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900"><ShieldAlert className="shrink-0" size={20} />Esta organização está {selected.clinic.status === 'suspended' ? 'suspensa' : 'arquivada'}; alterações e operações estão bloqueadas.</div>}
    <nav className="mb-8 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{navigation.map(item => <Link key={item.id} to={`/painel/${item.id}`} className={`flex items-center gap-3 rounded-xl border p-4 text-sm font-semibold transition ${section === item.id ? 'border-vita-600 bg-vita-50 text-vita-700' : 'border-slate-200 bg-white text-slate-700 hover:border-vita-600 hover:text-vita-700'}`}>{item.icon}{item.label}</Link>)}</nav>
    {section === 'agenda' && <AgendaSection clinicId={selected.clinic_id} enabled={selected.clinic.status === 'active'} />}
    {section === 'pacientes' && <PatientsSection clinicId={selected.clinic_id} enabled={selected.clinic.status === 'active'} />}
    {section === 'equipe' && <OrganizationTeamSection clinicId={selected.clinic_id} enabled={canManageProfile(selected.role) && selected.clinic.status === 'active'} />}
    {section === 'configuracoes' && <><OrganizationProfileForm membership={selected} onSaved={() => queryClient.invalidateQueries({ queryKey: ['my-organizations', user?.id] })} /><ScheduleSettingsSection clinicId={selected.clinic_id} enabled={canManageProfile(selected.role) && selected.clinic.status === 'active'} /></>}
  </AppShell>
}

function OrganizationProfileForm({ membership, onSaved }: { membership: OrganizationMembership, onSaved: () => void }) {
  const editable = canManageProfile(membership.role) && membership.clinic.status === 'active'
  const [profile, setProfile] = useState<OrganizationProfile>(membership.clinic)
  const [message, setMessage] = useState('')
  useEffect(() => { setProfile(membership.clinic); setMessage('') }, [membership])
  const save = useMutation({ mutationFn: updateOrganizationProfile, onSuccess: () => { setMessage('Dados salvos com sucesso.'); onSaved() }, onError: (error: Error) => setMessage(`Erro: ${error.message}`) })
  const upload = useMutation({ mutationFn: (file: File) => uploadOrganizationLogo(profile.id, file), onSuccess: (url) => { setProfile(current => ({ ...current, logo_url: url })); setMessage('Logotipo atualizado com sucesso.'); onSaved() }, onError: (error: Error) => setMessage(`Erro: ${error.message}`) })
  const submit = (event: FormEvent) => { event.preventDefault(); setMessage(''); save.mutate(profile) }
  const logoChange = (event: ChangeEvent<HTMLInputElement>) => { const file = event.target.files?.[0]; if (file) { setMessage(''); upload.mutate(file) }; event.target.value = '' }

  return <section className="mt-8 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"><div className="flex flex-col justify-between gap-4 sm:flex-row"><div><h2 className="font-bold">Perfil da organização</h2><p className="mt-1 text-sm text-slate-600">Dados exibidos no painel e no futuro agendamento público.</p></div><Logo profile={profile} editable={editable} uploading={upload.isPending} onChange={logoChange} /></div>
    <form onSubmit={submit} className="mt-6 grid gap-4 md:grid-cols-2"><Field label="Nome" value={profile.name} onChange={value => setProfile({ ...profile, name: value })} disabled={!editable} required /><Field label="E-mail" type="email" value={profile.email ?? ''} onChange={value => setProfile({ ...profile, email: value })} disabled={!editable} />
      <Field label="Especialidade" value={profile.specialty ?? ''} onChange={value => setProfile({ ...profile, specialty: value })} disabled={!editable} /><Field label="Telefone" value={profile.phone ?? ''} onChange={value => setProfile({ ...profile, phone: value })} disabled={!editable} />
      <Field label="Endereço" value={profile.address ?? ''} onChange={value => setProfile({ ...profile, address: value })} disabled={!editable} />
      <div className="hidden md:block" />
      {profile.organization_type === 'professional' ? <Field label="Registro no conselho de classe" value={profile.professional_council_registration ?? ''} onChange={value => setProfile({ ...profile, professional_council_registration: value })} disabled={!editable} /> : <><Field label="Responsável técnico (RT)" value={profile.technical_responsible ?? ''} onChange={value => setProfile({ ...profile, technical_responsible: value })} disabled={!editable} /><Field label="Registro da clínica no conselho" value={profile.clinic_council_registration ?? ''} onChange={value => setProfile({ ...profile, clinic_council_registration: value })} disabled={!editable} /></>}
      {editable && <div className="flex items-end"><button disabled={save.isPending || upload.isPending} className="w-full rounded-lg bg-vita-600 px-4 py-2.5 font-semibold text-white hover:bg-vita-700 disabled:opacity-60">{save.isPending ? 'Salvando…' : 'Salvar alterações'}</button></div>}
    </form>{message && <p className={`mt-4 rounded-lg p-3 text-sm ${message.startsWith('Erro:') ? 'bg-red-50 text-red-700' : 'bg-vita-50 text-vita-700'}`}>{message}</p>}
  </section>
}

function Logo({ profile, editable, uploading, onChange }: { profile: OrganizationProfile, editable: boolean, uploading: boolean, onChange: (event: ChangeEvent<HTMLInputElement>) => void }) {
  return <div className="flex items-center gap-3"><div className="grid size-16 place-items-center overflow-hidden rounded-2xl bg-vita-50 text-vita-700">{profile.logo_url ? <img src={profile.logo_url} alt={`Logotipo de ${profile.name}`} className="size-full object-cover" /> : <Building2 size={28} />}</div>{editable && <label className="cursor-pointer rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium hover:bg-slate-50"><span className="inline-flex items-center gap-2"><Camera size={16} />{uploading ? 'Enviando…' : 'Enviar logo'}</span><input type="file" accept="image/jpeg,image/png,image/webp" onChange={onChange} disabled={uploading} className="hidden" /></label>}</div>
}

function Field({ label, value, onChange, type = 'text', disabled = false, required = false }: { label: string, value: string, onChange: (value: string) => void, type?: string, disabled?: boolean, required?: boolean }) { return <label className="text-sm font-medium">{label}<input type={type} value={value} onChange={event => onChange(event.target.value)} disabled={disabled} required={required} className="mt-1.5 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 outline-none focus:border-vita-600 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-500" /></label> }
function ErrorState({ message }: { message: string }) { return <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6 text-amber-950"><ShieldAlert size={24} /><p className="mt-3 font-semibold">Acesso à organização indisponível</p><p className="mt-1 text-sm">{message}</p></div> }
function LoadingScreen() { return <AppShell title="Painel da organização"><p className="text-slate-500">Carregando organização…</p></AppShell> }
function roleLabel(role: OrganizationMembership['role']) { return ({ owner: 'Dono', manager: 'Gestor', secretary: 'Secretária', professional: 'Profissional' })[role] }
