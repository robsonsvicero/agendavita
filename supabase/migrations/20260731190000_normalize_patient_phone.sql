-- Deduplicação de pacientes: normalização de telefone
-- Adiciona coluna phone_normalized (apenas dígitos) e troca a constraint de unicidade.
-- Isso evita que "(11) 9 8765-4321" e "11987654321" criem dois registros distintos.

-- 1. Adiciona a coluna gerada com apenas os dígitos do telefone
alter table public.patients
  add column if not exists phone_normalized text
  generated always as (regexp_replace(phone, '[^0-9]', '', 'g')) stored;

-- 2. Remove a constraint antiga baseada no telefone bruto
alter table public.patients
  drop constraint if exists patients_clinic_id_phone_key;

-- 3. Remove o índice antigo (criado via schema.sql como UNIQUE constraint)
drop index if exists patients_clinic_id_phone_key;

-- 4. Cria o novo índice único na versão normalizada
create unique index if not exists patients_clinic_id_phone_normalized_key
  on public.patients (clinic_id, phone_normalized);

-- 5. Recria o índice de busca (o antigo idx_patients_clinic_phone permanece útil
--    para buscas por telefone bruto, mas o de deduplicação é o normalized)
create index if not exists idx_patients_clinic_phone_normalized
  on public.patients (clinic_id, phone_normalized);
