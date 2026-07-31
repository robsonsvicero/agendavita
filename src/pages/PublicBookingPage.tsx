import { useEffect, useState, type FormEvent } from 'react'
import { useQuery } from '@tanstack/react-query'
import { CalendarCheck2 } from 'lucide-react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'

const today = new Date().toISOString().slice(0, 10)
const emptyForm = { professionalId: '', resourceId: '', time: '', name: '', phone: '', email: '', address: '', birthDate: '' }
type PublicClinic = { name: string, specialty: string | null, logo_url: string | null, primary_color: string | null, secondary_color: string | null, background_color: string | null, font_family: string | null, google_font_family: string | null }

export function PublicBookingPage() {
  const { slug: routeSlug } = useParams()
  const navigate = useNavigate()
  const [slug, setSlug] = useState(routeSlug ?? '')
  const [date, setDate] = useState(today)
  const [form, setForm] = useState(emptyForm)
  const [message, setMessage] = useState('')
  const call = async (body: Record<string, unknown>) => {
    if (!supabase) throw new Error('Sistema não configurado.')
    const { data, error } = await supabase.functions.invoke('public-booking', { body: { slug: routeSlug, ...body } })
    if (error) {
      const response = (error as { context?: Response }).context
      const details = response instanceof Response ? await response.json().catch(() => null) as { error?: string } | null : null
      throw new Error(details?.error ?? error.message)
    }
    if (data?.error) throw new Error(data.error)
    return data
  }
  const info = useQuery({ queryKey: ['public-info', routeSlug], enabled: Boolean(routeSlug), queryFn: () => call({ action: 'info' }) as Promise<{ clinic: PublicClinic, professionals: { id: number, name: string }[] }> })

  useEffect(() => {
    const clinic = info.data?.clinic
    if (!clinic) return
    const root = document.documentElement
    const fontName = clinic.google_font_family?.trim() || clinic.font_family || 'Inter'
    root.style.setProperty('--color-vita-600', clinic.primary_color || '#0f766e')
    root.style.setProperty('--color-vita-700', clinic.secondary_color || '#0f5f59')
    document.body.style.backgroundColor = clinic.background_color || '#f8fafc'
    document.body.style.fontFamily = `${fontName}, Arial, sans-serif`
    let fontLink: HTMLLinkElement | undefined
    if (clinic.google_font_family?.trim()) {
      const family = clinic.google_font_family.trim()
      fontLink = document.createElement('link')
      fontLink.rel = 'stylesheet'
      fontLink.href = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(family).replace(/%20/g, '+')}:wght@400;500;600;700&display=swap`
      document.head.append(fontLink)
    }
    return () => {
      root.style.removeProperty('--color-vita-600')
      root.style.removeProperty('--color-vita-700')
      document.body.style.backgroundColor = ''
      document.body.style.fontFamily = ''
      fontLink?.remove()
    }
  }, [info.data])

  const slots = useQuery({
    queryKey: ['public-slots', routeSlug, date, form.professionalId, form.resourceId],
    enabled: Boolean(routeSlug && form.professionalId),
    queryFn: async () => ((await call({ action: 'slots', date, professionalId: +form.professionalId, resourceId: form.resourceId ? +form.resourceId : null }))?.slots ?? []) as string[],
  })
  const submit = async (event: FormEvent) => {
    event.preventDefault()
    try {
      await call({ action: 'book', date, professionalId: +form.professionalId, resourceId: form.resourceId ? +form.resourceId : null, time: form.time, patient: form })
      setMessage('Agendamento realizado com sucesso.')
      setForm(emptyForm)
      window.setTimeout(() => setMessage(''), 4000)
    } catch (error) {
      setMessage(`Erro: ${error instanceof Error ? error.message : 'Não foi possível agendar.'}`)
    }
  }

  if (!routeSlug) return <main className="mx-auto max-w-lg p-8"><h1 className="text-3xl font-bold">Agendar atendimento</h1><p className="mt-2 text-slate-600">Informe o slug da clínica ou profissional.</p><form onSubmit={event => { event.preventDefault(); if (slug) navigate(`/agendar/${slug}`) }} className="mt-6 flex gap-2"><input value={slug} onChange={event => setSlug(event.target.value)} placeholder="ex.: clinica-centro" className="flex-1 rounded-lg border px-3 py-2" /><button className="rounded-lg bg-vita-600 px-4 text-white">Continuar</button></form></main>

  const clinic = info.data?.clinic
  return <main className="mx-auto max-w-2xl p-5 py-10"><Link to="/" className="text-sm text-vita-700">← Agenda Vita</Link><div className="mt-4 rounded-2xl border bg-white p-6 shadow-sm">{info.isLoading ? <p>Carregando…</p> : info.error || !clinic ? <p className="text-red-700">Clínica não encontrada ou indisponível.</p> : <><div className="flex gap-3"><div className="grid size-12 place-items-center overflow-hidden rounded-xl bg-vita-50 text-vita-700">{clinic.logo_url ? <img src={clinic.logo_url} alt={`Logotipo de ${clinic.name}`} className="size-full object-cover" /> : <CalendarCheck2 />}</div><div><h1 className="text-2xl font-bold">{clinic.name}</h1><p className="text-sm text-slate-600">{clinic.specialty}</p></div></div><form onSubmit={submit} className="mt-6 grid gap-4 sm:grid-cols-2"><Select label="Profissional" value={form.professionalId} set={value => setForm({ ...form, professionalId: value, time: '' })} items={info.data?.professionals ?? []} /><label>Data<input type="date" min={today} value={date} onChange={event => { setDate(event.target.value); setForm({ ...form, time: '' }) }} className="input" /></label><label>Horário<select value={form.time} onChange={event => setForm({ ...form, time: event.target.value })} className="input" required><option value="">{slots.isLoading ? 'Buscando…' : 'Selecione'}</option>{(slots.data ?? []).map(time => <option key={time}>{time}</option>)}</select></label><label>Nome<input value={form.name} onChange={event => setForm({ ...form, name: event.target.value })} required className="input" /></label><label>Telefone<input value={form.phone} onChange={event => setForm({ ...form, phone: event.target.value })} required className="input" /></label><label>E-mail<input type="email" value={form.email} onChange={event => setForm({ ...form, email: event.target.value })} className="input" /></label><label>Data de nascimento<input type="date" value={form.birthDate} onChange={event => setForm({ ...form, birthDate: event.target.value })} className="input" /></label><label className="sm:col-span-2">Endereço<input value={form.address} onChange={event => setForm({ ...form, address: event.target.value })} className="input" /></label><button disabled={!form.time} className="sm:col-span-2 rounded-lg bg-vita-600 py-3 font-semibold text-white disabled:opacity-60">Confirmar agendamento</button></form>{message && <p className={`mt-4 rounded-lg p-3 ${message.startsWith('Erro:') ? 'bg-red-50 text-red-700' : 'bg-vita-50 text-vita-700'}`}>{message}</p>}</>}</div></main>
}

function Select({ label, value, set, items }: { label: string, value: string, set: (value: string) => void, items: { id: number, name: string }[] }) {
  return <label>{label}<select value={value} onChange={event => set(event.target.value)} className="input" required><option value="">Selecione</option>{items.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
}
