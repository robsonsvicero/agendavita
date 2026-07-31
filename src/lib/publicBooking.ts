import { supabase } from './supabase'

export type PublicClinic = {
  name: string
  specialty: string | null
  logo_url: string | null
  primary_color: string | null
  secondary_color: string | null
  background_color: string | null
  font_family: string | null
  google_font_family: string | null
}

export type PublicProfessional = {
  id: number
  name: string
}

export type PublicResource = {
  id: number
  name: string
  resource_type: string
}

export type PublicBookingInfo = {
  clinic: PublicClinic
  professionals: PublicProfessional[]
  resources: PublicResource[]
}

export async function callPublicBooking<T>(slug: string, body: Record<string, unknown>) {
  if (!supabase) throw new Error('Sistema não configurado.')

  const { data, error } = await supabase.functions.invoke('public-booking', { body: { slug, ...body } })
  if (error) {
    const response = (error as { context?: Response }).context
    const details = response instanceof Response ? await response.json().catch(() => null) as { error?: string } | null : null
    throw new Error(details?.error ?? error.message)
  }
  if (data?.error) throw new Error(data.error)
  return data as T
}

export function fetchPublicBookingInfo(slug: string) {
  return callPublicBooking<PublicBookingInfo>(slug, { action: 'info' })
}
