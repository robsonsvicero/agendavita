-- Adiciona os campos specialty e notes (observações) à tabela appointments se não existirem
alter table public.appointments
  add column if not exists specialty text,
  add column if not exists notes text;
