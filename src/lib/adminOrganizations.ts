import { supabase } from './supabase'

export type OrganizationStatus = 'active' | 'suspended' | 'archived'
export type OrganizationType = 'clinic' | 'professional'

export type Organization = {
  id: number
  name: string
  slug: string
  email: string | null
  specialty: string | null
  organization_type: OrganizationType
  status: OrganizationStatus
  phone: string | null
  address: string | null
  logo_url: string | null
  primary_color: string
  secondary_color: string
  background_color: string
  font_family: string
  google_font_family: string | null
  professional_council_registration: string | null
  technical_responsible: string | null
  clinic_council_registration: string | null
  created_at: string
  membersCount: number
}

export type OrganizationInput = {
  id?: number
  name: string
  slug: string
  email: string
  specialty: string
  phone: string
  address: string
  logoUrl?: string
  professionalCouncilRegistration?: string
  technicalResponsible?: string
  clinicCouncilRegistration?: string
  primaryColor?: string
  secondaryColor?: string
  backgroundColor?: string
  fontFamily?: string
  googleFontFamily?: string
  organizationType: OrganizationType
  ownerName?: string
  ownerEmail?: string
  temporaryPassword?: string
}

async function invoke<T>(body: Record<string, unknown>) {
  if (!supabase) throw new Error('Configure o Supabase antes de continuar.')
  const { data, error } = await supabase.functions.invoke('admin-organizations', { body })
  if (error) {
    const response = (error as { context?: Response }).context
    if (response instanceof Response) {
      const details = await response.json().catch(() => null) as { error?: string } | null
      throw new Error(details?.error ?? error.message)
    }
    throw error
  }
  if (data?.error) throw new Error(data.error)
  return data as T
}

export const listOrganizations = async () => (await invoke<{ organizations: Organization[] }>({ action: 'list' })).organizations
export const createOrganization = async (input: OrganizationInput) => invoke({ action: 'create', input })
export const updateOrganization = async (input: OrganizationInput) => invoke({ action: 'update', input })
export const setOrganizationStatus = async (organizationId: number, status: OrganizationStatus) => invoke({ action: 'set-status', organizationId, status })
