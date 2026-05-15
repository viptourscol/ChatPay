-- ChatPay — esquema inicial
-- Ejecutar en el SQL editor de Supabase

create extension if not exists "pgcrypto";

-- ============================
-- Empleados autorizados
-- ============================
create table if not exists public.employees (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  whatsapp_number text not null unique, -- formato E.164: +573001234567
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists idx_employees_whatsapp on public.employees(whatsapp_number);

-- ============================
-- Transacciones REALES (parseadas de emails Bancolombia)
-- ============================
create table if not exists public.transactions (
  id uuid primary key default gen_random_uuid(),
  amount numeric(14,2) not null,
  reference_number text unique,
  transaction_date timestamptz not null,
  sender_name text,
  raw_subject text,
  raw_snippet text,
  gmail_message_id text unique,
  created_at timestamptz not null default now()
);

create index if not exists idx_transactions_amount_date on public.transactions(amount, transaction_date);
create index if not exists idx_transactions_reference on public.transactions(reference_number);

-- ============================
-- Verificaciones (cada vez que un empleado envía un comprobante)
-- ============================
create type verification_status as enum ('real', 'fake', 'duplicate', 'pending', 'error');

create table if not exists public.verifications (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid references public.employees(id) on delete set null,
  transaction_id uuid references public.transactions(id) on delete set null,
  status verification_status not null default 'pending',
  extracted_amount numeric(14,2),
  extracted_reference text,
  extracted_date timestamptz,
  extracted_sender text,
  comprobante_image_url text,
  whatsapp_message_id text unique,
  whatsapp_from text, -- número crudo si el empleado no estaba registrado
  response_text text,
  notes text,
  created_at timestamptz not null default now()
);

create index if not exists idx_verifications_status on public.verifications(status);
create index if not exists idx_verifications_employee on public.verifications(employee_id);
create index if not exists idx_verifications_created on public.verifications(created_at desc);

-- ============================
-- RLS — solo service_role puede escribir; usuarios autenticados pueden leer todo
-- ============================
alter table public.employees enable row level security;
alter table public.transactions enable row level security;
alter table public.verifications enable row level security;

create policy "auth read employees" on public.employees for select using (auth.role() = 'authenticated');
create policy "auth read transactions" on public.transactions for select using (auth.role() = 'authenticated');
create policy "auth read verifications" on public.verifications for select using (auth.role() = 'authenticated');

-- ============================
-- Storage bucket para comprobantes (crear desde dashboard Supabase)
-- Nombre: comprobantes (privado)
-- ============================
