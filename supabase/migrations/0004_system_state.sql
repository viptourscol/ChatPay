-- ChatPay — estado del sistema (historyId de Gmail, etc.)
-- Ejecutar en el SQL editor de Supabase

create table if not exists public.system_state (
  key   text primary key,
  value text not null,
  updated_at timestamptz not null default now()
);

-- Solo service_role puede escribir; usuarios autenticados pueden leer
alter table public.system_state enable row level security;

create policy "auth read system_state" on public.system_state
  for select using (auth.role() = 'authenticated');

-- Valor inicial para el historyId de Gmail (se sobrescribirá en el primer watch)
insert into public.system_state (key, value)
  values ('gmail_history_id', '0')
  on conflict (key) do nothing;
