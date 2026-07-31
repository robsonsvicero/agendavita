import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
const response = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
const errorMessage = (error: unknown) => error instanceof Error ? error.message : typeof error === 'object' && error && 'message' in error && typeof error.message === 'string' ? error.message : JSON.stringify(error)

async function managerCanOperate(caller: ReturnType<typeof createClient>, clinicId: number, userId: string) {
  const { data: membership } = await caller.from('organization_memberships').select('role, active, clinics(status)').eq('clinic_id', clinicId).eq('user_id', userId).maybeSingle()
  const clinic = Array.isArray(membership?.clinics) ? membership?.clinics[0] : membership?.clinics
  return Boolean(membership?.active && clinic?.status === 'active' && ['owner', 'manager'].includes(membership.role))
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (request.method !== 'POST') return response({ error: 'method_not_allowed' }, 405)
  const authorization = request.headers.get('Authorization')
  if (!authorization?.startsWith('Bearer ')) return response({ error: 'unauthorized' }, 401)

  const url = Deno.env.get('SUPABASE_URL')!
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const caller = createClient(url, anonKey, { global: { headers: { Authorization: authorization } } })
  const { data: { user } } = await caller.auth.getUser()
  if (!user) return response({ error: 'unauthorized' }, 401)
  const payload = await request.json().catch(() => null)
  const clinicId = Number(payload?.clinicId)
  if (!Number.isInteger(clinicId) || clinicId <= 0) return response({ error: 'invalid_clinic' }, 400)

  const manager = await managerCanOperate(caller, clinicId, user.id)
  if (!manager) return response({ error: 'forbidden' }, 403)
  const admin = createClient(url, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } })

  if (payload.action === 'list') {
    const { data, error } = await admin.from('organization_memberships')
      .select('id, user_id, role, active, created_at, profiles(full_name, email)')
      .eq('clinic_id', clinicId).order('created_at')
    if (error) return response({ error: error.message }, 400)
    return response({ members: data ?? [] })
  }

  if (payload.action === 'invite') {
    const input = payload.input
    if (!input?.name?.trim() || !input?.email?.trim() || !['secretary', 'professional'].includes(input.role) || input.temporaryPassword?.length < 8) {
      return response({ error: 'invalid_member_data' }, 400)
    }
    const { data: created, error: createError } = await admin.auth.admin.createUser({
      email: input.email.trim().toLowerCase(), password: input.temporaryPassword, email_confirm: true,
      user_metadata: { full_name: input.name.trim() },
    })
    if (createError || !created.user) return response({ error: createError?.message ?? 'user_creation_failed' }, 400)
    try {
      const userId = created.user.id
      let stage = 'perfil'
      const { error: profileError } = await admin.from('profiles').upsert({ id: userId, email: input.email.trim().toLowerCase(), full_name: input.name.trim() })
      if (profileError) throw profileError
      stage = 'vínculo de acesso'
      const { error: membershipError } = await admin.from('organization_memberships').insert({ clinic_id: clinicId, user_id: userId, role: input.role, active: true })
      if (membershipError) throw membershipError
      if (input.role === 'professional') {
        stage = 'cadastro profissional'
        const { error: professionalError } = await admin.from('professionals').insert({ clinic_id: clinicId, user_id: userId, name: input.name.trim(), specialty: input.specialty?.trim() || null })
        if (professionalError) throw professionalError
      }
      return response({ success: true })
    } catch (error) {
      await admin.auth.admin.deleteUser(created.user.id)
      return response({ error: `${stage}: ${errorMessage(error)}` }, 400)
    }
  }

  if (payload.action === 'set-active') {
    const memberId = Number(payload.memberId)
    if (!Number.isInteger(memberId) || typeof payload.active !== 'boolean') return response({ error: 'invalid_member' }, 400)
    const { data: target, error: targetError } = await admin.from('organization_memberships').select('role').eq('id', memberId).eq('clinic_id', clinicId).maybeSingle()
    if (targetError || !target) return response({ error: 'member_not_found' }, 404)
    if (target.role === 'owner') return response({ error: 'owner_membership_cannot_be_changed' }, 400)
    const { error } = await admin.from('organization_memberships').update({ active: payload.active }).eq('id', memberId).eq('clinic_id', clinicId)
    if (error) return response({ error: error.message }, 400)
    return response({ success: true })
  }

  return response({ error: 'unknown_action' }, 400)
})
