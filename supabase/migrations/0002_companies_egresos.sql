-- ChatPay — empresas y egresos
-- Ejecutar en el SQL editor de Supabase

-- ============================
-- Tabla companies (información de la empresa del usuario)
-- ============================
create table if not exists public.companies (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null default '',
  nit text,
  tax_regime text,   -- 'simplificado' | 'comun' | 'gran_contribuyente' | etc.
  address text,
  phone text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists idx_companies_user on public.companies(user_id);

-- ============================
-- Tabla egresos (gastos registrados manualmente)
-- ============================
create table if not exists public.egresos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  description text not null,
  amount numeric(14,2) not null,
  recipient text,
  payment_date date not null default current_date,
  method text not null default 'transferencia',  -- 'transferencia' | 'efectivo' | 'tarjeta' | 'cheque'
  category text,                                  -- 'nomina' | 'arriendo' | 'servicios' | 'proveedor' | 'otro'
  notes text,
  receipt_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_egresos_user_date on public.egresos(user_id, payment_date desc);
create index if not exists idx_egresos_category on public.egresos(category);

-- ============================
-- RLS
-- ============================
alter table public.companies enable row level security;
alter table public.egresos enable row level security;

-- Companies: cada usuario solo ve/modifica la suya
create policy "own company select" on public.companies
  for select using (auth.uid() = user_id);

create policy "own company insert" on public.companies
  for insert with check (auth.uid() = user_id);

create policy "own company update" on public.companies
  for update using (auth.uid() = user_id);

-- Egresos: cada usuario solo ve/gestiona los suyos
create policy "own egresos select" on public.egresos
  for select using (auth.uid() = user_id);

create policy "own egresos insert" on public.egresos
  for insert with check (auth.uid() = user_id);

create policy "own egresos update" on public.egresos
  for update using (auth.uid() = user_id);

create policy "own egresos delete" on public.egresos
  for delete using (auth.uid() = user_id);

-- ============================
-- Función helper: auto-update updated_at
-- ============================
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger companies_updated_at
  before update on public.companies
  for each row execute function public.set_updated_at();

create trigger egresos_updated_at
  before update on public.egresos
  for each row execute function public.set_updated_at();
