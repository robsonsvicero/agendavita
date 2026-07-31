import { supabase } from './supabase'

export type Patient = { id: number, name: string, phone: string, email: string | null, address: string | null, birth_date: string | null, first_visit_date: string | null, last_visit_date: string | null, created_at: string }
export type PatientInput = { id?: number, name: string, phone: string, email: string, address: string, birthDate: string }
const requireClient = () => { if (!supabase) throw new Error('Configure o Supabase antes de continuar.'); return supabase }
export async function listPatients(clinicId: number) { const { data, error } = await requireClient().from('patients').select('id, name, phone, email, address, birth_date, first_visit_date, last_visit_date, created_at').eq('clinic_id', clinicId).order('name'); if (error) throw error; return data as Patient[] }
export async function savePatient(clinicId: number, input: PatientInput) { const client = requireClient(); const payload = { name: input.name.trim(), phone: input.phone.trim(), email: input.email.trim() || null, address: input.address.trim() || null, birth_date: input.birthDate || null }; const query = input.id ? client.from('patients').update(payload).eq('id', input.id) : client.from('patients').insert({ clinic_id: clinicId, ...payload }); const { error } = await query; if (error) throw error }
export async function deletePatient(id: number) { const { error } = await requireClient().from('patients').delete().eq('id', id); if (error) throw error }
