import { createClient } from 'npm:@supabase/supabase-js@2'

const platformAdminEmail = 'robsonsvicero@outlook.com'
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

type CreateOrganizationInput = {
  name: string
  slug: string
  email: string
  ownerName: string
  ownerEmail: string
  temporaryPassword: string
  organizationType: 'clinic' | 'professional'
  specialty?: string
  phone?: string
  address?: string
  primaryColor?: string
  secondaryColor?: string
  backgroundColor?: string
  fontFamily?: string
  googleFontFamily?: string
  professionalCouncilRegistration?: string
  technicalResponsible?: string
  clinicCouncilRegistration?: string
}

function response(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
}

function validSlug(slug: string) {
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)
}

function errorMessage(error: unknown) {
  if (error instanceof Error) return error.message
  if (typeof error === 'object' && error && 'message' in error && typeof error.message === 'string') return error.message
  return JSON.stringify(error)
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (request.method !== 'POST') return response({ error: 'method_not_allowed' }, 405)

  const authorization = request.headers.get('Authorization')
  if (!authorization?.startsWith('Bearer ')) return response({ error: 'unauthorized' }, 401)

  const url = Deno.env.get('SUPABASE_URL')!
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const callerClient = createClient(url, anonKey, { global: { headers: { Authorization: authorization } } })
  const { data: { user }, error: userError } = await callerClient.auth.getUser()
  if (userError || user?.email?.toLowerCase() !== platformAdminEmail) return response({ error: 'forbidden' }, 403)

  const admin = createClient(url, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } })
  const payload = await request.json().catch(() => null)
  if (!payload?.action) return response({ error: 'invalid_request' }, 400)

  if (payload.action === 'list') {
    const { data, error } = await admin.from('clinics')
      .select('id, name, slug, email, specialty, organization_type, status, phone, address, logo_url, primary_color, secondary_color, background_color, font_family, google_font_family, professional_council_registration, technical_responsible, clinic_council_registration, created_at, organization_memberships(count)')
      .order('created_at', { ascending: false })
    if (error) return response({ error: error.message }, 400)
    const organizations = (data ?? []).map((organization) => ({
      ...organization,
      membersCount: organization.organization_memberships?.[0]?.count ?? 0,
      organization_memberships: undefined,
    }))
    return response({ organizations })
  }

  if (payload.action === 'create') {
    const input = payload.input as CreateOrganizationInput
    if (!input || !input.name?.trim() || !input.ownerName?.trim() || !input.email?.trim() || !input.ownerEmail?.trim() ||
      !validSlug(input.slug) || !['clinic', 'professional'].includes(input.organizationType) || input.temporaryPassword?.length < 8) {
      return response({ error: 'invalid_organization_data' }, 400)
    }
    if (input.organizationType === 'professional' && !input.professionalCouncilRegistration?.trim()) {
      return response({ error: 'professional_council_registration_required' }, 400)
    }
    if (input.organizationType === 'clinic' && (!input.technicalResponsible?.trim() || !input.clinicCouncilRegistration?.trim())) {
      return response({ error: 'clinic_technical_registration_required' }, 400)
    }

    const { data: createdUser, error: createUserError } = await admin.auth.admin.createUser({
      email: input.ownerEmail.trim().toLowerCase(),
      password: input.temporaryPassword,
      email_confirm: true,
      user_metadata: { full_name: input.ownerName.trim() },
    })
    if (createUserError || !createdUser.user) return response({ error: createUserError?.message ?? 'user_creation_failed' }, 400)

    let stage = 'perfil do responsável'
    try {
      const ownerId = createdUser.user.id
      const { error: profileError } = await admin.from('profiles').upsert({
        id: ownerId, email: input.ownerEmail.trim().toLowerCase(), full_name: input.ownerName.trim(),
      })
      if (profileError) throw profileError

      stage = 'organização'
      const { data: organization, error: organizationError } = await admin.from('clinics').insert({
        name: input.name.trim(), slug: input.slug, email: input.email.trim().toLowerCase(),
        specialty: input.specialty?.trim() || null, organization_type: input.organizationType,
        phone: input.phone?.trim() || null, address: input.address?.trim() || null,
        professional_council_registration: input.organizationType === 'professional' ? input.professionalCouncilRegistration?.trim() : null,
        technical_responsible: input.organizationType === 'clinic' ? input.technicalResponsible?.trim() : null,
        clinic_council_registration: input.organizationType === 'clinic' ? input.clinicCouncilRegistration?.trim() : null,
        primary_color: input.primaryColor || '#0f766e', secondary_color: input.secondaryColor || '#0f5f59',
        background_color: input.backgroundColor || '#f8fafc', font_family: input.fontFamily || 'Inter',
        google_font_family: input.googleFontFamily?.trim() || null,
      }).select('id, name, slug, status, organization_type').single()
      if (organizationError || !organization) throw organizationError ?? new Error('organization_creation_failed')

      stage = 'vínculo do responsável'
      const { error: membershipError } = await admin.from('organization_memberships').insert({
        clinic_id: organization.id, user_id: ownerId, role: 'owner', active: true,
      })
      if (membershipError) throw membershipError

      if (input.organizationType === 'professional') {
        stage = 'cadastro do profissional'
        const { error: professionalError } = await admin.from('professionals').insert({
          clinic_id: organization.id, user_id: ownerId, name: input.ownerName.trim(), specialty: input.specialty?.trim() || null,
        })
        if (professionalError) throw professionalError
      }
      return response({ organization })
    } catch (error) {
      console.error(`Falha ao criar organização na etapa: ${stage}`, error)
      await admin.auth.admin.deleteUser(createdUser.user.id)
      return response({ error: `${stage}: ${errorMessage(error)}` }, 400)
    }
  }

  if (payload.action === 'update') {
    const input = payload.input
    const organizationId = Number(input?.id)
    if (!Number.isInteger(organizationId) || organizationId <= 0 || !input.name?.trim() || !validSlug(input.slug)) {
      return response({ error: 'invalid_organization_data' }, 400)
    }
    const { error } = await admin.from('clinics').update({
      name: input.name.trim(), slug: input.slug, email: input.email?.trim().toLowerCase() || null,
      specialty: input.specialty?.trim() || null, phone: input.phone?.trim() || null,
      address: input.address?.trim() || null, logo_url: input.logoUrl?.trim() || null,
      professional_council_registration: input.organizationType === 'professional' ? input.professionalCouncilRegistration?.trim() || null : null,
      technical_responsible: input.organizationType === 'clinic' ? input.technicalResponsible?.trim() || null : null,
      clinic_council_registration: input.organizationType === 'clinic' ? input.clinicCouncilRegistration?.trim() || null : null,
      primary_color: input.primaryColor || '#0f766e', secondary_color: input.secondaryColor || '#0f5f59',
      background_color: input.backgroundColor || '#f8fafc', font_family: input.fontFamily || 'Inter',
      google_font_family: input.googleFontFamily?.trim() || null,
    }).eq('id', organizationId)
    if (error) return response({ error: error.message }, 400)
    return response({ success: true })
  }

  if (payload.action === 'set-status') {
    const organizationId = Number(payload.organizationId)
    const status = payload.status
    if (!Number.isInteger(organizationId) || !['active', 'suspended', 'archived'].includes(status)) {
      return response({ error: 'invalid_status_change' }, 400)
    }
    const { error } = await admin.from('clinics').update({ status }).eq('id', organizationId)
    if (error) return response({ error: error.message }, 400)
    return response({ success: true })
  }

  return response({ error: 'unknown_action' }, 400)
})
