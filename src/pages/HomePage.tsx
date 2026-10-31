import { CalendarDays, Clock, Globe, LogIn } from 'lucide-react'
import { Link } from 'react-router-dom'
import heroImage from '../../assets/hero_image.jpg'
import { useAuth } from '../providers/AuthProvider'

const platformAdminEmail = 'robsonsvicero@outlook.com'

export function HomePage() {
  const { user } = useAuth()
  const dashboardPath = user?.email?.toLowerCase() === platformAdminEmail ? '/admin-geral' : '/painel'

  return (
    <div className="min-h-screen bg-white text-slate-900 antialiased flex flex-col justify-between">
      {/* Top Header */}
      <header className="border-b border-slate-100 bg-white sticky top-0 z-20">
        <div className="mx-auto flex h-20 max-w-6xl items-center justify-between px-6 sm:px-8">
          <Link
            to="/"
            className="flex items-center gap-2.5 transition opacity-95 hover:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-vita-600 rounded-lg"
          >
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-vita-50 text-vita-700">
              <CalendarDays size={20} className="stroke-[2.2]" />
            </div>
            <div className="flex items-baseline gap-1.5">
              <span className="text-xl font-bold tracking-tight text-slate-900">Agenda Vita</span>
              <span className="text-[11px] font-semibold tracking-wider text-slate-400 uppercase">Gestão</span>
            </div>
          </Link>

          <Link
            to={user ? dashboardPath : '/entrar'}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-xs transition hover:bg-slate-50 hover:text-slate-900 hover:border-slate-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-vita-600 active:scale-[0.98]"
          >
            <LogIn size={15} className="text-slate-500" />
            <span>{user ? 'Acessar painel' : 'Entrar'}</span>
          </Link>
        </div>
      </header>

      <main className="flex-1">
        {/* Hero Section */}
        <section className="mx-auto max-w-6xl px-6 sm:px-8 pt-12 pb-20 lg:pt-18 lg:pb-24">
          <div className="grid grid-cols-1 items-center gap-12 lg:grid-cols-12 lg:gap-14">
            {/* Left Content */}
            <div className="lg:col-span-7">
              <span className="inline-block text-xs font-bold uppercase tracking-wider text-vita-700">
                Gestão para profissionais
              </span>

              <h1 className="mt-4 text-4xl font-extrabold tracking-tight text-slate-900 sm:text-5xl sm:leading-[1.14]" style={{ textWrap: 'balance' }}>
                Sua rotina de consultas, sem ficar espalhada.
              </h1>

              <div className="mt-6 space-y-4 text-base leading-relaxed text-slate-600" style={{ textWrap: 'pretty' }}>
                <p>
                  Horários, informações de pacientes e confirmações de consultas podem acabar
                  distribuídos entre mensagens, planilhas e anotações. O Agenda Vita ajuda
                  clínicas e profissionais independentes a organizar a rotina profissional em um só lugar.
                </p>
                <p>
                  Mais clareza sobre o trabalho administrativo e mais espaço para atender,
                  acompanhar e cuidar dos pacientes.
                </p>
              </div>

              <div className="mt-8">
                <Link
                  to={user ? dashboardPath : '/entrar'}
                  className="inline-flex items-center gap-2.5 rounded-xl bg-vita-600 px-6 py-3 text-base font-semibold text-white shadow-xs transition hover:bg-vita-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-vita-600 active:scale-[0.98]"
                >
                  <LogIn size={18} />
                  <span>{user ? 'Acessar meu painel' : 'Acessar o sistema'}</span>
                </Link>
                <p className="mt-3 text-xs text-slate-500">
                  Acesso seguro para clínicas, consultórios e profissionais credenciados.
                </p>
              </div>
            </div>

            {/* Right Card (Visual card with background image) */}
            <div className="lg:col-span-5 flex justify-center lg:justify-end">
              <div className="relative w-full max-w-md overflow-hidden rounded-3xl border border-slate-200/80 shadow-md min-h-[360px] flex flex-col justify-end p-8 sm:p-10">
                <img
                  src={heroImage}
                  alt="Rotina de atendimentos organizada"
                  className="absolute inset-0 size-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-slate-950/75 via-slate-950/20 to-slate-900/10" />

                <div className="relative z-10">
                  <div className="inline-flex items-center gap-2 rounded-xl bg-white/15 px-3 py-1.5 text-xs font-semibold tracking-wide backdrop-blur-md text-vita-50 border border-white/20 mb-3">
                    <CalendarDays size={16} />
                    <span>Agenda Vita · Gestão</span>
                  </div>
                  <h3 className="text-xl font-bold leading-snug text-white">
                    Rotina organizada em um só lugar
                  </h3>
                  <p className="mt-2 text-xs leading-relaxed text-slate-200">
                    Mais tempo para atender seus pacientes e total clareza para administrar.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* 3 Pillars / Feature Columns */}
        <section className="border-t border-slate-100 bg-white">
          <div className="mx-auto max-w-6xl px-6 sm:px-8 py-16 sm:py-20">
            <div className="grid grid-cols-1 gap-10 md:grid-cols-3 md:gap-8 lg:gap-12">
              {/* Feature 1 */}
              <div className="flex flex-col">
                <div className="text-vita-700 mb-4">
                  <CalendarDays size={24} className="stroke-[2.2]" />
                </div>
                <h2 className="text-lg font-bold text-slate-900">Agenda organizada</h2>
                <p className="mt-2 text-sm leading-relaxed text-slate-600">
                  Planeje consultas, horários e compromissos em um só lugar com visualização
                  clara de dias e semanas.
                </p>
              </div>

              {/* Feature 2 */}
              <div className="flex flex-col md:border-l md:border-slate-200 md:pl-8 lg:pl-10">
                <div className="text-vita-700 mb-4">
                  <Globe size={24} className="stroke-[2.2]" />
                </div>
                <h2 className="text-lg font-bold text-slate-900">Agendamento online e API</h2>
                <p className="mt-2 text-sm leading-relaxed text-slate-600">
                  Conecte o fluxo de agendamento diretamente ao seu site ou utilize a página exclusiva
                  para seus pacientes.
                </p>
              </div>

              {/* Feature 3 */}
              <div className="flex flex-col md:border-l md:border-slate-200 md:pl-8 lg:pl-10">
                <div className="text-vita-700 mb-4">
                  <Clock size={24} className="stroke-[2.2]" />
                </div>
                <h2 className="text-lg font-bold text-slate-900">Rotina mais simples</h2>
                <p className="mt-2 text-sm leading-relaxed text-slate-600">
                  Reduza tarefas manuais, evite conflitos de horário e mantenha as informações
                  da sua clínica sempre acessíveis.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Callout Section (Without pricing) */}
        <section className="border-t border-slate-100 bg-vita-50 py-16 sm:py-20">
          <div className="mx-auto max-w-6xl px-6 sm:px-8">
            <div className="max-w-3xl">
              <span className="text-xs font-bold uppercase tracking-wider text-vita-700">
                Acesso à plataforma
              </span>
              <h2 className="mt-3 text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl">
                Uma rotina profissional mais organizada
              </h2>
              <div className="mt-4 space-y-3 text-base leading-relaxed text-slate-600">
                <p>
                  Use o Agenda Vita para apoiar a organização de horários, profissionais e informações
                  de atendimento da sua clí­nica ou consultório.
                </p>
                <p>
                  Centralize a recepção, acompanhe as marcações em tempo real e ofereça aos seus pacientes
                  uma experiência de agendamento ágil e pontual.
                </p>
              </div>
              <div className="mt-8">
                <Link
                  to={user ? dashboardPath : '/entrar'}
                  className="inline-flex items-center gap-2 rounded-xl bg-vita-600 px-6 py-3 text-sm font-semibold text-white shadow-xs transition hover:bg-vita-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-vita-600 active:scale-[0.98]"
                >
                  <LogIn size={16} />
                  <span>{user ? 'Entrar no painel' : 'Fazer login da organização'}</span>
                </Link>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-200 bg-white py-8 text-center text-xs text-slate-500">
        <div className="mx-auto max-w-6xl px-6 sm:px-8">
          <p>Agenda Vita Gestão · Plataforma de organização profissional</p>
        </div>
      </footer>
    </div>
  )
}



