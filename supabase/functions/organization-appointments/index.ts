import { createClient } from 'npm:@supabase/supabase-js@2'
const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type', 'Access-Control-Allow-Methods': 'POST, OPTIONS' }
const send = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } })
const minutes = (time: string) => { const [h, m] = time.slice(0, 5).split(':').map(Number); return h * 60 + m }
Deno.serve(async request => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: cors })
  const authorization = request.headers.get('Authorization'); if (!authorization?.startsWith('Bearer ')) return send({ error: 'unauthorized' }, 401)
  const url = Deno.env.get('SUPABASE_URL')!, anon = Deno.env.get('SUPABASE_ANON_KEY')!, service = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const caller = createClient(url, anon, { global: { headers: { Authorization: authorization } } }); const { data: { user } } = await caller.auth.getUser(); if (!user) return send({ error: 'unauthorized' }, 401)
  const body = await request.json().catch(() => null); const clinicId = Number(body?.clinicId); if (!Number.isInteger(clinicId)) return send({ error: 'invalid_clinic' }, 400)
  const { data: membership } = await caller.from('organization_memberships').select('role, active, clinics(status)').eq('clinic_id', clinicId).eq('user_id', user.id).maybeSingle(); const clinic = Array.isArray(membership?.clinics) ? membership?.clinics[0] : membership?.clinics
  if (!membership?.active || clinic?.status !== 'active' || !['owner', 'manager', 'secretary', 'professional'].includes(membership.role)) return send({ error: 'forbidden' }, 403)
  const admin = createClient(url, service)
  if (body.action === 'available-slots') {
    const professionalId = Number(body.professionalId), resourceId = body.resourceId ? Number(body.resourceId) : null, date = String(body.date), excludeId = Number(body.excludeId) || null
    if (!professionalId || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return send({ error: 'invalid_availability_request' }, 400)
    const { data: setting } = await admin.from('appointment_types').select('duration_minutes,interval_minutes').eq('clinic_id', clinicId).eq('professional_id', professionalId).eq('active', true).maybeSingle()
    if (!setting) return send({ error: 'professional_has_no_schedule_configuration' }, 400)
    const weekday = new Date(`${date}T12:00:00`).getDay()
    const { data: rules } = await admin.from('working_hours').select('start_time,end_time,professional_id').eq('clinic_id', clinicId).eq('weekday', weekday)
    const specificRules = (rules ?? []).filter(rule => rule.professional_id === professionalId)
    const applicable = specificRules.length ? specificRules : (rules ?? []).filter(rule => rule.professional_id === null)
    const { data: existing } = await admin.from('appointments').select('id,time,duration_minutes,interval_minutes,professional_id,resource_id').eq('clinic_id', clinicId).eq('date', date).neq('status', 'cancelled')
    const slots: string[] = []
    for (const rule of applicable) {
      for (let start = minutes(rule.start_time), end = minutes(rule.end_time); start + setting.duration_minutes + setting.interval_minutes <= end; start += setting.duration_minutes + setting.interval_minutes) {
        const overlaps = (existing ?? []).some(item => item.id !== excludeId && (item.professional_id === professionalId || (resourceId && item.resource_id === resourceId)) && start < minutes(item.time) + item.duration_minutes + item.interval_minutes && start + setting.duration_minutes + setting.interval_minutes > minutes(item.time))
        if (!overlaps) slots.push(`${String(Math.floor(start / 60)).padStart(2,'0')}:${String(start % 60).padStart(2,'0')}`)
      }
    }
    return send({ slots: [...new Set(slots)].sort() })
  }
  if (body.action === 'create' || body.action === 'reschedule') {
    const patientId = Number(body.patientId), professionalId = Number(body.professionalId), resourceId = body.resourceId ? Number(body.resourceId) : null, date = String(body.date), time = String(body.time), appointmentId = body.action === 'reschedule' ? Number(body.id) : null
    if (!patientId || !professionalId || !/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}/.test(time)) return send({ error: 'invalid_appointment_data' }, 400)
    const [{ data: patient }, { data: professional }, { data: setting }] = await Promise.all([admin.from('patients').select('id').eq('id', patientId).eq('clinic_id', clinicId).maybeSingle(), admin.from('professionals').select('id').eq('id', professionalId).eq('clinic_id', clinicId).eq('active', true).maybeSingle(), admin.from('appointment_types').select('duration_minutes, interval_minutes').eq('clinic_id', clinicId).eq('professional_id', professionalId).eq('active', true).maybeSingle()])
    if (!patient || !professional) return send({ error: 'patient_or_professional_not_found' }, 400)
    if (!setting) return send({ error: 'professional_has_no_schedule_configuration' }, 400)
    if (resourceId) { const { data: resource } = await admin.from('clinical_resources').select('id').eq('id', resourceId).eq('clinic_id', clinicId).eq('active', true).maybeSingle(); if (!resource) return send({ error: 'resource_not_found' }, 400) }
    const weekday = new Date(`${date}T12:00:00`).getDay(); const { data: rules } = await admin.from('working_hours').select('start_time,end_time,professional_id').eq('clinic_id', clinicId).eq('weekday', weekday)
    const specificRules = (rules ?? []).filter(rule => rule.professional_id === professionalId); const applicable = specificRules.length ? specificRules : (rules ?? []).filter(rule => rule.professional_id === null); const start = minutes(time), end = start + setting.duration_minutes + setting.interval_minutes
    if (!applicable.some(rule => start >= minutes(rule.start_time) && end <= minutes(rule.end_time))) return send({ error: 'time_outside_working_hours' }, 409)
    const { data: existing } = await admin.from('appointments').select('id,time,duration_minutes,interval_minutes,professional_id,resource_id').eq('clinic_id', clinicId).eq('date', date).neq('status', 'cancelled')
    const overlaps = (existing ?? []).some(item => item.id !== appointmentId && (item.professional_id === professionalId || (resourceId && item.resource_id === resourceId)) && start < minutes(item.time) + item.duration_minutes + item.interval_minutes && end > minutes(item.time))
    if (overlaps) return send({ error: 'time_unavailable' }, 409)
    const payload = { patient_id: patientId, professional_id: professionalId, resource_id: resourceId, date, time, duration_minutes: setting.duration_minutes, interval_minutes: setting.interval_minutes, status: 'pending' }
    const { error } = appointmentId ? await admin.from('appointments').update(payload).eq('id', appointmentId).eq('clinic_id', clinicId) : await admin.from('appointments').insert({ clinic_id: clinicId, ...payload })
    if (error) return send({ error: error.message }, 400); return send({ success: true })
  }
  if (body.action === 'set-status') { const id = Number(body.id), status = body.status; if (!id || !['confirmed','cancelled','attended'].includes(status)) return send({ error: 'invalid_status' }, 400); const { error } = await admin.from('appointments').update({ status }).eq('id', id).eq('clinic_id', clinicId); return error ? send({ error: error.message }, 400) : send({ success: true }) }
  return send({ error: 'unknown_action' }, 400)
})
