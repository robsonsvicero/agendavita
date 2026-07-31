import { ArrowRight, CalendarCheck2, LockKeyhole, UsersRound } from 'lucide-react'
import { Link } from 'react-router-dom'

export function PublicBookingPage() {
  return <main className="mx-auto max-w-6xl px-5 py-14 sm:py-24">
    <div className="max-w-3xl"><span className="rounded-full bg-vita-50 px-3 py-1 text-sm font-semibold text-vita-700">Agenda Vita</span>
      <h1 className="mt-5 text-4xl font-bold tracking-tight text-slate-950 sm:text-6xl">Agendamentos que respeitam a rotina da sua clínica.</h1>
      <p className="mt-6 text-lg leading-8 text-slate-600">Uma base segura para clínicas e profissionais organizarem pacientes, agenda e atendimentos.</p>
      <Link to="/entrar" className="mt-8 inline-flex items-center gap-2 rounded-xl bg-vita-600 px-5 py-3 font-semibold text-white hover:bg-vita-700">Acessar painel <ArrowRight size={18} /></Link>
    </div>
    <div className="mt-14 grid gap-5 md:grid-cols-3">
      <Feature icon={<CalendarCheck2 />} title="Agenda inteligente" text="Horários calculados por profissional, duração e intervalo." />
      <Feature icon={<UsersRound />} title="Equipe e recursos" text="Profissionais, salas e cadeiras no mesmo fluxo." />
      <Feature icon={<LockKeyhole />} title="Dados protegidos" text="Cada organização acessa exclusivamente seus dados." />
    </div>
  </main>
}

function Feature({ icon, title, text }: { icon: React.ReactNode, title: string, text: string }) {
  return <article className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"><div className="text-vita-600">{icon}</div><h2 className="mt-4 font-bold">{title}</h2><p className="mt-2 text-sm leading-6 text-slate-600">{text}</p></article>
}
