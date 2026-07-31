import { createClient } from 'npm:@supabase/supabase-js@2'

const allowedOrigins = [
  'https://svicerostudio.com.br',
  'https://www.svicerostudio.com.br',
  'https://robsonsvicero.com.br',
  'https://www.robsonsvicero.com.br',
  'http://localhost:5173',
]

const rateLimitWindowMs = 60_000
const rateLimitMaxRequests = 10
const rateLimitStore = new Map<string, { count: number; resetAt: number }>()

const minutes = (time: string) => {
  const [hour, minute] = time.slice(0, 5).split(':').map(Number)
  return hour * 60 + minute
}

const escapeHtml = (value: string) => value.replace(/[&<>'"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[char]!))

const getClientIp = (req: Request) => {
  const forwarded = req.headers.get('x-forwarded-for') || req.headers.get('cf-connecting-ip') || req.headers.get('x-real-ip') || ''
  return forwarded.split(',')[0].trim() || 'unknown'
}

async function sendConfirmationEmail(input: { email: string; patientName: string; clinicName: string; professionalName: string; date: string; time: string }) {
  const apiKey = Deno.env.get('RESEND_API_KEY')
  if (!apiKey) return

  try {
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

    if (!response.ok) {
      const responseText = await response.text().catch(() => '')
      console.error('confirmation_email_failed', responseText)
    }
  } catch (error) {
    console.error('confirmation_email_failed', error)
  }
}

Deno.serve(async (req) => {
  const origin = req.headers.get('origin') || ''
  const cors = {
    'Access-Control-Allow-Origin': allowedOrigins.includes(origin) ? origin : allowedOrigins[0],
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  }

  const send = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } })

  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })

  const clientIp = getClientIp(req)
  const now = Date.now()
  const current = rateLimitStore.get(clientIp)

  if (current && current.resetAt > now) {
    if (current.count >= rateLimitMaxRequests) return send({ error: 'rate_limited' }, 429)
    current.count += 1
  } else {
    rateLimitStore.set(clientIp, { count: 1, resetAt: now + rateLimitWindowMs })
  }

  let body: any = null
  try {
    body = await req.json()
  } catch {
    body = null
  }

  const slug = String(body?.slug || '')
  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)

  const { data: clinic, error: clinicError } = await admin
    .from('clinics')
    .select('id,name,specialty,logo_url,primary_color,secondary_color,background_color,font_family,google_font_family')
    .eq('slug', slug)
    .eq('status', 'active')
    .maybeSingle()

  if (clinicError) return send({ error: clinicError.message }, 500)
  if (!clinic) return send({ error: 'clinic_not_found' }, 404)

  if (body?.action === 'info') {
    const [{ data: professionals, error: professionalsError }, { data: resources, error: resourcesError }] = await Promise.all([
      admin.from('professionals').select('id,name,specialty').eq('clinic_id', clinic.id).eq('active', true).order('name'),
      admin.from('clinical_resources').select('id,name,resource_type').eq('clinic_id', clinic.id).eq('active', true).order('name'),
    ])

    if (professionalsError || resourcesError) {
      return send({ error: professionalsError?.message || resourcesError?.message || 'schedule_info_error' }, 500)
    }

    return send({ clinic, professionals: professionals ?? [], resources: resources ?? [] })
  }

  const professionalId = Number(body?.professionalId)
  const resourceId = body?.resourceId ? Number(body.resourceId) : null
  const date = String(body?.date || '')
  if (!professionalId || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return send({ error: 'invalid_booking_data' }, 400)

  const bookingDate = new Date(`${date}T00:00:00`)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  if (bookingDate < today) return send({ error: 'past_date_not_allowed' }, 400)

  const [{ data: setting, error: settingError }, { data: professional, error: professionalError }] = await Promise.all([
    admin.from('appointment_types').select('duration_minutes,interval_minutes').eq('clinic_id', clinic.id).eq('professional_id', professionalId).eq('active', true).maybeSingle(),
    admin.from('professionals').select('name').eq('clinic_id', clinic.id).eq('id', professionalId).eq('active', true).maybeSingle(),
  ])

  if (settingError || professionalError) return send({ error: settingError?.message || professionalError?.message || 'schedule_configuration_error' }, 500)
  if (!setting || !professional) return send({ error: 'professional_has_no_schedule_configuration' }, 400)

  const weekday = new Date(`${date}T12:00:00`).getDay()
  const { data: rules, error: rulesError } = await admin.from('working_hours').select('start_time,end_time,professional_id').eq('clinic_id', clinic.id).eq('weekday', weekday)
  if (rulesError) return send({ error: rulesError.message }, 500)

  const specific = (rules ?? []).filter((rule: { professional_id: number | null }) => rule.professional_id === professionalId)
  const applicable = specific.length ? specific : (rules ?? []).filter((rule: { professional_id: number | null }) => rule.professional_id === null)

  const { data: existing, error: existingError } = await admin.from('appointments').select('time,duration_minutes,interval_minutes,professional_id,resource_id').eq('clinic_id', clinic.id).eq('date', date).neq('status', 'cancelled')
  if (existingError) return send({ error: existingError.message }, 500)

  const nextDate = new Date(`${date}T12:00:00`)
  nextDate.setDate(nextDate.getDate() + 1)
  const nextDateString = nextDate.toISOString().slice(0, 10)
  const { data: blocks, error: blocksError } = await admin
    .from('schedule_blocks')
    .select('professional_id,resource_id,starts_at,ends_at')
    .eq('clinic_id', clinic.id)
    .lt('starts_at', `${nextDateString}T00:00:00`)
    .gt('ends_at', `${date}T00:00:00`)
  if (blocksError) return send({ error: blocksError.message }, 500)

  const isAvailable = (time: string) => {
    const slotDateTime = new Date(`${date}T${time}:00-03:00`)
    const twoHoursFromNow = new Date(Date.now() + 2 * 60 * 60 * 1000)
    if (slotDateTime < twoHoursFromNow) return false

    const start = minutes(time)
    const end = start + setting.duration_minutes + setting.interval_minutes

    const hasWorkingHours = applicable.some((rule: { start_time: string; end_time: string }) => start >= minutes(rule.start_time) && end <= minutes(rule.end_time))
    if (!hasWorkingHours) return false

    const isBlocked = (blocks ?? []).some((block: { professional_id: number | null; resource_id: number | null; starts_at: string; ends_at: string }) => {
      const blockStart = block.starts_at.slice(0, 10) < date ? 0 : minutes(block.starts_at.slice(11, 16))
      const blockEnd = block.ends_at.slice(0, 10) > date ? 24 * 60 : minutes(block.ends_at.slice(11, 16))
      const matchesProfessional = block.professional_id === null || block.professional_id === professionalId
      const matchesResource = block.resource_id === null || resourceId === null || block.resource_id === resourceId
      return matchesProfessional && matchesResource && start < blockEnd && end > blockStart
    })

    if (isBlocked) return false

    return !(existing ?? []).some((appointment: { professional_id: number; resource_id: number | null; time: string; duration_minutes: number; interval_minutes: number }) => {
      const appointmentStart = minutes(appointment.time)
      const appointmentEnd = appointmentStart + appointment.duration_minutes + appointment.interval_minutes
      const sameProfessional = appointment.professional_id === professionalId
      const sameResource = resourceId ? appointment.resource_id === resourceId : true
      return sameProfessional && sameResource && start < appointmentEnd && end > appointmentStart
    })
  }

  if (body?.action === 'slots') {
    const slots: string[] = []
    for (const rule of applicable) {
      for (let start = minutes(rule.start_time); start + setting.duration_minutes + setting.interval_minutes <= minutes(rule.end_time); start += setting.duration_minutes + setting.interval_minutes) {
        const time = `${String(Math.floor(start / 60)).padStart(2, '0')}:${String(start % 60).padStart(2, '0')}`
        if (isAvailable(time)) slots.push(time)
      }
    }
    return send({ slots: [...new Set(slots)].sort() })
  }

  if (body?.action === 'book') {
    const time = String(body?.time || '')
    const patient = body?.patient as { name?: string; phone?: string; email?: string; address?: string; birthDate?: string } | undefined
    if (!isAvailable(time) || !patient?.name?.trim() || !patient?.phone?.trim()) return send({ error: 'time_unavailable' }, 409)

    // Normaliza o telefone: remove tudo que não for dígito.
    // Isso evita que "(11) 9 8765-4321" e "11987654321" criem dois registros distintos.
    const phoneNormalized = (patient.phone.trim()).replace(/[^0-9]/g, '')
    if (!phoneNormalized) return send({ error: 'time_unavailable' }, 409)

    const { data: savedPatient, error: patientError } = await admin.from('patients').upsert({
      clinic_id: clinic.id,
      name: patient.name.trim(),
      phone: patient.phone.trim(),
      email: patient.email?.trim() || null,
      address: patient.address?.trim() || null,
      birth_date: patient.birthDate || null,
    }, { onConflict: 'clinic_id,phone_normalized', ignoreDuplicates: false }).select('id').single()

    if (patientError || !savedPatient) return send({ error: patientError?.message || 'patient_error' }, 400)

    try {
      const { error: insertError } = await admin.from('appointments').insert({
        clinic_id: clinic.id,
        patient_id: savedPatient.id,
        professional_id: professionalId,
        resource_id: resourceId,
        date,
        time,
        duration_minutes: setting.duration_minutes,
        interval_minutes: setting.interval_minutes,
        status: 'pending',
      })

      if (insertError) {
        const message = insertError.message?.toLowerCase() || ''
        if (message.includes('duplicate') || message.includes('conflict') || message.includes('overlap')) return send({ error: 'time_unavailable' }, 409)
        return send({ error: insertError.message }, 400)
      }
    } catch (error) {
      console.error('appointment_insert_failed', error)
      return send({ error: 'appointment_insert_failed' }, 500)
    }

    const email = patient.email?.trim()
    if (email) {
      await sendConfirmationEmail({ email, patientName: patient.name.trim(), clinicName: clinic.name, professionalName: professional.name, date, time })
    }

    return send({ success: true, clinicName: clinic.name })
  }

  return send({ error: 'unknown_action' }, 400)
})
