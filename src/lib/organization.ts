import { supabase } from './supabase'

export type MembershipRole = 'owner' | 'manager' | 'secretary' | 'professional'
export type OrganizationProfile = {
  id: number
  name: string
  slug: string
  email: string | null
  specialty: string | null
  organization_type: 'clinic' | 'professional'
  status: 'active' | 'suspended' | 'archived'
  logo_url: string | null
  phone: string | null
  address: string | null
  professional_council_registration: string | null
  technical_responsible: string | null
  clinic_council_registration: string | null
}
export type OrganizationMembership = { clinic_id: number, role: MembershipRole, clinic: OrganizationProfile }

export async function listMyOrganizations(userId: string): Promise<OrganizationMembership[]> {
  if (!supabase) throw new Error('Configure o Supabase antes de continuar.')
  const { data, error } = await supabase.from('organization_memberships')
    .select('clinic_id, role, clinics(id, name, slug, email, specialty, organization_type, status, logo_url, phone, address, professional_council_registration, technical_responsible, clinic_council_registration)')
    .eq('user_id', userId).eq('active', true)
  if (error) throw error
  return (data ?? []).flatMap((membership) => {
    const clinic = Array.isArray(membership.clinics) ? membership.clinics[0] : membership.clinics
    return clinic ? [{ clinic_id: membership.clinic_id, role: membership.role as MembershipRole, clinic: clinic as OrganizationProfile }] : []
  })
}

export async function updateOrganizationProfile(profile: OrganizationProfile) {
  if (!supabase) throw new Error('Configure o Supabase antes de continuar.')
  const { error } = await supabase.from('clinics').update({
    name: profile.name.trim(), email: profile.email?.trim() || null, specialty: profile.specialty?.trim() || null,
    phone: profile.phone?.trim() || null, address: profile.address?.trim() || null,
    professional_council_registration: profile.organization_type === 'professional' ? profile.professional_council_registration?.trim() || null : null,
    technical_responsible: profile.organization_type === 'clinic' ? profile.technical_responsible?.trim() || null : null,
    clinic_council_registration: profile.organization_type === 'clinic' ? profile.clinic_council_registration?.trim() || null : null,
  }).eq('id', profile.id)
  if (error) throw error
}

export async function uploadOrganizationLogo(clinicId: number, file: File) {
  if (!supabase) throw new Error('Configure o Supabase antes de continuar.')
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 2 * 1024 * 1024) {
    throw new Error('Use uma imagem JPG, PNG ou WEBP de até 2 MB.')
  }
  const extension = file.name.split('.').pop()?.toLowerCase() || 'png'
  const path = `${clinicId}/logo-${Date.now()}.${extension}`
  const { error: uploadError } = await supabase.storage.from('organization-logos').upload(path, file, { contentType: file.type })
  if (uploadError) throw uploadError
  const { data } = supabase.storage.from('organization-logos').getPublicUrl(path)
  const { error: updateError } = await supabase.from('clinics').update({ logo_url: data.publicUrl }).eq('id', clinicId)
  if (updateError) throw updateError
  return data.publicUrl
}
