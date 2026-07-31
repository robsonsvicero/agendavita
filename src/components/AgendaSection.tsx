import { useMemo, useState, type FormEvent } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { CalendarPlus, Check, Pencil, Users, X } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { listPatients, type Patient } from '../lib/patients'
import { listProfessionals, listResources, type Professional, type ClinicalResource } from '../lib/organizationTeam'

type Appointment = { id:number; date:string; time:string; status:string; duration_minutes:number; patient_id:number; professional_id:number; resource_id:number|null; patients:{name:string}|null; professionals:{name:string}|null; clinical_resources:{name:string}|null }
const today = new Date().toISOString().slice(0,10)

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

  const slots=useQuery({queryKey:['slots',clinicId,date,form.professionalId,form.resourceId,editingId],enabled:enabled&&Boolean(form.professionalId),queryFn:async()=>((await invoke({action:'available-slots',professionalId:+form.professionalId,resourceId:form.resourceId?+form.resourceId:null,date,excludeId:editingId}))?.slots??[]) as string[]})
  const save=useMutation({mutationFn:()=>invoke({action:editingId?'reschedule':'create',id:editingId,patientId:+form.patientId,professionalId:+form.professionalId,resourceId:form.resourceId?+form.resourceId:null,date,time:form.time}),onSuccess:()=>{setForm({patientId:'',professionalId:activeTab !== null ? String(activeTab) : '',resourceId:'',time:''});setEditingId(null);setNotice('Agendamento salvo.');client.invalidateQueries({queryKey:['appointments',clinicId,date]});client.invalidateQueries({queryKey:['slots']})},onError:(e:Error)=>setNotice(`Erro: ${friendly(e.message)}`)})
  const status=useMutation({mutationFn:({id,value}:{id:number;value:string})=>invoke({action:'set-status',id,status:value}),onSuccess:()=>client.invalidateQueries({queryKey:['appointments',clinicId,date]}),onError:(e:Error)=>setNotice(`Erro: ${friendly(e.message)}`)})

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

    {/* Appointment List */}
    <div className="mt-6 divide-y">
      {filteredAppointments.length === 0 && (
        <p className="py-6 text-center text-sm text-slate-400">
          {activeTab !== null ? 'Nenhum atendimento para este profissional nesta data.' : 'Nenhum atendimento nesta data.'}
        </p>
      )}
      {filteredAppointments.map(a=><div key={a.id} className={`flex justify-between gap-3 py-3 text-sm ${a.status==='attended'?'text-slate-400 line-through':''}`}>
        <span>
          <strong>{a.time.slice(0,5)} | {a.patients?.name}</strong>
          <small> | {a.professionals?.name} · {a.duration_minutes} min</small>
        </span>
        <div className="flex gap-2">
          {!['cancelled','attended'].includes(a.status)&&<button onClick={()=>startEdit(a)} title="Reagendar"><Pencil size={16}/></button>}
          {a.status==='pending'&&<button onClick={()=>status.mutate({id:a.id,value:'confirmed'})} title="Confirmar"><Check size={16}/></button>}
          {a.status==='confirmed'&&<button onClick={()=>status.mutate({id:a.id,value:'attended'})}>Atendido</button>}
          {!['cancelled','attended'].includes(a.status)&&<button onClick={()=>status.mutate({id:a.id,value:'cancelled'})}><X size={16}/></button>}
        </div>
      </div>)}
    </div>
  </section>
}

function Select({label,value,onChange,items,required=false,optional=false}:{label:string;value:string;onChange:(v:string)=>void;items:(Patient|Professional|ClinicalResource)[];required?:boolean;optional?:boolean}){return <label className="text-sm font-medium">{label}<select value={value} onChange={e=>onChange(e.target.value)} required={required} className="mt-1.5 block w-full rounded-lg border border-slate-300 px-3 py-2.5"><option value="">{optional?'Não informar':'Selecione'}</option>{items.map(i=><option key={i.id} value={i.id}>{i.name}</option>)}</select></label>}

function friendly(x:string){return ({time_unavailable:'Horário indisponível.',time_outside_working_hours:'Horário fora do período de atendimento.',professional_has_no_schedule_configuration:'Profissional sem configuração de duração e intervalo.'}[x]??x)}
