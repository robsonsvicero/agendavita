create table if not exists clinics (
  id bigint generated always as identity primary key,
  name text not null,
  slug text not null unique,
  email text unique,
  specialty text,
  created_at timestamptz default now()
);

create table if not exists working_hours (
  id bigint generated always as identity primary key,
  clinic_id bigint references clinics(id) on delete cascade,
  weekday integer not null check (weekday between 0 and 6),
  start_time text not null,
  end_time text not null,
  slot_minutes integer default 30
);

create table if not exists patients (
  id bigint generated always as identity primary key,
  clinic_id bigint references clinics(id) on delete cascade,
  name text not null,
  phone text not null,
  email text,
  address text,
  first_visit_date date,
  last_visit_date date,
  created_at timestamptz default now(),
  unique (clinic_id, phone)
);

create table if not exists appointments (
  id bigint generated always as identity primary key,
  clinic_id bigint references clinics(id) on delete cascade,
  patient_id bigint references patients(id) on delete cascade,
  date date not null,
  time text not null,
  type text default 'normal',
  status text default 'pending',
  is_first_visit boolean default false,
  notes text,
  created_at timestamptz default now()
);

alter table clinics enable row level security;
alter table working_hours enable row level security;
alter table patients enable row level security;
alter table appointments enable row level security;

create policy "public read clinics" on clinics for select using (true);
create policy "public read working_hours" on working_hours for select using (true);
create policy "public read patients" on patients for select using (true);
create policy "public read appointments" on appointments for select using (true);

create policy "public insert patients" on patients for insert with check (true);
create policy "public insert appointments" on appointments for insert with check (true);
create policy "authenticated full access" on clinics for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "authenticated full access" on working_hours for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "authenticated full access" on patients for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "authenticated full access" on appointments for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
