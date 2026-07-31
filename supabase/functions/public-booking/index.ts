import { createClient } from 'npm:@supabase/supabase-js@2'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
const send = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } })
const minutes = (time: string) => { const [hour, minute] = time.slice(0, 5).split(':').map(Number); return hour * 60 + minute }
const escapeHtml = (value: string) => value.replace(/[&<>'"]/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[char]!))

async function sendConfirmationEmail(input: { email: string, patientName: string, clinicName: string, professionalName: string, date: string, time: string }) {
  const apiKey = Deno.env.get('RESEND_API_KEY')
  if (!apiKey) return

  const date = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'full', timeZone: 'America/Sao_Paulo' }).format(new Date(`${input.date}T12:00:00`))
  const patient = escapeHtml(input.patientName)
  const clinic = escapeHtml(input.clinicName)
  const professional = escapeHtml(input.professionalName)
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: 'Agenda Vita <agendamentos@robsonsvicero.net>',
      to: [input.email],
      subject: `Confirmação de agendamento — ${input.clinicName}`,
      text: `Olá, ${input.patientName}!\n\nSeu agendamento foi confirmado.\n\nLocal: ${input.clinicName}\nProfissional: ${input.professionalName}\nData: ${date}\nHorário: ${input.time}\n\nSe precisar alterar ou cancelar, entre em contato com a organização.`,
      html: `<main style="font-family:Arial,sans-serif;color:#1e293b;line-height:1.5"><h1 style="color:#0f766e;font-size:22px">Agendamento confirmado</h1><p>Olá, <strong>${patient}</strong>!</p><p>Seu agendamento foi confirmado.</p><div style="border:1px solid #e2e8f0;border-radius:12px;padding:16px;background:#f8fafc"><p style="margin:0 0 8px"><strong>Local:</strong> ${clinic}</p><p style="margin:0 0 8px"><strong>Profissional:</strong> ${professional}</p><p style="margin:0 0 8px"><strong>Data:</strong> ${date}</p><p style="margin:0"><strong>Horário:</strong> ${input.time}</p></div><p>Se precisar alterar ou cancelar, entre em contato com a organização.</p></main>`,
    }),
  })
  if (!response.ok) console.error('confirmation_email_failed', await response.text())
}

Deno.serve(async req => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  const body = await req.json().catch(() => null)
  const slug = String(body?.slug || '')
  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
  const { data: clinic } = await admin.from('clinics').select('id,name,specialty,logo_url,primary_color,secondary_color,background_color,font_family,google_font_family').eq('slug', slug).eq('status', 'active').maybeSingle()
  if (!clinic) return send({ error: 'clinic_not_found' }, 404)

  if (body.action === 'info') {
    const [{ data: professionals }, { data: resources }] = await Promise.all([
      admin.from('professionals').select('id,name,specialty').eq('clinic_id', clinic.id).eq('active', true).order('name'),
      admin.from('clinical_resources').select('id,name,resource_type').eq('clinic_id', clinic.id).eq('active', true).order('name'),
    ])
    return send({ clinic, professionals: professionals ?? [], resources: resources ?? [] })
  }

  const professionalId = Number(body.professionalId)
  const resourceId = body.resourceId ? Number(body.resourceId) : null
  const date = String(body.date || '')
  if (!professionalId || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return send({ error: 'invalid_booking_data' }, 400)

  const [{ data: setting }, { data: professional }] = await Promise.all([
    admin.from('appointment_types').select('duration_minutes,interval_minutes').eq('clinic_id', clinic.id).eq('professional_id', professionalId).eq('active', true).maybeSingle(),
    admin.from('professionals').select('name').eq('clinic_id', clinic.id).eq('id', professionalId).eq('active', true).maybeSingle(),
  ])
  if (!setting || !professional) return send({ error: 'professional_has_no_schedule_configuration' }, 400)

  const weekday = new Date(`${date}T12:00:00`).getDay()
  const { data: rules } = await admin.from('working_hours').select('start_time,end_time,professional_id').eq('clinic_id', clinic.id).eq('weekday', weekday)
  const specific = (rules ?? []).filter(rule => rule.professional_id === professionalId)
  const applicable = specific.length ? specific : (rules ?? []).filter(rule => rule.professional_id === null)
  const { data: existing } = await admin.from('appointments').select('time,duration_minutes,interval_minutes,professional_id,resource_id').eq('clinic_id', clinic.id).eq('date', date).neq('status', 'cancelled')
  const isAvailable = (time: string) => {
    const start = minutes(time)
    const end = start + setting.duration_minutes + setting.interval_minutes
    return applicable.some(rule => start >= minutes(rule.start_time) && end <= minutes(rule.end_time)) && !(existing ?? []).some(appointment => (appointment.professional_id === professionalId || (resourceId && appointment.resource_id === resourceId)) && start < minutes(appointment.time) + appointment.duration_minutes + appointment.interval_minutes && end > minutes(appointment.time))
  }

  if (body.action === 'slots') {
    const slots: string[] = []
    for (const rule of applicable) for (let start = minutes(rule.start_time); start + setting.duration_minutes + setting.interval_minutes <= minutes(rule.end_time); start += setting.duration_minutes + setting.interval_minutes) {
      const time = `${String(Math.floor(start / 60)).padStart(2, '0')}:${String(start % 60).padStart(2, '0')}`
      if (isAvailable(time)) slots.push(time)
    }
    return send({ slots: [...new Set(slots)].sort() })
  }

  if (body.action === 'book') {
    const time = String(body.time || '')
    const patient = body.patient as { name?: string, phone?: string, email?: string, address?: string, birthDate?: string } | undefined
    if (!isAvailable(time) || !patient?.name?.trim() || !patient?.phone?.trim()) return send({ error: 'time_unavailable' }, 409)
    const { data: savedPatient, error: patientError } = await admin.from('patients').upsert({ clinic_id: clinic.id, name: patient.name.trim(), phone: patient.phone.trim(), email: patient.email?.trim() || null, address: patient.address?.trim() || null, birth_date: patient.birthDate || null }, { onConflict: 'clinic_id,phone' }).select('id').single()
    if (patientError || !savedPatient) return send({ error: patientError?.message || 'patient_error' }, 400)
    const { error } = await admin.from('appointments').insert({ clinic_id: clinic.id, patient_id: savedPatient.id, professional_id: professionalId, resource_id: resourceId, date, time, duration_minutes: setting.duration_minutes, interval_minutes: setting.interval_minutes, status: 'pending' })
    if (error) return send({ error: error.message }, 400)

    const email = patient.email?.trim()
    if (email) await sendConfirmationEmail({ email, patientName: patient.name.trim(), clinicName: clinic.name, professionalName: professional.name, date, time })
    return send({ success: true, clinicName: clinic.name })
  }
  return send({ error: 'unknown_action' }, 400)
})
