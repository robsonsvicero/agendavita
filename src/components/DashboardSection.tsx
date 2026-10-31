import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  CalendarCheck2,
  CalendarDays,
  Clock,
  ExternalLink,
  Plus,
  Stethoscope,
  UserCheck,
  UsersRound,
} from 'lucide-react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { listProfessionals, type Professional } from '../lib/organizationTeam'

type DashboardAppointment = {
  id: number
  date: string
  time: string
  status: 'pending' | 'confirmed' | 'attended' | 'cancelled' | string
  duration_minutes: number
  specialty: string | null
  notes: string | null
  patient_id: number
  professional_id: number
  patients: { name: string; phone?: string | null } | null
  professionals: { name: string; specialty?: string | null } | null
}

const getTodayDate = () => {
  const d = new Date()
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

const formatTodayPortuguese = () => {
  try {
    return new Intl.DateTimeFormat('pt-BR', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    }).format(new Date())
  } catch {
    return 'Hoje'
  }
}

export function DashboardSection({
  clinicId,
  clinicSlug,
  organizationType = 'clinic',
}: {
  clinicId: number
  clinicSlug: string
  organizationType?: 'clinic' | 'professional'
}) {
  const today = useMemo(() => getTodayDate(), [])
  const todayFormatted = useMemo(() => formatTodayPortuguese(), [])

  // 1. Fetch today's appointments
  const { data: appointments = [], isLoading: loadingAppointments } = useQuery({
    queryKey: ['appointments', clinicId, today],
    queryFn: async () => {
      if (!supabase) throw new Error('Supabase não configurado')
      const { data, error } = await supabase
        .from('appointments')
        .select(
          'id, date, time, status, duration_minutes, specialty, notes, patient_id, professional_id, patients(name, phone), professionals(name, specialty)'
        )
        .eq('clinic_id', clinicId)
        .eq('date', today)
        .order('time')

      if (error) throw error

      return (data ?? []).map(item => ({
        ...item,
        patients: Array.isArray(item.patients) ? item.patients[0] ?? null : item.patients,
        professionals: Array.isArray(item.professionals) ? item.professionals[0] ?? null : item.professionals,
      })) as DashboardAppointment[]
    },
  })

  // 2. Fetch total patients count
  const { data: totalPatients = 0, isLoading: loadingPatients } = useQuery({
    queryKey: ['patients-count', clinicId],
    queryFn: async () => {
      if (!supabase) throw new Error('Supabase não configurado')
      const { count, error } = await supabase
        .from('patients')
        .select('id', { count: 'exact', head: true })
        .eq('clinic_id', clinicId)

      if (error) throw error
      return count ?? 0
    },
  })

  // 3. Fetch professionals list
  const { data: professionals = [], isLoading: loadingProfessionals } = useQuery({
    queryKey: ['professionals', clinicId],
    queryFn: () => listProfessionals(clinicId),
  })

  const activeProfessionals = useMemo(
    () => (professionals ?? []).filter(p => p.active),
    [professionals]
  )

  const activeAppointments = useMemo(
    () => appointments.filter(a => a.status !== 'cancelled'),
    [appointments]
  )

  const confirmedCount = useMemo(
    () => activeAppointments.filter(a => a.status === 'confirmed' || a.status === 'attended').length,
    [activeAppointments]
  )

  const pendingCount = useMemo(
    () => activeAppointments.filter(a => a.status === 'pending').length,
    [activeAppointments]
  )

  // Map appointments count by professional
  const professionalAppointmentsMap = useMemo(() => {
    const map = new Map<number, DashboardAppointment[]>()
    for (const app of activeAppointments) {
      const list = map.get(app.professional_id) ?? []
      list.push(app)
      map.set(app.professional_id, list)
    }
    return map
  }, [activeAppointments])

  return (
    <div className="space-y-8">
      {/* Top Banner / Welcome */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between rounded-2xl bg-white p-6 border border-slate-200/80 shadow-xs">
        <div>
          <span className="text-xs font-bold uppercase tracking-wider text-vita-700">
            Visão Geral
          </span>
          <h2 className="mt-1 text-2xl font-extrabold tracking-tight text-slate-900">
            Painel de Atendimentos
          </h2>
          <p className="mt-1 text-sm text-slate-500 capitalize">
            {todayFormatted} · Acompanhe o movimento e os agendamentos da sua organização.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Link
            to="/painel/agenda"
            className="inline-flex items-center gap-2 rounded-xl bg-vita-600 px-4 py-2.5 text-sm font-semibold text-white shadow-xs transition hover:bg-vita-700 active:scale-[0.98]"
          >
            <Plus size={16} />
            <span>Novo agendamento</span>
          </Link>
          <a
            href={`/#/agendar/${clinicSlug}`}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm font-semibold text-slate-700 shadow-xs transition hover:bg-slate-50 hover:text-slate-900"
            title="Abrir página pública de agendamento online"
          >
            <ExternalLink size={15} />
            <span className="hidden sm:inline">Página pública</span>
          </a>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {/* Card 1: Pacientes agendados hoje */}
        <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-xs flex flex-col justify-between">
          <div className="flex items-start justify-between">
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Atendimentos de hoje
              </span>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-3xl font-extrabold text-slate-900">
                  {loadingAppointments ? '—' : activeAppointments.length}
                </span>
                <span className="text-xs font-medium text-slate-500">pacientes</span>
              </div>
            </div>
            <div className="grid size-12 place-items-center rounded-xl bg-vita-50 text-vita-700 border border-vita-100">
              <CalendarCheck2 size={24} />
            </div>
          </div>

          <div className="mt-4 pt-4 border-t border-slate-100 flex items-center justify-between text-xs text-slate-600">
            <span>
              <strong>{confirmedCount}</strong> confirmados · <strong>{pendingCount}</strong> pendentes
            </span>
            <Link
              to="/painel/agenda"
              className="font-semibold text-vita-700 hover:text-vita-800 hover:underline"
            >
              Ver na agenda →
            </Link>
          </div>
        </div>

        {/* Card 2: Total de pacientes cadastrados */}
        <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-xs flex flex-col justify-between">
          <div className="flex items-start justify-between">
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Total de pacientes
              </span>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-3xl font-extrabold text-slate-900">
                  {loadingPatients ? '—' : totalPatients}
                </span>
                <span className="text-xs font-medium text-slate-500">cadastrados</span>
              </div>
            </div>
            <div className="grid size-12 place-items-center rounded-xl bg-sky-50 text-sky-700 border border-sky-100">
              <UsersRound size={24} />
            </div>
          </div>

          <div className="mt-4 pt-4 border-t border-slate-100 flex items-center justify-between text-xs text-slate-600">
            <span>Base ativa de prontuários</span>
            <Link
              to="/painel/pacientes"
              className="font-semibold text-sky-700 hover:text-sky-800 hover:underline"
            >
              Ver pacientes →
            </Link>
          </div>
        </div>

        {/* Card 3: Profissionais ativos */}
        <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-xs flex flex-col justify-between sm:col-span-2 lg:col-span-1">
          <div className="flex items-start justify-between">
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Equipe profissional
              </span>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-3xl font-extrabold text-slate-900">
                  {loadingProfessionals ? '—' : activeProfessionals.length}
                </span>
                <span className="text-xs font-medium text-slate-500">
                  {organizationType === 'professional' ? 'profissional ativo' : 'profissionais ativos'}
                </span>
              </div>
            </div>
            <div className="grid size-12 place-items-center rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-100">
              <Stethoscope size={24} />
            </div>
          </div>

          <div className="mt-4 pt-4 border-t border-slate-100 flex items-center justify-between text-xs text-slate-600">
            <span>Disponíveis para consultas</span>
            <Link
              to="/painel/equipe"
              className="font-semibold text-emerald-700 hover:text-emerald-800 hover:underline"
            >
              Gerenciar equipe →
            </Link>
          </div>
        </div>
      </div>

      {/* Cards de cada profissional cadastrado com número de pacientes no dia */}
      <div>
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h3 className="text-lg font-bold text-slate-900">
              Profissionais e atendimentos de hoje
            </h3>
            <p className="text-sm text-slate-500">
              Volume de pacientes e consultas agendadas para cada profissional nesta data.
            </p>
          </div>
        </div>

        {activeProfessionals.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center text-slate-500">
            <Stethoscope size={32} className="mx-auto text-slate-400 mb-2" />
            <p className="font-semibold text-slate-700">Nenhum profissional ativo cadastrado.</p>
            <p className="text-xs mt-1">Cadastre profissionais na aba Equipe e recursos para vincular atendimentos.</p>
            <Link
              to="/painel/equipe"
              className="mt-4 inline-flex items-center gap-2 rounded-lg bg-vita-600 px-4 py-2 text-xs font-semibold text-white shadow-xs hover:bg-vita-700"
            >
              <Plus size={14} /> Cadastrar profissional
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
            {activeProfessionals.map((prof: Professional) => {
              const profAppointments = professionalAppointmentsMap.get(prof.id) ?? []
              const count = profAppointments.length

              return (
                <div
                  key={prof.id}
                  className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs flex flex-col justify-between transition hover:border-slate-300 hover:shadow-sm"
                >
                  <div>
                    {/* Professional Header */}
                    <div className="flex items-center gap-3">
                      <div className="grid size-11 place-items-center rounded-xl bg-slate-100 text-slate-700">
                        <Stethoscope size={20} strokeWidth={2.1} aria-hidden="true" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <h4 className="font-bold text-slate-900 text-sm truncate">
                          {prof.name}
                        </h4>
                        <p className="text-xs text-slate-500 truncate">
                          {prof.specialty || 'Atendimento geral'}
                        </p>
                      </div>
                    </div>

                    {/* Patient count highlight */}
                    <div className="mt-5 rounded-xl bg-slate-50 p-4 border border-slate-100">
                      <div className="flex items-baseline justify-between">
                        <span className="text-xs font-medium text-slate-500">Agendados hoje:</span>
                        <div className="flex items-baseline gap-1.5">
                          <span
                            className={`text-2xl font-black ${
                              count > 0 ? 'text-vita-700' : 'text-slate-400'
                            }`}
                          >
                            {count}
                          </span>
                          <span className="text-xs font-medium text-slate-500">
                            {count === 1 ? 'paciente' : 'pacientes'}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Mini timeline preview of today's appointments for this professional */}
                    <div className="mt-4 space-y-2">
                      <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                        Próximos horários:
                      </span>
                      {count === 0 ? (
                        <p className="text-xs text-slate-400 py-1">
                          Nenhum paciente agendado para hoje.
                        </p>
                      ) : (
                        <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
                          {profAppointments.slice(0, 4).map(app => (
                            <div
                              key={app.id}
                              className="flex items-center justify-between text-xs bg-slate-50/80 rounded-lg px-2.5 py-1.5 border border-slate-100"
                            >
                              <div className="flex items-center gap-2 truncate">
                                <span className="font-mono font-semibold text-slate-800">
                                  {app.time.slice(0, 5)}
                                </span>
                                <span className="text-slate-600 truncate">
                                  {app.patients?.name || 'Paciente'}
                                </span>
                              </div>
                              <span
                                className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${
                                  app.status === 'confirmed'
                                    ? 'bg-emerald-50 text-emerald-700'
                                    : app.status === 'attended'
                                    ? 'bg-blue-50 text-blue-700'
                                    : 'bg-amber-50 text-amber-700'
                                }`}
                              >
                                {app.status === 'confirmed'
                                  ? 'Confirmado'
                                  : app.status === 'attended'
                                  ? 'Atendido'
                                  : 'Pendente'}
                              </span>
                            </div>
                          ))}
                          {count > 4 && (
                            <p className="text-[11px] text-center text-slate-400 pt-0.5">
                              + {count - 4} outros atendimentos
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Card Footer */}
                  <div className="mt-5 pt-3 border-t border-slate-100">
                    <Link
                      to="/painel/agenda"
                      className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white py-2 text-xs font-semibold text-slate-700 shadow-2xs transition hover:bg-slate-50 hover:text-slate-900"
                    >
                      <CalendarDays size={14} className="text-slate-500" />
                      <span>Ver agenda deste profissional</span>
                    </Link>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Lista rápida de todos os atendimentos do dia */}
      <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-xs">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between mb-5">
          <div>
            <h3 className="text-lg font-bold text-slate-900">Cronograma de hoje</h3>
            <p className="text-sm text-slate-500">
              Lista sequencial de todos os pacientes agendados para este dia.
            </p>
          </div>
          <Link
            to="/painel/agenda"
            className="text-xs font-bold text-vita-700 hover:text-vita-800 hover:underline"
          >
            Abrir gerenciador completo da agenda →
          </Link>
        </div>

        {activeAppointments.length === 0 ? (
          <div className="py-10 text-center text-slate-400">
            <Clock size={36} className="mx-auto mb-2 text-slate-300" />
            <p className="text-sm font-semibold text-slate-600">
              Nenhum agendamento marcado para hoje.
            </p>
            <p className="text-xs text-slate-500 mt-1">
              Os horários marcados via formulário público ou cadastrados manualmente aparecerão aqui.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-xs font-bold uppercase tracking-wider text-slate-500">
                  <th className="pb-3">Horário</th>
                  <th className="pb-3">Paciente</th>
                  <th className="pb-3">Profissional</th>
                  <th className="pb-3">Especialidade / Detalhes</th>
                  <th className="pb-3 text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {activeAppointments.map(app => (
                  <tr key={app.id} className="hover:bg-slate-50/70 transition">
                    <td className="py-3 font-mono font-bold text-slate-900">
                      {app.time.slice(0, 5)}
                    </td>
                    <td className="py-3 font-semibold text-slate-800">
                      {app.patients?.name || 'Paciente sem nome'}
                    </td>
                    <td className="py-3 text-slate-600">
                      {app.professionals?.name || 'Profissional'}
                    </td>
                    <td className="py-3 text-xs text-slate-500">
                      {app.specialty || app.notes || 'Consulta padrão'}
                    </td>
                    <td className="py-3 text-right">
                      <span
                        className={`inline-block text-xs font-semibold px-2.5 py-1 rounded-md ${
                          app.status === 'confirmed'
                            ? 'bg-emerald-50 text-emerald-700'
                            : app.status === 'attended'
                            ? 'bg-blue-50 text-blue-700'
                            : 'bg-amber-50 text-amber-700'
                        }`}
                      >
                        {app.status === 'confirmed'
                          ? 'Confirmado'
                          : app.status === 'attended'
                          ? 'Atendido'
                          : 'Pendente'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

