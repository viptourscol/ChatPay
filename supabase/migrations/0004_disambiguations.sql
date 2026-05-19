-- Tabla para guardar estado de desambiguación cuando hay múltiples
-- transacciones con el mismo monto y no se puede determinar cuál es.
-- El empleado responde con un número y el webhook resuelve.

create table if not exists public.disambiguations (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid references public.employees(id) on delete cascade,
  whatsapp_from text not null,
  candidate_ids uuid[] not null,          -- IDs de las transacciones candidatas en orden
  comprobante_image_url text,
  extracted_amount numeric(14,2),
  extracted_reference text,
  extracted_date timestamptz,
  extracted_sender text,
  resolved boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists idx_disambiguations_whatsapp on public.disambiguations(whatsapp_from, resolved);

alter table public.disambiguations enable row level security;
create policy "auth read disambiguations" on public.disambiguations for select using (auth.role() = 'authenticated');
