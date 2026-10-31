import { useEffect, useState, type CSSProperties, type FormEvent } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ArrowRight, CalendarCheck2, CheckCircle2, Clock3 } from 'lucide-react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { callPublicBooking, fetchPublicBookingInfo, type PublicClinic, type PublicProfessional } from '../lib/publicBooking'

const today = new Date().toISOString().slice(0, 10)
const emptyForm = { professionalId: '', resourceId: '', time: '', specialty: '', notes: '', name: '', phone: '', email: '', address: '', birthDate: '' }

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

  const professionals = info.data?.professionals ?? []

  // Quando houver apenas um profissional cadastrado e ativo, seleciona-o automaticamente
  useEffect(() => {
    if (professionals.length === 1) {
      const soleProfessional = professionals[0]
      setForm(prev => {
        if (prev.professionalId === String(soleProfessional.id)) return prev
        return {
          ...prev,
          professionalId: String(soleProfessional.id),
          specialty: soleProfessional.specialty || prev.specialty,
        }
      })
    }
  }, [professionals])

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
        specialty: form.specialty || undefined,
        notes: form.notes || undefined,
        patient: {
          name: form.name,
          phone: form.phone,
          email: form.email,
          address: form.address,
          birthDate: form.birthDate,
        },
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
    '--booking-primary': clinic.primary_color || '#0f766e',
    '--booking-secondary': clinic.secondary_color || '#0f5f59',
    backgroundColor: clinic.background_color || '#f8fafc',
    fontFamily: `${fontName}, Arial, sans-serif`,
  } as CSSProperties : undefined
  const selectedProfessional = professionals.find(person => String(person.id) === form.professionalId)
  const specialties = [...new Set(professionals.map(person => person.specialty?.trim()).filter((value): value is string => Boolean(value)))]

  return <main className="min-h-screen p-3 sm:p-6 lg:p-8" style={themeStyle}>
    <div className="mx-auto max-w-6xl">
      <Link to={backHref} className="mb-3 inline-flex text-sm font-medium text-vita-700">&larr; {backLabel}</Link>
      <div className="grid overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-xl lg:min-h-[780px] lg:grid-cols-[minmax(300px,0.82fr)_minmax(0,1.18fr)]">
        {info.isLoading ? <p className="p-8">Carregando...</p> : info.error || !clinic ? <p className="p-8 text-red-700">Clínica não encontrada ou indisponível.</p> : <>
          <aside className="flex flex-col justify-between p-7 text-white sm:p-10 lg:p-12" style={{ backgroundColor: 'color-mix(in srgb, var(--booking-secondary) 82%, #111827)' }}>
            <div>
              <div className="flex items-center gap-3">
                <div className="grid size-11 shrink-0 place-items-center overflow-hidden rounded-xl bg-white/15 text-white ring-1 ring-white/20">
                  {clinic.logo_url ? <img src={clinic.logo_url} alt={`Logotipo de ${clinic.name}`} className="size-full object-cover" /> : <CalendarCheck2 size={21} />}
                </div>
                <div className="min-w-0"><p className="truncate text-sm font-semibold">{clinic.name}</p>{clinic.specialty && <p className="truncate text-xs text-white/65">{clinic.specialty}</p>}</div>
              </div>
              <p className="mt-12 text-[11px] font-bold uppercase tracking-[0.18em] text-white/70">Agendamento fácil</p>
              <h1 className="mt-5 max-w-md font-heading text-3xl leading-tight sm:text-4xl">Agende sua consulta</h1>
              <p className="mt-6 max-w-sm text-sm leading-relaxed text-white/65">Selecione o profissional e o melhor horário. Nossa equipe responderá para confirmar o seu atendimento.</p>
              <ul className="mt-10 space-y-4 text-sm text-white/75">{['Confirmação rápida do agendamento', 'Atendimento organizado para você', 'Escolha o melhor horário disponível'].map(item => <li key={item} className="flex items-center gap-3"><CheckCircle2 size={19} className="shrink-0" style={{ '--color-vita-600': 'var(--vita-brand-600)' } as CSSProperties} stroke="var(--color-vita-600)" aria-hidden="true" /><span>{item}</span></li>)}</ul>
            </div>
            {clinic.phone?.trim() && <div className="mt-12 border-t border-white/15 pt-7">
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-white/45">Contato direto / dúvidas</p>
              <a href={`https://wa.me/${clinic.phone.replace(/\D/g, '')}`} target="_blank" rel="noreferrer" className="mt-3 inline-flex items-center gap-2 text-sm font-medium text-white hover:text-vita-600">{clinic.phone}<span className="size-2 rounded-full bg-vita-600" />Online</a>
            </div>}
          </aside>

          <form onSubmit={submit} className="grid content-start gap-x-3.5 gap-y-4 p-6 sm:grid-cols-2 sm:gap-x-4 sm:gap-y-5 sm:p-8 lg:p-12">
            <label className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Seu nome completo<input value={form.name} onChange={event => setForm({ ...form, name: event.target.value })} placeholder="Ex.: Carolina Silva" required className="input mt-1.5 !text-sm !font-normal !normal-case !tracking-normal" /></label>
            <label className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">WhatsApp de contato<input type="tel" value={form.phone} onChange={event => setForm({ ...form, phone: event.target.value })} placeholder="(11) 90000-0000" required className="input mt-1.5 !text-sm !font-normal !normal-case !tracking-normal" /></label>
            <label className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">E-mail<input type="email" value={form.email} onChange={event => setForm({ ...form, email: event.target.value })} placeholder="seu@email.com" className="input mt-1.5 !text-sm !font-normal !normal-case !tracking-normal" /></label>
            <label className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Data de nascimento<input type="date" value={form.birthDate} onChange={event => setForm({ ...form, birthDate: event.target.value })} className="input mt-1.5 !text-sm !font-normal !normal-case !tracking-normal" /></label>
            <label className="sm:col-span-2 text-[10px] font-semibold uppercase tracking-wide text-slate-500">Endereço <span className="font-normal normal-case tracking-normal text-slate-400">(opcional)</span><input value={form.address} onChange={event => setForm({ ...form, address: event.target.value })} placeholder="Rua, número, bairro e cidade" className="input mt-1.5 !text-sm !font-normal !normal-case !tracking-normal" /></label>
            {professionals.length === 1 ? <label className="sm:col-span-2 text-[10px] font-semibold uppercase tracking-wide text-slate-500">Profissional<input type="text" readOnly value={professionals[0].name} className="input mt-1.5 cursor-default !text-sm !font-normal !normal-case !tracking-normal" /></label> : <div className="sm:col-span-2 text-[10px] font-semibold uppercase tracking-wide text-slate-500"><Select label="Profissional" value={form.professionalId} set={value => { const selectedProf = professionals.find(p => String(p.id) === value); setForm({ ...form, professionalId: value, time: '', specialty: selectedProf?.specialty || form.specialty }) }} items={professionals} /></div>}
            <section className="sm:col-span-2">
              <h2 className="text-[10px] font-semibold font-sans uppercase tracking-wide text-slate-500">Especialidade</h2>
              {specialties.length ? <div className="mt-2 flex flex-wrap gap-2">{specialties.map(specialty => <button key={specialty} type="button" onClick={() => setForm({ ...form, specialty })} className={`rounded-xl border px-4 py-2 text-xs font-medium transition-colors ${form.specialty === specialty ? 'border-vita-600 bg-vita-600 text-white' : 'border-slate-200 bg-white text-slate-600 hover:border-vita-600 hover:text-vita-700'}`}>{specialty}</button>)}</div> : <input placeholder="Ex.: Ortodontia" value={form.specialty} onChange={event => setForm({ ...form, specialty: event.target.value })} className="input mt-1.5 !text-sm !font-normal !normal-case !tracking-normal" />}
              {selectedProfessional?.name && <span className="mt-1 block text-[10px] text-slate-400">Agendamento para {selectedProfessional.name}</span>}
            </section>
            <section className="sm:col-span-2" aria-labelledby="booking-time-heading">
              <h2 id="booking-time-heading" className="mb-2 text-[12px] font-semibold font-sans uppercase tracking-wide text-slate-600">1. Preferência de horário</h2>
              <label className="block max-w-[220px] text-[10px] font-medium uppercase tracking-wide text-slate-500">Selecione a data<input type="date" min={today} value={date} onChange={event => { setDate(event.target.value); setForm({ ...form, time: '' }) }} className="input mt-1.5 !text-sm !font-normal !normal-case !tracking-normal" /></label>
              {slots.isLoading ? <p className="mt-2 text-xs text-slate-500">Buscando horários disponíveis…</p> : (slots.data ?? []).length === 0 ? <p className="mt-2 text-xs text-slate-500">{form.professionalId ? 'Nenhum horário disponível para a data selecionada.' : 'Selecione um profissional para ver os horários.'}</p> : <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">{(slots.data ?? []).map(time => <button key={time} type="button" onClick={() => setForm({ ...form, time })} className={`rounded-xl border px-2 py-2 text-xs font-medium transition-colors ${form.time === time ? 'border-vita-600 bg-vita-600 text-white' : 'border-slate-200 bg-white text-slate-600 hover:border-vita-600 hover:text-vita-700'}`}>{time}</button>)}</div>}
              {slots.error && <p className="mt-2 text-xs text-red-700">Não foi possível carregar os horários disponíveis.</p>}
            </section>
            <label className="sm:col-span-2 text-[12px] font-semibold uppercase tracking-wide text-slate-500">2. Observações ou queixa principal <span className="font-normal text-slate-400">(opcional)</span><textarea rows={2} placeholder="Conte brevemente como podemos ajudar" value={form.notes} onChange={event => setForm({ ...form, notes: event.target.value })} className="input mt-1.5 resize-y !text-sm !font-normal !normal-case !tracking-normal" /></label>
            <div className="sm:col-span-2"><button disabled={!form.time} className="flex w-full items-center justify-center gap-2 rounded-xl bg-vita-600 px-4 py-3.5 text-sm font-semibold text-white shadow-sm transition hover:bg-vita-700 disabled:cursor-not-allowed disabled:opacity-50">Agendar <ArrowRight size={16} /></button>{!form.time && <p className="mt-2 text-center text-[10px] text-slate-400"><Clock3 size={12} className="mr-1 inline" />Selecione um horário para continuar</p>}<p className="mt-3 text-center text-[10px] text-slate-400">Seus dados serão tratados com confidencialidade profissional.</p></div>
            {message && <p className={`sm:col-span-2 rounded-lg p-3 text-sm ${message.startsWith('Erro:') ? 'bg-red-50 text-red-700' : 'bg-vita-50 text-vita-700'}`}>{message}</p>}
          </form>
        </>}
      </div>
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
  return <label className="block text-[10px] font-semibold uppercase tracking-wide text-slate-500">
    {label}
    <select value={value} onChange={event => set(event.target.value)} className="input mt-1.5 !text-sm !font-normal !normal-case !tracking-normal" required>
      <option value="">Selecione</option>
      {items.map(item => (
        <option key={item.id} value={item.id}>
          {item.name}{item.specialty ? ` — ${item.specialty}` : ''}
        </option>
      ))}
    </select>
  </label>
}
