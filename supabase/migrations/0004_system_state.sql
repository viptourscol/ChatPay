-- ChatPay — estado del sistema (historyId de Gmail, etc.)
-- Ejecutar en el SQL editor de Supabase

create table if not exists public.system_state (
  key   text primary key,
  value text not null,
  updated_at timestamptz not null default now()
);

-- Solo service_role debe acceder a esta tabla.
-- Con RLS activa y sin policies de lectura para authenticated,
-- los clientes no pueden consultar estado global entre tenants.
alter table public.system_state enable row level security;

do $$ begin
  if exists (
    select 1 from pg_policies
    where tablename = 'system_state' and policyname = 'auth read system_state'
  ) then
    execute 'drop policy "auth read system_state" on public.system_state';
  end if;
end $$;

-- Valor inicial para el historyId de Gmail (se sobrescribirá en el primer watch)
insert into public.system_state (key, value)
  values ('gmail_history_id', '0')
  on conflict (key) do nothing;
