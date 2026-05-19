-- ChatPay — migración multi-tenant
-- Ejecutar en el SQL editor de Supabase

-- ============================
-- 1. Ampliar tabla companies
-- ============================
alter table public.companies
  add column if not exists email_alias    text unique,          -- slug único, ej: "empresa1" → empresa1@chatpay.co
  add column if not exists plan           text not null default 'free',   -- free | starter | pro
  add column if not exists max_employees  int  not null default 3,
  add column if not exists is_active      boolean not null default true;

-- Asignar email_alias al tenant existente (basado en id de la empresa)
update public.companies
set email_alias = lower(regexp_replace(name, '[^a-zA-Z0-9]', '', 'g'))
where email_alias is null;

-- ============================
-- 2. Agregar company_id a employees
-- ============================
alter table public.employees
  add column if not exists company_id uuid references public.companies(id) on delete cascade;

create index if not exists idx_employees_company on public.employees(company_id);

-- Asignar empleados existentes al único tenant actual
update public.employees e
set company_id = (select id from public.companies limit 1)
where e.company_id is null;

-- ============================
-- 3. Agregar company_id a transactions
-- ============================
alter table public.transactions
  add column if not exists company_id uuid references public.companies(id) on delete cascade;

create index if not exists idx_transactions_company on public.transactions(company_id);

-- Asignar transacciones existentes al único tenant actual
update public.transactions t
set company_id = (select id from public.companies limit 1)
where t.company_id is null;

-- ============================
-- 4. Agregar company_id a verifications
-- ============================
alter table public.verifications
  add column if not exists company_id uuid references public.companies(id) on delete cascade;

create index if not exists idx_verifications_company on public.verifications(company_id);

-- Asignar verificaciones existentes al único tenant actual
update public.verifications v
set company_id = (select id from public.companies limit 1)
where v.company_id is null;

-- ============================
-- 5. Agregar company_id a disambiguations (si existe)
-- ============================
alter table public.disambiguations
  add column if not exists company_id uuid references public.companies(id) on delete cascade;

create index if not exists idx_disambiguations_company on public.disambiguations(company_id);

update public.disambiguations d
set company_id = (select id from public.companies limit 1)
where d.company_id is null;

-- ============================
-- 6. Tabla subscriptions (cobros manuales por ahora)
-- ============================
create table if not exists public.subscriptions (
  id           uuid primary key default gen_random_uuid(),
  company_id   uuid not null references public.companies(id) on delete cascade,
  plan         text not null default 'free',
  valid_until  date,
  paid_via     text,    -- 'transferencia' | 'efectivo' | etc.
  amount_paid  numeric(14,2),
  notes        text,
  created_at   timestamptz not null default now()
);

alter table public.subscriptions enable row level security;
create policy "auth read subscriptions" on public.subscriptions
  for select using (auth.role() = 'authenticated');

-- ============================
-- 7. Actualizar RLS — employees
-- ============================
drop policy if exists "auth read employees" on public.employees;

create policy "company read employees" on public.employees
  for select using (
    company_id in (
      select id from public.companies where user_id = auth.uid()
    )
  );

-- ============================
-- 8. Actualizar RLS — transactions
-- ============================
drop policy if exists "auth read transactions" on public.transactions;

create policy "company read transactions" on public.transactions
  for select using (
    company_id in (
      select id from public.companies where user_id = auth.uid()
    )
  );

-- ============================
-- 9. Actualizar RLS — verifications
-- ============================
drop policy if exists "auth read verifications" on public.verifications;

create policy "company read verifications" on public.verifications
  for select using (
    company_id in (
      select id from public.companies where user_id = auth.uid()
    )
  );
