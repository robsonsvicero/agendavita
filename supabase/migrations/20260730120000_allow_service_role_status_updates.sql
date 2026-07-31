drop trigger if exists protect_clinic_status on public.clinics;
drop function if exists public.prevent_non_admin_status_change();
