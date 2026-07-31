import { useEffect, useState, type CSSProperties, type FormEvent } from 'react'
import { useQuery } from '@tanstack/react-query'
import { CalendarCheck2 } from 'lucide-react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { callPublicBooking, fetchPublicBookingInfo, type PublicClinic, type PublicProfessional } from '../lib/publicBooking'

const today = new Date().toISOString().slice(0, 10)
const emptyForm = { professionalId: '', resourceId: '', time: '', name: '', phone: '', email: '', address: '', birthDate: '' }

type PublicBookingExperienceProps = {
  slug: string
  backHref?: string
  backLabel?: string
}

export function PublicBookingPage() {
  const { slug: routeSlug } = useParams()

  if (!routeSlug) return <PublicBookingSlugPrompt />

  return <PublicBookingExperience slug={routeSlug} />
}

export function PublicBookingExperience({ slug, backHref = '/', backLabel = 'Agenda Vita' }: PublicBookingExperienceProps) {
  const [date, setDate] = useState(today)
  const [form, setForm] = useState(emptyForm)
  const [message, setMessage] = useState('')

  const info = useQuery({
    queryKey: ['public-info', slug],
    enabled: Boolean(slug),
    queryFn: () => fetchPublicBookingInfo(slug),
  })

  useEffect(() => {
    const family = info.data?.clinic.google_font_family?.trim()
    if (!family) return

    const fontLink = document.createElement('link')
    fontLink.rel = 'stylesheet'
    fontLink.href = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(family).replace(/%20/g, '+')}:wght@400;500;600;700&display=swap`
    document.head.append(fontLink)

    return () => fontLink.remove()
  }, [info.data?.clinic.google_font_family])

  const slots = useQuery({
    queryKey: ['public-slots', slug, date, form.professionalId, form.resourceId],
    enabled: Boolean(slug && form.professionalId),
    queryFn: async () => ((await callPublicBooking<{ slots: string[] }>(slug, {
      action: 'slots',
      date,
      professionalId: +form.professionalId,
      resourceId: form.resourceId ? +form.resourceId : null,
    }))?.slots ?? []) as string[],
  })

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    try {
      await callPublicBooking(slug, {
        action: 'book',
        date,
        professionalId: +form.professionalId,
        resourceId: form.resourceId ? +form.resourceId : null,
        time: form.time,
        patient: form,
      })
      setMessage('Agendamento realizado com sucesso.')
      setForm(emptyForm)
      window.setTimeout(() => setMessage(''), 4000)
    } catch (error) {
      setMessage(`Erro: ${error instanceof Error ? error.message : 'Não foi possível agendar.'}`)
    }
  }

  const clinic = info.data?.clinic
  const fontName = clinic?.google_font_family?.trim() || clinic?.font_family || 'Inter'
  const themeStyle = clinic ? {
    '--color-vita-600': clinic.primary_color || '#0f766e',
    '--color-vita-700': clinic.secondary_color || '#0f5f59',
    backgroundColor: clinic.background_color || '#f8fafc',
    fontFamily: `${fontName}, Arial, sans-serif`,
  } as CSSProperties : undefined

  return <main className="mx-auto max-w-2xl p-5 py-10" style={themeStyle}>
    <Link to={backHref} className="text-sm text-vita-700">&larr; {backLabel}</Link>
    <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      {info.isLoading ? <p>Carregando...</p> : info.error || !clinic ? <p className="text-red-700">Clínica não encontrada ou indisponível.</p> : <>
        <div className="flex gap-3">
          <div className="grid size-12 place-items-center overflow-hidden rounded-xl bg-vita-50 text-vita-700">
            {clinic.logo_url ? <img src={clinic.logo_url} alt={`Logotipo de ${clinic.name}`} className="size-full object-cover" /> : <CalendarCheck2 />}
          </div>
          <div>
            <h1 className="text-2xl font-bold">{clinic.name}</h1>
            <p className="text-sm text-slate-600">{clinic.specialty}</p>
          </div>
        </div>

        <form onSubmit={submit} className="mt-6 grid gap-4 sm:grid-cols-2">
          <Select label="Profissional" value={form.professionalId} set={value => setForm({ ...form, professionalId: value, time: '' })} items={info.data?.professionals ?? []} />
          <label>
            Data
            <input type="date" min={today} value={date} onChange={event => { setDate(event.target.value); setForm({ ...form, time: '' }) }} className="input" />
          </label>
          <label>
            Horário
            <select value={form.time} onChange={event => setForm({ ...form, time: event.target.value })} className="input" required>
              <option value="">{slots.isLoading ? 'Buscando...' : 'Selecione'}</option>
              {(slots.data ?? []).map(time => <option key={time} value={time}>{time}</option>)}
            </select>
          </label>
          <label>
            Nome
            <input value={form.name} onChange={event => setForm({ ...form, name: event.target.value })} required className="input" />
          </label>
          <label>
            Telefone
            <input value={form.phone} onChange={event => setForm({ ...form, phone: event.target.value })} required className="input" />
          </label>
          <label>
            E-mail
            <input type="email" value={form.email} onChange={event => setForm({ ...form, email: event.target.value })} className="input" />
          </label>
          <label>
            Data de nascimento
            <input type="date" value={form.birthDate} onChange={event => setForm({ ...form, birthDate: event.target.value })} className="input" />
          </label>
          <label className="sm:col-span-2">
            Endereço
            <input value={form.address} onChange={event => setForm({ ...form, address: event.target.value })} className="input" />
          </label>
          <div className="sm:col-span-2">
            <button className="w-full rounded-lg bg-vita-600 px-4 py-3 font-semibold text-white hover:bg-vita-700">
              Confirmar agendamento
            </button>
          </div>
          {slots.error ? <p className="sm:col-span-2 text-sm text-red-700">Não foi possível carregar os horários disponíveis.</p> : null}
          {message ? <p className={`sm:col-span-2 rounded-lg p-3 text-sm ${message.startsWith('Erro:') ? 'bg-red-50 text-red-700' : 'bg-vita-50 text-vita-700'}`}>{message}</p> : null}
        </form>
      </>}
    </div>
  </main>
}

function PublicBookingSlugPrompt() {
  const navigate = useNavigate()
  const [slug, setSlug] = useState('')

  return <main className="mx-auto max-w-lg p-8">
    <h1 className="text-3xl font-bold">Agendar atendimento</h1>
    <p className="mt-2 text-slate-600">Informe o slug da clínica ou profissional.</p>
    <form onSubmit={event => {
      event.preventDefault()
      if (slug) navigate(`/agendar/${slug}`)
    }} className="mt-6 flex gap-2">
      <input value={slug} onChange={event => setSlug(event.target.value)} placeholder="ex.: clinica-centro" className="flex-1 rounded-lg border border-slate-300 px-3 py-2" />
      <button className="rounded-lg bg-vita-600 px-4 text-white">Continuar</button>
    </form>
  </main>
}

function Select({ label, value, set, items }: { label: string, value: string, set: (value: string) => void, items: PublicProfessional[] }) {
  return <label>
    {label}
    <select value={value} onChange={event => set(event.target.value)} className="input" required>
      <option value="">Selecione</option>
      {items.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
    </select>
  </label>
}
