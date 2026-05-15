-- ChatPay — agregar status a transactions
-- Ejecutar en el SQL editor de Supabase

-- Tipo enum para el estado de la transacción
create type transaction_status as enum ('pending', 'confirmed');

-- Agregar columna status con default 'pending'
alter table public.transactions
  add column if not exists status transaction_status not null default 'pending';

-- Las transacciones ya existentes quedan en 'pending'
create index if not exists idx_transactions_status on public.transactions(status);

-- Vista útil: solo pendientes
create or replace view public.transactions_pending as
  select * from public.transactions where status = 'pending';
