import { useMemo, useState, type FormEvent } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { CalendarPlus, Check, Clock, Pencil, Users, X } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { listPatients, type Patient } from '../lib/patients'
import { listProfessionals, listResources, type Professional, type ClinicalResource } from '../lib/organizationTeam'
import { listAppointmentTypes, listWorkingHours } from '../lib/scheduleSettings'

type Appointment = { id:number; date:string; time:string; status:string; duration_minutes:number; patient_id:number; professional_id:number; resource_id:number|null; patients:{name:string}|null; professionals:{name:string}|null; clinical_resources:{name:string}|null }
const today = new Date().toISOString().slice(0,10)
const toMinutes = (time: string) => { const [h, m] = time.slice(0, 5).split(':').map(Number); return h * 60 + m }
const fromMinutes = (m: number) => `${String(Math.floor(m / 60)).padStart(2,'0')}:${String(m % 60).padStart(2,'0')}`

type TimelineSlot = { time: string; type: 'free' | 'booked'; appointment?: Appointment }

export function AgendaSection({ clinicId, enabled, organizationType = 'professional' }: { clinicId:number; enabled:boolean; organizationType?: 'clinic' | 'professional' }) {
  const client=useQueryClient()
  const [date,setDate]=useState(today)
  const [form,setForm]=useState({patientId:'',professionalId:'',resourceId:'',time:''})
  const [editingId,setEditingId]=useState<number|null>(null)
  const [notice,setNotice]=useState('')
  const [activeTab,setActiveTab]=useState<number|null>(null) // null = "Todos"

  const patients=useQuery({queryKey:['patients',clinicId],queryFn:()=>listPatients(clinicId),enabled})
  const professionals=useQuery({queryKey:['professionals',clinicId],queryFn:()=>listProfessionals(clinicId),enabled})
  const resources=useQuery({queryKey:['resources',clinicId],queryFn:()=>listResources(clinicId),enabled})

  const activeProfessionals = useMemo(() => (professionals.data ?? []).filter(x => x.active), [professionals.data])
  const isClinic = organizationType === 'clinic'

  // Fetch schedule config for timeline
  const appointmentTypes = useQuery({ queryKey: ['appointment-types', clinicId], queryFn: () => listAppointmentTypes(clinicId), enabled })
  const workingHours = useQuery({ queryKey: ['working-hours', clinicId], queryFn: () => listWorkingHours(clinicId), enabled })

  const invoke=async(body:Record<string,unknown>)=>{if(!supabase)throw new Error('Configure o Supabase.');const {data,error}=await supabase.functions.invoke('organization-appointments',{body:{clinicId,...body}});if(error){const r=(error as {context?:Response}).context;const d=r instanceof Response?await r.json().catch(()=>null) as {error?:string}|null:null;throw new Error(d?.error??error.message)}if(data?.error)throw new Error(data.error);return data}

  const appointments=useQuery({queryKey:['appointments',clinicId,date],enabled,queryFn:async()=>{if(!supabase)throw new Error('Configure o Supabase.');const {data,error}=await supabase.from('appointments').select('id,date,time,status,duration_minutes,patient_id,professional_id,resource_id,patients(name),professionals(name),clinical_resources(name)').eq('clinic_id',clinicId).eq('date',date).order('time');if(error)throw error;return (data??[]).map(i=>({...i,patients:Array.isArray(i.patients)?i.patients[0]??null:i.patients,professionals:Array.isArray(i.professionals)?i.professionals[0]??null:i.professionals,clinical_resources:Array.isArray(i.clinical_resources)?i.clinical_resources[0]??null:i.clinical_resources})) as Appointment[]}})

  const filteredAppointments = useMemo(() => {
    const all = (appointments.data ?? []).filter(a => a.status !== 'cancelled')
    if (!isClinic || activeTab === null) return all
    return all.filter(a => a.professional_id === activeTab)
  }, [appointments.data, isClinic, activeTab])

  const appointmentCounts = useMemo(() => {
    const all = (appointments.data ?? []).filter(a => a.status !== 'cancelled')
    const counts = new Map<number, number>()
    all.forEach(a => counts.set(a.professional_id, (counts.get(a.professional_id) ?? 0) + 1))
    return counts
  }, [appointments.data])

  // Build timeline slots for the selected professional
  const timelineSlots = useMemo((): TimelineSlot[] => {
    if (activeTab === null) return []
    const profId = activeTab
    const setting = (appointmentTypes.data ?? []).find(t => t.professional_id === profId && t.active)
    if (!setting) return []

    const weekday = new Date(`${date}T12:00:00`).getDay()
    const allRules = workingHours.data ?? []
    const specificRules = allRules.filter(r => r.weekday === weekday && r.professional_id === profId)
    const applicable = specificRules.length > 0 ? specificRules : allRules.filter(r => r.weekday === weekday && r.professional_id === null)
    if (applicable.length === 0) return []

    const profAppointments = (appointments.data ?? []).filter(a => a.professional_id === profId && a.status !== 'cancelled')
    const step = setting.duration_minutes + setting.interval_minutes
    const slots: TimelineSlot[] = []

    for (const rule of applicable) {
      const ruleStart = toMinutes(rule.start_time)
      const ruleEnd = toMinutes(rule.end_time)
      for (let start = ruleStart; start + step <= ruleEnd; start += step) {
        const time = fromMinutes(start)
        const exactMatch = profAppointments.find(a => a.time.slice(0, 5) === time)
        if (exactMatch) {
          slots.push({ time, type: 'booked', appointment: exactMatch })
        } else {
          slots.push({ time, type: 'free' })
        }
      }
    }

    // Also add any appointments that don't match a generated slot (edge cases / manual overrides)
    for (const a of profAppointments) {
      const t = a.time.slice(0, 5)
      if (!slots.some(s => s.time === t)) {
        slots.push({ time: t, type: 'booked', appointment: a })
      }
    }

    return slots.sort((a, b) => a.time.localeCompare(b.time))
  }, [activeTab, date, appointmentTypes.data, workingHours.data, appointments.data])

  // Compute free/total counts for the selected professional
  const timelineSummary = useMemo(() => {
    if (timelineSlots.length === 0) return null
    const free = timelineSlots.filter(s => s.type === 'free').length
    const booked = timelineSlots.filter(s => s.type === 'booked').length
    return { free, booked, total: free + booked }
  }, [timelineSlots])

  const slots=useQuery({queryKey:['slots',clinicId,date,form.professionalId,form.resourceId,editingId],enabled:enabled&&Boolean(form.professionalId),queryFn:async()=>((await invoke({action:'available-slots',professionalId:+form.professionalId,resourceId:form.resourceId?+form.resourceId:null,date,excludeId:editingId}))?.slots??[]) as string[]})
  const save=useMutation({mutationFn:()=>invoke({action:editingId?'reschedule':'create',id:editingId,patientId:+form.patientId,professionalId:+form.professionalId,resourceId:form.resourceId?+form.resourceId:null,date,time:form.time}),onSuccess:()=>{setForm({patientId:'',professionalId:activeTab !== null ? String(activeTab) : '',resourceId:'',time:''});setEditingId(null);setNotice('Agendamento salvo.');client.invalidateQueries({queryKey:['appointments',clinicId,date]});client.invalidateQueries({queryKey:['slots']})},onError:(e:Error)=>setNotice(`Erro: ${friendly(e.message)}`)})
  const statusMutation=useMutation({mutationFn:({id,value}:{id:number;value:string})=>invoke({action:'set-status',id,status:value}),onSuccess:()=>client.invalidateQueries({queryKey:['appointments',clinicId,date]}),onError:(e:Error)=>setNotice(`Erro: ${friendly(e.message)}`)})

  if(!enabled)return null

  const submit=(e:FormEvent)=>{e.preventDefault();setNotice('');save.mutate()}

  const startEdit=(a:Appointment)=>{setEditingId(a.id);setForm({patientId:String(a.patient_id),professionalId:String(a.professional_id),resourceId:a.resource_id?String(a.resource_id):'',time:a.time.slice(0,5)});setNotice('Edite os dados e salve o reagendamento.');window.scrollTo({top:0,behavior:'smooth'})}

  const handleTabChange = (profId: number | null) => {
    setActiveTab(profId)
    if (profId !== null) {
      setForm(f => ({ ...f, professionalId: String(profId), time: '' }))
    } else {
      setForm(f => ({ ...f, professionalId: '', time: '' }))
    }
    setEditingId(null)
    setNotice('')
  }

  const totalActive = (appointments.data ?? []).filter(a => a.status !== 'cancelled').length

  const statusLabel = (s: string) => ({ pending: 'Pendente', confirmed: 'Confirmado', attended: 'Atendido', cancelled: 'Cancelado' }[s] ?? s)
  const statusColor = (s: string) => ({ pending: 'bg-amber-100 text-amber-800', confirmed: 'bg-emerald-100 text-emerald-800', attended: 'bg-slate-100 text-slate-500' }[s] ?? 'bg-slate-100 text-slate-600')

  return <section className="mt-8 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
    {/* Header */}
    <div className="flex flex-col gap-4 sm:flex-row sm:justify-between sm:items-start">
      <div>
        <h2 className="font-bold">Agenda</h2>
        <p className="mt-1 text-sm text-slate-600">Crie, confirme e reagende atendimentos.</p>
      </div>
      <label className="text-sm font-medium">Data <input type="date" value={date} onChange={e=>{setDate(e.target.value);setForm({...form,time:''})}} className="rounded-lg border border-slate-300 px-3 py-2"/></label>
    </div>

    {/* Professional Tabs — only for clinics */}
    {isClinic && activeProfessionals.length > 0 && (
      <div className="mt-5">
        <div className="flex items-center gap-2 overflow-x-auto pb-1" role="tablist">
          <button
            role="tab"
            aria-selected={activeTab === null}
            onClick={() => handleTabChange(null)}
            className={`inline-flex shrink-0 items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition-all ${
              activeTab === null
                ? 'bg-vita-600 text-white shadow-sm'
                : 'border border-slate-200 bg-white text-slate-600 hover:border-vita-600 hover:text-vita-700'
            }`}
          >
            <Users size={15} />
            Todos
            <span className={`ml-0.5 rounded-full px-2 py-0.5 text-xs font-semibold ${
              activeTab === null ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-600'
            }`}>{totalActive}</span>
          </button>
          {activeProfessionals.map(prof => {
            const count = appointmentCounts.get(prof.id) ?? 0
            const isActive = activeTab === prof.id
            return (
              <button
                key={prof.id}
                role="tab"
                aria-selected={isActive}
                onClick={() => handleTabChange(prof.id)}
                className={`inline-flex shrink-0 items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition-all ${
                  isActive
                    ? 'bg-vita-600 text-white shadow-sm'
                    : 'border border-slate-200 bg-white text-slate-600 hover:border-vita-600 hover:text-vita-700'
                }`}
              >
                {prof.name}
                {prof.specialty && <span className={`text-xs ${isActive ? 'text-white/70' : 'text-slate-400'}`}>· {prof.specialty}</span>}
                <span className={`ml-0.5 rounded-full px-2 py-0.5 text-xs font-semibold ${
                  isActive ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-600'
                }`}>{count}</span>
              </button>
            )
          })}
        </div>
      </div>
    )}

    {/* Form */}
    <form onSubmit={submit} className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
      <Select label="Paciente" value={form.patientId} onChange={v=>setForm({...form,patientId:v})} items={patients.data??[]} required/>
      <Select label="Profissional" value={form.professionalId} onChange={v=>setForm({...form,professionalId:v,time:''})} items={activeProfessionals} required/>
      <Select label="Sala/cadeira" value={form.resourceId} onChange={v=>setForm({...form,resourceId:v,time:''})} items={(resources.data??[]).filter(x=>x.active)} optional/>
      <label className="text-sm font-medium">Horário<select value={form.time} onChange={e=>setForm({...form,time:e.target.value})} required disabled={!form.professionalId||slots.isLoading} className="mt-1.5 block w-full rounded-lg border border-slate-300 px-3 py-2.5"><option value="">{slots.isLoading?'Buscando…':'Selecione'}</option>{(slots.data??[]).map(x=><option key={x}>{x}</option>)}</select></label>
      <button disabled={save.isPending||!form.time} className="self-end rounded-lg bg-vita-600 px-4 py-2.5 font-semibold text-white disabled:opacity-60"><CalendarPlus className="mr-2 inline" size={17}/>{editingId?'Salvar reagendamento':'Agendar'}</button>
    </form>

    {editingId&&<button onClick={()=>{setEditingId(null);setForm({patientId:'',professionalId:activeTab !== null ? String(activeTab) : '',resourceId:'',time:''})}} className="mt-3 text-sm text-slate-600">Cancelar edição</button>}
    {notice&&<p className="mt-3 text-sm text-vita-700">{notice}</p>}

    {/* Timeline View — when a professional tab is selected */}
    {isClinic && activeTab !== null && timelineSlots.length > 0 && (
      <div className="mt-6">
        {/* Summary bar */}
        {timelineSummary && (
          <div className="mb-4 flex flex-wrap items-center gap-3 rounded-xl bg-slate-50 px-4 py-3">
            <Clock size={16} className="text-slate-400" />
            <span className="text-sm font-medium text-slate-700">Resumo do dia:</span>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-800">
              <span className="size-2 rounded-full bg-emerald-500"></span>
              {timelineSummary.free} livre{timelineSummary.free !== 1 ? 's' : ''}
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-vita-50 px-3 py-1 text-xs font-semibold text-vita-700">
              <span className="size-2 rounded-full bg-vita-600"></span>
              {timelineSummary.booked} agendado{timelineSummary.booked !== 1 ? 's' : ''}
            </span>
            <span className="text-xs text-slate-400">({timelineSummary.total} horário{timelineSummary.total !== 1 ? 's' : ''} no dia)</span>
          </div>
        )}

        {/* Slot grid */}
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {timelineSlots.map(slot => (
            <div
              key={slot.time}
              className={`group relative flex items-center gap-3 rounded-xl border px-4 py-3 transition-all ${
                slot.type === 'booked'
                  ? slot.appointment?.status === 'attended'
                    ? 'border-slate-200 bg-slate-50'
                    : 'border-vita-200 bg-vita-50'
                  : 'border-dashed border-slate-200 bg-white hover:border-emerald-300 hover:bg-emerald-50'
              }`}
            >
              {/* Time badge */}
              <span className={`shrink-0 rounded-lg px-2.5 py-1.5 text-sm font-bold tabular-nums ${
                slot.type === 'booked'
                  ? slot.appointment?.status === 'attended' ? 'bg-slate-200 text-slate-500' : 'bg-vita-600 text-white'
                  : 'bg-emerald-100 text-emerald-700 group-hover:bg-emerald-200'
              }`}>
                {slot.time}
              </span>

              {slot.type === 'booked' && slot.appointment ? (
                <div className="flex min-w-0 flex-1 items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className={`truncate text-sm font-semibold ${slot.appointment.status === 'attended' ? 'text-slate-400 line-through' : 'text-slate-800'}`}>
                      {slot.appointment.patients?.name ?? 'Paciente'}
                    </p>
                    <div className="flex items-center gap-2">
                      <span className={`mt-0.5 inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold ${statusColor(slot.appointment.status)}`}>
                        {statusLabel(slot.appointment.status)}
                      </span>
                      <span className="text-[10px] text-slate-400">{slot.appointment.duration_minutes} min</span>
                    </div>
                  </div>
                  {/* Quick actions */}
                  <div className="flex shrink-0 items-center gap-1">
                    {!['cancelled','attended'].includes(slot.appointment.status) && <button onClick={()=>startEdit(slot.appointment!)} title="Reagendar" className="rounded-lg p-1.5 text-slate-400 hover:bg-white hover:text-vita-700"><Pencil size={14}/></button>}
                    {slot.appointment.status==='pending'&&<button onClick={()=>statusMutation.mutate({id:slot.appointment!.id,value:'confirmed'})} title="Confirmar" className="rounded-lg p-1.5 text-slate-400 hover:bg-emerald-50 hover:text-emerald-700"><Check size={14}/></button>}
                    {slot.appointment.status==='confirmed'&&<button onClick={()=>statusMutation.mutate({id:slot.appointment!.id,value:'attended'})} className="rounded-lg px-2 py-1 text-[10px] font-semibold text-slate-500 hover:bg-emerald-50 hover:text-emerald-700">Atendido</button>}
                    {!['cancelled','attended'].includes(slot.appointment.status)&&<button onClick={()=>statusMutation.mutate({id:slot.appointment!.id,value:'cancelled'})} title="Cancelar" className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-700"><X size={14}/></button>}
                  </div>
                </div>
              ) : (
                <span className="text-sm text-emerald-600 font-medium">Livre</span>
              )}
            </div>
          ))}
        </div>
      </div>
    )}

    {/* Fallback: appointment list for "Todos" tab or professional type or when no schedule config */}
    {(!isClinic || activeTab === null || timelineSlots.length === 0) && (
      <div className="mt-6 divide-y">
        {/* Show message if professional tab is active but no schedule config */}
        {isClinic && activeTab !== null && timelineSlots.length === 0 && filteredAppointments.length === 0 && (
          <p className="py-6 text-center text-sm text-slate-400">
            Este profissional não possui configuração de horários. Configure a duração da consulta e horários de atendimento nas Configurações.
          </p>
        )}
        {isClinic && activeTab !== null && timelineSlots.length === 0 && filteredAppointments.length > 0 && (
          <>
            <p className="pb-3 text-center text-xs text-amber-600">
              ⚠ Profissional sem configuração de horários — exibindo apenas os atendimentos agendados.
            </p>
            {filteredAppointments.map(a=><div key={a.id} className={`flex justify-between gap-3 py-3 text-sm ${a.status==='attended'?'text-slate-400 line-through':''}`}>
              <span>
                <strong>{a.time.slice(0,5)} | {a.patients?.name}</strong>
                <small> | {a.professionals?.name} · {a.duration_minutes} min</small>
              </span>
              <div className="flex gap-2">
                {!['cancelled','attended'].includes(a.status)&&<button onClick={()=>startEdit(a)} title="Reagendar"><Pencil size={16}/></button>}
                {a.status==='pending'&&<button onClick={()=>statusMutation.mutate({id:a.id,value:'confirmed'})} title="Confirmar"><Check size={16}/></button>}
                {a.status==='confirmed'&&<button onClick={()=>statusMutation.mutate({id:a.id,value:'attended'})}>Atendido</button>}
                {!['cancelled','attended'].includes(a.status)&&<button onClick={()=>statusMutation.mutate({id:a.id,value:'cancelled'})}><X size={16}/></button>}
              </div>
            </div>)}
          </>
        )}
        {(!isClinic || activeTab === null) && (
          <>
            {filteredAppointments.length === 0 && (
              <p className="py-6 text-center text-sm text-slate-400">
                Nenhum atendimento nesta data.
              </p>
            )}
            {filteredAppointments.map(a=><div key={a.id} className={`flex justify-between gap-3 py-3 text-sm ${a.status==='attended'?'text-slate-400 line-through':''}`}>
              <span>
                <strong>{a.time.slice(0,5)} | {a.patients?.name}</strong>
                <small> | {a.professionals?.name} · {a.duration_minutes} min</small>
              </span>
              <div className="flex gap-2">
                {!['cancelled','attended'].includes(a.status)&&<button onClick={()=>startEdit(a)} title="Reagendar"><Pencil size={16}/></button>}
                {a.status==='pending'&&<button onClick={()=>statusMutation.mutate({id:a.id,value:'confirmed'})} title="Confirmar"><Check size={16}/></button>}
                {a.status==='confirmed'&&<button onClick={()=>statusMutation.mutate({id:a.id,value:'attended'})}>Atendido</button>}
                {!['cancelled','attended'].includes(a.status)&&<button onClick={()=>statusMutation.mutate({id:a.id,value:'cancelled'})}><X size={16}/></button>}
              </div>
            </div>)}
          </>
        )}
      </div>
    )}
  </section>
}

function Select({label,value,onChange,items,required=false,optional=false}:{label:string;value:string;onChange:(v:string)=>void;items:(Patient|Professional|ClinicalResource)[];required?:boolean;optional?:boolean}){return <label className="text-sm font-medium">{label}<select value={value} onChange={e=>onChange(e.target.value)} required={required} className="mt-1.5 block w-full rounded-lg border border-slate-300 px-3 py-2.5"><option value="">{optional?'Não informar':'Selecione'}</option>{items.map(i=><option key={i.id} value={i.id}>{i.name}</option>)}</select></label>}

function friendly(x:string){return ({time_unavailable:'Horário indisponível.',time_outside_working_hours:'Horário fora do período de atendimento.',professional_has_no_schedule_configuration:'Profissional sem configuração de duração e intervalo.'}[x]??x)}
