-- Agenda Vita — modelo multiempresa, permissões e agenda.
-- Execute em um projeto novo. Em uma base existente, faça backup e valide a migração antes.

create extension if not exists btree_gist;

do $$ begin
  create type public.organization_type as enum ('clinic', 'professional');
exception when duplicate_object then null; end $$;
do $$ begin
  create type public.organization_status as enum ('active', 'suspended', 'archived');
exception when duplicate_object then null; end $$;
do $$ begin
  create type public.membership_role as enum ('owner', 'manager', 'secretary', 'professional');
exception when duplicate_object then null; end $$;
do $$ begin
  create type public.resource_type as enum ('room', 'chair');
exception when duplicate_object then null; end $$;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null unique,
  full_name text,
  created_at timestamptz not null default now()
);

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, full_name)
  values (new.id, lower(new.email), new.raw_user_meta_data ->> 'full_name')
  on conflict (id) do update set email = excluded.email;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Inclui usuários que já existiam antes desta migração.
insert into public.profiles (id, email, full_name)
select id, lower(email), raw_user_meta_data ->> 'full_name'
from auth.users
on conflict (id) do update set email = excluded.email;

-- A autoridade global é deliberadamente fixa: somente este e-mail.
create or replace function public.is_platform_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select lower(coalesce(auth.jwt() ->> 'email', '')) = 'robsonsvicero@outlook.com';
$$;

create table if not exists public.clinics (
  id bigint generated always as identity primary key,
  name text not null,
  slug text not null unique check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  email text unique,
  specialty text,
  organization_type public.organization_type not null default 'clinic',
  status public.organization_status not null default 'active',
  logo_url text,
  phone text,
  address text,
  professional_council_registration text,
  technical_responsible text,
  clinic_council_registration text,
  created_at timestamptz not null default now()
);

create table if not exists public.organization_memberships (
  id bigint generated always as identity primary key,
  clinic_id bigint not null references public.clinics(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role public.membership_role not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (clinic_id, user_id)
);

create table if not exists public.professionals (
  id bigint generated always as identity primary key,
  clinic_id bigint not null references public.clinics(id) on delete cascade,
  user_id uuid unique references public.profiles(id) on delete set null,
  name text not null,
  specialty text,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.clinical_resources (
  id bigint generated always as identity primary key,
  clinic_id bigint not null references public.clinics(id) on delete cascade,
  name text not null,
  resource_type text not null,
  active boolean not null default true,
  unique (clinic_id, name)
);

-- Permite classificar recursos livremente (sala, cadeira, consultório, box etc.).
alter table public.clinical_resources alter column resource_type type text using resource_type::text;

create table if not exists public.appointment_types (
  id bigint generated always as identity primary key,
  clinic_id bigint not null references public.clinics(id) on delete cascade,
  professional_id bigint references public.professionals(id) on delete cascade,
  name text not null,
  duration_minutes integer not null check (duration_minutes between 5 and 480),
  interval_minutes integer not null default 0 check (interval_minutes between 0 and 240),
  active boolean not null default true
);

alter table public.appointment_types add column if not exists professional_id bigint references public.professionals(id) on delete cascade;
alter table public.appointment_types drop constraint if exists appointment_types_clinic_id_name_key;
create unique index if not exists one_active_appointment_configuration_per_professional
  on public.appointment_types (clinic_id, professional_id) where professional_id is not null and active;

create table if not exists public.working_hours (
  id bigint generated always as identity primary key,
  clinic_id bigint not null references public.clinics(id) on delete cascade,
  professional_id bigint references public.professionals(id) on delete cascade,
  weekday integer not null check (weekday between 0 and 6),
  start_time time not null,
  end_time time not null,
  check (start_time < end_time)
);

create table if not exists public.schedule_blocks (
  id bigint generated always as identity primary key,
  clinic_id bigint not null references public.clinics(id) on delete cascade,
  professional_id bigint references public.professionals(id) on delete cascade,
  resource_id bigint references public.clinical_resources(id) on delete cascade,
  starts_at timestamp not null,
  ends_at timestamp not null,
  reason text,
  check (starts_at < ends_at)
);

create table if not exists public.patients (
  id bigint generated always as identity primary key,
  clinic_id bigint not null references public.clinics(id) on delete cascade,
  name text not null,
  phone text not null,
  email text,
  address text,
  birth_date date,
  first_visit_date date,
  last_visit_date date,
  created_at timestamptz not null default now(),
  unique (clinic_id, phone)
);

alter table public.patients add column if not exists birth_date date;

create table if not exists public.appointments (
  id bigint generated always as identity primary key,
  clinic_id bigint not null references public.clinics(id) on delete cascade,
  patient_id bigint not null references public.patients(id) on delete restrict,
  professional_id bigint references public.professionals(id) on delete restrict,
  resource_id bigint references public.clinical_resources(id) on delete restrict,
  appointment_type_id bigint references public.appointment_types(id) on delete set null,
  date date not null,
  time time not null,
  duration_minutes integer not null default 30 check (duration_minutes between 5 and 480),
  interval_minutes integer not null default 0 check (interval_minutes between 0 and 240),
  status text not null default 'pending' check (status in ('pending', 'confirmed', 'cancelled', 'attended')),
  is_first_visit boolean not null default false,
  notes text,
  created_at timestamptz not null default now(),
  check (professional_id is not null or resource_id is not null)
);

alter table public.appointments add column if not exists interval_minutes integer not null default 0 check (interval_minutes between 0 and 240);
alter table public.appointments drop constraint if exists appointments_status_check;
alter table public.appointments add constraint appointments_status_check check (status in ('pending', 'confirmed', 'cancelled', 'attended'));

-- Migração compatível com a estrutura antiga: CREATE TABLE IF NOT EXISTS não
-- acrescenta colunas a tabelas que já existiam no projeto.
alter table public.clinics add column if not exists organization_type public.organization_type not null default 'clinic';
alter table public.clinics add column if not exists status public.organization_status not null default 'active';
alter table public.clinics add column if not exists logo_url text;
alter table public.clinics add column if not exists phone text;
alter table public.clinics add column if not exists address text;
alter table public.clinics add column if not exists professional_council_registration text;
alter table public.clinics add column if not exists technical_responsible text;
alter table public.clinics add column if not exists clinic_council_registration text;
-- A autenticação agora é gerenciada por auth.users; este campo pertencia ao
-- backend Express removido e não pode continuar obrigatório.
alter table public.clinics drop column if exists password_hash;

alter table public.working_hours add column if not exists professional_id bigint references public.professionals(id) on delete cascade;

alter table public.appointments add column if not exists professional_id bigint references public.professionals(id) on delete restrict;
alter table public.appointments add column if not exists resource_id bigint references public.clinical_resources(id) on delete restrict;
alter table public.appointments add column if not exists appointment_type_id bigint references public.appointment_types(id) on delete set null;
alter table public.appointments add column if not exists duration_minutes integer not null default 30 check (duration_minutes between 5 and 480);

create index if not exists idx_memberships_user on public.organization_memberships(user_id) where active;
create index if not exists idx_professionals_clinic on public.professionals(clinic_id) where active;
create index if not exists idx_appointments_clinic_date on public.appointments(clinic_id, date);
create index if not exists idx_patients_clinic_phone on public.patients(clinic_id, phone);
create unique index if not exists one_active_appointment_per_slot
  on public.appointments (clinic_id, date, time, professional_id)
  where status <> 'cancelled' and professional_id is not null;

-- RLS helpers. They centralize organization membership and suspension checks.
create or replace function public.has_organization_role(
  p_clinic_id bigint, p_roles public.membership_role[] default null, p_require_active_clinic boolean default false
) returns boolean language sql stable security definer set search_path = public as $$
  select public.is_platform_admin()
    or exists (
      select 1
      from public.organization_memberships m
      join public.clinics c on c.id = m.clinic_id
      where m.clinic_id = p_clinic_id and m.user_id = auth.uid() and m.active
        and (p_roles is null or m.role = any(p_roles))
        and (not p_require_active_clinic or c.status = 'active')
    );
$$;

create or replace function public.prevent_non_admin_status_change()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if old.status is distinct from new.status and not public.is_platform_admin() then
    raise exception 'only_platform_admin_can_change_organization_status';
  end if;
  return new;
end;
$$;

drop trigger if exists protect_clinic_status on public.clinics;
create trigger protect_clinic_status before update on public.clinics
  for each row execute procedure public.prevent_non_admin_status_change();

alter table public.profiles enable row level security;
alter table public.clinics enable row level security;
alter table public.organization_memberships enable row level security;
alter table public.professionals enable row level security;
alter table public.clinical_resources enable row level security;
alter table public.appointment_types enable row level security;
alter table public.working_hours enable row level security;
alter table public.schedule_blocks enable row level security;
alter table public.patients enable row level security;
alter table public.appointments enable row level security;

-- Permite reexecutar este arquivo após uma migração interrompida e remove
-- políticas permissivas da versão anterior.
drop policy if exists "public read clinics" on public.clinics;
drop policy if exists "public read working_hours" on public.working_hours;
drop policy if exists "public read patients" on public.patients;
drop policy if exists "public read appointments" on public.appointments;
drop policy if exists "public insert patients" on public.patients;
drop policy if exists "public insert appointments" on public.appointments;
drop policy if exists "authenticated full access" on public.clinics;
drop policy if exists "authenticated full access" on public.working_hours;
drop policy if exists "authenticated full access" on public.patients;
drop policy if exists "authenticated full access" on public.appointments;
drop policy if exists "owner manages own clinic" on public.clinics;
drop policy if exists "owner manages own hours" on public.working_hours;
drop policy if exists "owner reads own patients" on public.patients;
drop policy if exists "owner updates own patients" on public.patients;
drop policy if exists "owner reads own appointments" on public.appointments;
drop policy if exists "owner updates own appointments" on public.appointments;
drop policy if exists "profile is visible to its user" on public.profiles;
drop policy if exists "profile owner updates own profile" on public.profiles;
drop policy if exists "platform admin manages organizations" on public.clinics;
drop policy if exists "members view own organization" on public.clinics;
drop policy if exists "owners manage organization profile" on public.clinics;
drop policy if exists "platform admin manages memberships" on public.organization_memberships;
drop policy if exists "members view organization memberships" on public.organization_memberships;
drop policy if exists "members view professionals" on public.professionals;
drop policy if exists "managers manage professionals" on public.professionals;
drop policy if exists "members view resources" on public.clinical_resources;
drop policy if exists "managers manage resources" on public.clinical_resources;
drop policy if exists "members view appointment types" on public.appointment_types;
drop policy if exists "managers manage appointment types" on public.appointment_types;
drop policy if exists "members view working hours" on public.working_hours;
drop policy if exists "managers manage working hours" on public.working_hours;
drop policy if exists "members view schedule blocks" on public.schedule_blocks;
drop policy if exists "managers manage schedule blocks" on public.schedule_blocks;
drop policy if exists "members view patients" on public.patients;
drop policy if exists "staff manage patients" on public.patients;
drop policy if exists "members view appointments" on public.appointments;
drop policy if exists "staff manage appointments" on public.appointments;

create policy "profile is visible to its user" on public.profiles for select to authenticated
  using (id = auth.uid() or public.is_platform_admin());
create policy "profile owner updates own profile" on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

create policy "platform admin manages organizations" on public.clinics for all to authenticated
  using (public.is_platform_admin()) with check (public.is_platform_admin());
create policy "members view own organization" on public.clinics for select to authenticated
  using (public.has_organization_role(id));
create policy "owners manage organization profile" on public.clinics for update to authenticated
  using (public.has_organization_role(id, array['owner', 'manager']::public.membership_role[]))
  with check (public.has_organization_role(id, array['owner', 'manager']::public.membership_role[]));

create policy "platform admin manages memberships" on public.organization_memberships for all to authenticated
  using (public.is_platform_admin()) with check (public.is_platform_admin());
create policy "members view organization memberships" on public.organization_memberships for select to authenticated
  using (public.has_organization_role(clinic_id));

create policy "members view professionals" on public.professionals for select to authenticated
  using (public.has_organization_role(clinic_id));
create policy "managers manage professionals" on public.professionals for all to authenticated
  using (public.has_organization_role(clinic_id, array['owner', 'manager']::public.membership_role[], true))
  with check (public.has_organization_role(clinic_id, array['owner', 'manager']::public.membership_role[], true));

create policy "members view resources" on public.clinical_resources for select to authenticated
  using (public.has_organization_role(clinic_id));
create policy "managers manage resources" on public.clinical_resources for all to authenticated
  using (public.has_organization_role(clinic_id, array['owner', 'manager']::public.membership_role[], true))
  with check (public.has_organization_role(clinic_id, array['owner', 'manager']::public.membership_role[], true));

create policy "members view appointment types" on public.appointment_types for select to authenticated
  using (public.has_organization_role(clinic_id));
create policy "managers manage appointment types" on public.appointment_types for all to authenticated
  using (public.has_organization_role(clinic_id, array['owner', 'manager']::public.membership_role[], true))
  with check (public.has_organization_role(clinic_id, array['owner', 'manager']::public.membership_role[], true));

create policy "members view working hours" on public.working_hours for select to authenticated
  using (public.has_organization_role(clinic_id));
create policy "managers manage working hours" on public.working_hours for all to authenticated
  using (public.has_organization_role(clinic_id, array['owner', 'manager']::public.membership_role[], true))
  with check (public.has_organization_role(clinic_id, array['owner', 'manager']::public.membership_role[], true));

create policy "members view schedule blocks" on public.schedule_blocks for select to authenticated
  using (public.has_organization_role(clinic_id));
create policy "managers manage schedule blocks" on public.schedule_blocks for all to authenticated
  using (public.has_organization_role(clinic_id, array['owner', 'manager', 'secretary']::public.membership_role[], true))
  with check (public.has_organization_role(clinic_id, array['owner', 'manager', 'secretary']::public.membership_role[], true));

create policy "members view patients" on public.patients for select to authenticated
  using (public.has_organization_role(clinic_id));
create policy "staff manage patients" on public.patients for all to authenticated
  using (public.has_organization_role(clinic_id, array['owner', 'manager', 'secretary', 'professional']::public.membership_role[], true))
  with check (public.has_organization_role(clinic_id, array['owner', 'manager', 'secretary', 'professional']::public.membership_role[], true));

create policy "members view appointments" on public.appointments for select to authenticated
  using (public.has_organization_role(clinic_id));
create policy "staff manage appointments" on public.appointments for all to authenticated
  using (public.has_organization_role(clinic_id, array['owner', 'manager', 'secretary', 'professional']::public.membership_role[], true))
  with check (public.has_organization_role(clinic_id, array['owner', 'manager', 'secretary', 'professional']::public.membership_role[], true));

-- Logotipos são públicos para exibição, mas somente dono/gestor da organização
-- correspondente pode criar, substituir ou remover arquivos.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('organization-logos', 'organization-logos', true, 2097152, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set public = true, file_size_limit = 2097152,
  allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp'];

drop policy if exists "public reads organization logos" on storage.objects;
drop policy if exists "managers upload organization logos" on storage.objects;
drop policy if exists "managers update organization logos" on storage.objects;
drop policy if exists "managers delete organization logos" on storage.objects;
create policy "public reads organization logos" on storage.objects for select
  using (bucket_id = 'organization-logos');
create policy "managers upload organization logos" on storage.objects for insert to authenticated
  with check (bucket_id = 'organization-logos' and public.has_organization_role(
    split_part(name, '/', 1)::bigint, array['owner', 'manager']::public.membership_role[], true));
create policy "managers update organization logos" on storage.objects for update to authenticated
  using (bucket_id = 'organization-logos' and public.has_organization_role(
    split_part(name, '/', 1)::bigint, array['owner', 'manager']::public.membership_role[], true));
create policy "managers delete organization logos" on storage.objects for delete to authenticated
  using (bucket_id = 'organization-logos' and public.has_organization_role(
    split_part(name, '/', 1)::bigint, array['owner', 'manager']::public.membership_role[], true));

-- The browser must not write clinical data directly without a role.
revoke all on public.clinics, public.organization_memberships, public.professionals,
  public.clinical_resources, public.appointment_types, public.working_hours,
  public.schedule_blocks, public.patients, public.appointments from anon;
