import { useState, type FormEvent } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Archive, Building2, CirclePause, Pencil, Plus, RefreshCcw, Users, X } from 'lucide-react'
import { Navigate } from 'react-router-dom'
import { AppShell } from '../components/AppShell'
import { createOrganization, listOrganizations, setOrganizationStatus, type Organization, type OrganizationInput, updateOrganization } from '../lib/adminOrganizations'
import { useAuth } from '../providers/AuthProvider'

const platformAdminEmail = 'robsonsvicero@outlook.com'
const emptyForm: OrganizationInput = {
  name: '', slug: '', email: '', specialty: '', phone: '', address: '', logoUrl: '', organizationType: 'clinic',
  professionalCouncilRegistration: '', technicalResponsible: '', clinicCouncilRegistration: '', ownerName: '', ownerEmail: '', temporaryPassword: '',
}

export function PlatformDashboardPage() {
  const { user } = useAuth()
  const client = useQueryClient()
  const [form, setForm] = useState<OrganizationInput>(emptyForm)
  const [editing, setEditing] = useState(false)
  const [notice, setNotice] = useState('')
  const { data: organizations = [], isLoading, error } = useQuery({ queryKey: ['organizations'], queryFn: listOrganizations })
  const refresh = () => client.invalidateQueries({ queryKey: ['organizations'] })
  const save = useMutation({
    mutationFn: (value: OrganizationInput) => editing ? updateOrganization(value) : createOrganization(value),
    onSuccess: () => { setForm(emptyForm); setEditing(false); setNotice('Organização salva com sucesso.'); refresh() },
    onError: (cause: Error) => setNotice(`Erro: ${translateError(cause.message)}`),
  })
  const changeStatus = useMutation({
    mutationFn: ({ id, status }: { id: number, status: Organization['status'] }) => setOrganizationStatus(id, status),
    onSuccess: refresh,
    onError: (cause: Error) => setNotice(`Erro: ${translateError(cause.message)}`),
  })

  if (user?.email?.toLowerCase() !== platformAdminEmail) return <Navigate to="/painel" replace />
  const activeCount = organizations.filter(item => item.status === 'active').length
  const suspendedCount = organizations.filter(item => item.status === 'suspended').length
  const submit = (event: FormEvent) => { event.preventDefault(); setNotice(''); save.mutate({ ...form, slug: slugify(form.slug) }) }
  const edit = (organization: Organization) => {
    setForm({ id: organization.id, name: organization.name, slug: organization.slug, email: organization.email ?? '', specialty: organization.specialty ?? '', phone: organization.phone ?? '', address: organization.address ?? '', logoUrl: organization.logo_url ?? '', organizationType: organization.organization_type, professionalCouncilRegistration: organization.professional_council_registration ?? '', technicalResponsible: organization.technical_responsible ?? '', clinicCouncilRegistration: organization.clinic_council_registration ?? '' })
    setEditing(true); setNotice('')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  return <AppShell title="Painel administrativo geral">
    <p className="-mt-4 mb-8 max-w-2xl text-slate-600">Cadastre, atualize e controle o acesso de clínicas e profissionais da plataforma.</p>
    <div className="grid gap-5 md:grid-cols-3">
      <Metric icon={<Building2 />} label="Organizações" value={organizations.length} detail="Clínicas e profissionais" />
      <Metric icon={<Users />} label="Contas ativas" value={activeCount} detail="Organizações em operação" />
      <Metric icon={<CirclePause />} label="Suspensas" value={suspendedCount} detail="Acesso operacional bloqueado" />
    </div>

    <section className="mt-8 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex items-center justify-between gap-4"><div><h2 className="font-bold">{editing ? 'Editar organização' : 'Cadastrar organização'}</h2><p className="mt-1 text-sm text-slate-600">O usuário responsável receberá o papel de dono.</p></div>
        {editing && <button onClick={() => { setEditing(false); setForm(emptyForm) }} className="inline-flex items-center gap-1 text-sm text-slate-600 hover:text-slate-950"><X size={16} /> Cancelar</button>}</div>
      <form onSubmit={submit} className="mt-6 grid gap-4 md:grid-cols-2">
        <Field label="Nome da organização" value={form.name} onChange={value => setForm({ ...form, name: value, slug: editing ? form.slug : slugify(value) })} required />
        <label className="text-sm font-medium">Tipo<select value={form.organizationType} disabled={editing} onChange={event => setForm({ ...form, organizationType: event.target.value as OrganizationInput['organizationType'] })} className={inputStyle}><option value="clinic">Clínica</option><option value="professional">Profissional autônomo</option></select></label>
        <Field label="Slug" value={form.slug} onChange={value => setForm({ ...form, slug: slugify(value) })} hint={editing ? 'Você pode ajustar este identificador.' : 'Gerado automaticamente a partir do nome.'} readOnly={!editing} required />
        <Field label="E-mail da organização" type="email" value={form.email} onChange={value => setForm({ ...form, email: value })} required />
        <Field label="Especialidade" value={form.specialty} onChange={value => setForm({ ...form, specialty: value })} />
        <Field label="Telefone" value={form.phone} onChange={value => setForm({ ...form, phone: value })} />
        <Field label="Endereço" value={form.address} onChange={value => setForm({ ...form, address: value })} />
        <Field label="URL do logotipo" type="url" value={form.logoUrl ?? ''} onChange={value => setForm({ ...form, logoUrl: value })} />
        {form.organizationType === 'professional' && <Field label="Registro no conselho de classe" value={form.professionalCouncilRegistration ?? ''} onChange={value => setForm({ ...form, professionalCouncilRegistration: value })} hint="Ex.: CRM-SP 123456 ou CRO-SP 12345" required={!editing} />}
        {form.organizationType === 'clinic' && <><Field label="Responsável técnico (RT)" value={form.technicalResponsible ?? ''} onChange={value => setForm({ ...form, technicalResponsible: value })} required={!editing} />
          <Field label="Registro da clínica no conselho" value={form.clinicCouncilRegistration ?? ''} onChange={value => setForm({ ...form, clinicCouncilRegistration: value })} hint="Ex.: CRO-PJ 1234" required={!editing} /></>}
        {!editing && <><Field label="Nome do responsável" value={form.ownerName ?? ''} onChange={value => setForm({ ...form, ownerName: value })} required />
          <Field label="E-mail do responsável" type="email" value={form.ownerEmail ?? ''} onChange={value => setForm({ ...form, ownerEmail: value })} required />
          <Field label="Senha temporária" type="password" value={form.temporaryPassword ?? ''} onChange={value => setForm({ ...form, temporaryPassword: value })} hint="Mínimo de 8 caracteres" required /></>}
        <div className="flex items-end"><button disabled={save.isPending} className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-vita-600 px-4 py-2.5 font-semibold text-white hover:bg-vita-700 disabled:opacity-60"><Plus size={18} />{save.isPending ? 'Salvando…' : editing ? 'Salvar alterações' : 'Criar organização'}</button></div>
      </form>
      {notice && <p className={`mt-4 rounded-lg p-3 text-sm ${notice.startsWith('Erro:') ? 'bg-red-50 text-red-700' : 'bg-vita-50 text-vita-700'}`}>{notice}</p>}
    </section>

    <section className="mt-8 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="flex items-center justify-between p-6"><div><h2 className="font-bold">Organizações cadastradas</h2><p className="mt-1 text-sm text-slate-600">Suspenda uma conta para bloquear suas operações sem apagar o histórico.</p></div><button onClick={refresh} className="rounded-lg p-2 text-slate-600 hover:bg-slate-100" aria-label="Atualizar lista"><RefreshCcw size={18} /></button></div>
      {isLoading ? <p className="p-6 text-sm text-slate-500">Carregando organizações…</p> : error ? <p className="p-6 text-sm text-red-700">Não foi possível carregar a lista. Verifique se a Edge Function foi publicada.</p> :
        <div className="overflow-x-auto"><table className="w-full min-w-[800px] text-left text-sm"><thead className="border-y border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500"><tr><th className="px-6 py-3">Organização</th><th className="px-6 py-3">Tipo</th><th className="px-6 py-3">Membros</th><th className="px-6 py-3">Status</th><th className="px-6 py-3 text-right">Ações</th></tr></thead><tbody>
          {organizations.map(organization => <tr key={organization.id} className="border-b border-slate-100 last:border-0"><td className="px-6 py-4"><p className="font-medium">{organization.name}</p><p className="mt-0.5 text-xs text-slate-500">{organization.slug}</p></td><td className="px-6 py-4">{organization.organization_type === 'clinic' ? 'Clínica' : 'Profissional'}</td><td className="px-6 py-4">{organization.membersCount}</td><td className="px-6 py-4"><StatusBadge status={organization.status} /></td><td className="px-6 py-4"><div className="flex justify-end gap-2"><IconButton label="Editar" onClick={() => edit(organization)}><Pencil size={16} /></IconButton>{organization.status === 'active' ? <IconButton label="Suspender" onClick={() => changeStatus.mutate({ id: organization.id, status: 'suspended' })}><CirclePause size={16} /></IconButton> : <IconButton label="Reativar" onClick={() => changeStatus.mutate({ id: organization.id, status: 'active' })}><RefreshCcw size={16} /></IconButton>}<IconButton label="Arquivar" onClick={() => changeStatus.mutate({ id: organization.id, status: 'archived' })}><Archive size={16} /></IconButton></div></td></tr>)}
          {!organizations.length && <tr><td colSpan={5} className="px-6 py-10 text-center text-slate-500">Nenhuma organização cadastrada.</td></tr>}
        </tbody></table></div>}
    </section>
  </AppShell>
}

const inputStyle = 'mt-1.5 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 outline-none focus:border-vita-600'
function Field({ label, value, onChange, type = 'text', hint, readOnly = false, required = false }: { label: string, value: string, onChange: (value: string) => void, type?: string, hint?: string, readOnly?: boolean, required?: boolean }) {
  return <label className="text-sm font-medium">{label}<input type={type} value={value} onChange={event => onChange(event.target.value)} readOnly={readOnly} required={required} className={`${inputStyle} ${readOnly ? 'cursor-not-allowed bg-slate-100 text-slate-500' : ''}`} />{hint && <span className="mt-1 block text-xs font-normal text-slate-500">{hint}</span>}</label>
}
function Metric({ icon, label, value, detail }: { icon: React.ReactNode, label: string, value: number, detail: string }) {
  return <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div className="text-vita-600">{icon}</div><p className="mt-4 text-sm text-slate-500">{label}</p><p className="mt-1 text-3xl font-bold">{value}</p><p className="mt-2 text-xs text-slate-500">{detail}</p></article>
}
function StatusBadge({ status }: { status: Organization['status'] }) {
  const labels = { active: 'Ativa', suspended: 'Suspensa', archived: 'Arquivada' }
  const colors = { active: 'bg-emerald-50 text-emerald-700', suspended: 'bg-amber-50 text-amber-700', archived: 'bg-slate-100 text-slate-600' }
  return <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${colors[status]}`}>{labels[status]}</span>
}
function IconButton({ label, onClick, children }: { label: string, onClick: () => void, children: React.ReactNode }) {
  return <button onClick={onClick} aria-label={label} title={label} className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 hover:text-vita-700">{children}</button>
}
function slugify(value: string) {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80)
}
function translateError(message: string) {
  if (message.includes('User already registered')) return 'já existe um usuário com este e-mail.'
  if (message.includes('duplicate key')) return 'o slug ou e-mail já está em uso.'
  if (message === 'invalid_organization_data') return 'confira todos os campos obrigatórios.'
  if (message === 'professional_council_registration_required') return 'informe o registro no conselho de classe do profissional.'
  if (message === 'clinic_technical_registration_required') return 'informe o responsável técnico e o registro da clínica no conselho.'
  return message
}
