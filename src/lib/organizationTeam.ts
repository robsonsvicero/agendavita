import { supabase } from './supabase'

export type Professional = { id: number, name: string, specialty: string | null, active: boolean, user_id: string | null }
export type ClinicalResource = { id: number, name: string, resource_type: string, active: boolean }
export type OrganizationMember = { id: number, user_id: string, role: 'owner' | 'manager' | 'secretary' | 'professional', active: boolean, profiles: { full_name: string | null, email: string } | null }

const requireClient = () => { if (!supabase) throw new Error('Configure o Supabase antes de continuar.'); return supabase }
async function invoke<T>(body: Record<string, unknown>) {
  const { data, error } = await requireClient().functions.invoke('organization-members', { body })
  if (error) { const context = (error as { context?: Response }).context; const details = context instanceof Response ? await context.json().catch(() => null) as { error?: string } | null : null; throw new Error(details?.error ?? error.message) }
  if (data?.error) throw new Error(data.error)
  return data as T
}
export const listMembers = async (clinicId: number) => (await invoke<{ members: OrganizationMember[] }>({ action: 'list', clinicId })).members
export const inviteMember = async (clinicId: number, input: { name: string, email: string, temporaryPassword: string, role: 'secretary' | 'professional', specialty?: string }) => invoke({ action: 'invite', clinicId, input })
export const setMemberActive = async (clinicId: number, memberId: number, active: boolean) => invoke({ action: 'set-active', clinicId, memberId, active })
export async function listProfessionals(clinicId: number) { const { data, error } = await requireClient().from('professionals').select('id, name, specialty, active, user_id').eq('clinic_id', clinicId).order('name'); if (error) throw error; return data as Professional[] }
export async function saveProfessional(clinicId: number, input: { id?: number, name: string, specialty: string }) { const client = requireClient(); const query = input.id ? client.from('professionals').update({ name: input.name, specialty: input.specialty || null }).eq('id', input.id) : client.from('professionals').insert({ clinic_id: clinicId, name: input.name, specialty: input.specialty || null }); const { error } = await query; if (error) throw error }
export async function setProfessionalActive(id: number, active: boolean) { const { error } = await requireClient().from('professionals').update({ active }).eq('id', id); if (error) throw error }
export async function listResources(clinicId: number) { const { data, error } = await requireClient().from('clinical_resources').select('id, name, resource_type, active').eq('clinic_id', clinicId).order('name'); if (error) throw error; return data as ClinicalResource[] }
export async function saveResource(clinicId: number, input: { name: string, resourceType: string }) { const { error } = await requireClient().from('clinical_resources').insert({ clinic_id: clinicId, name: input.name, resource_type: input.resourceType.trim() }); if (error) throw error }
export async function setResourceActive(id: number, active: boolean) { const { error } = await requireClient().from('clinical_resources').update({ active }).eq('id', id); if (error) throw error }
