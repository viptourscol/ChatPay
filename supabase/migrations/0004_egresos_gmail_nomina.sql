-- ───────────────────────────────────────────────────────────────────────────
-- 0004_egresos_gmail_nomina
--
-- Cambios:
--   1. companies.admin_whatsapp  → número para alertas de pagos falsos/duplicados
--   2. egresos.company_id        → FK a companies (necesario para sync Gmail)
--   3. egresos.source            → 'manual' | 'gmail'
--   4. egresos.gmail_message_id  → deduplicación de emails procesados
-- ───────────────────────────────────────────────────────────────────────────

-- 1. Campo en companies para alertas WhatsApp al admin
alter table public.companies
  add column if not exists admin_whatsapp text;

-- 2-4. Columnas en egresos para soporte Gmail auto
alter table public.egresos
  add column if not exists company_id       uuid references public.companies(id) on delete set null,
  add column if not exists source           text not null default 'manual'
                             check (source in ('manual', 'gmail')),
  add column if not exists gmail_message_id text;

-- Índice único para evitar duplicados por email bancario
create unique index if not exists idx_egresos_gmail_msg
  on public.egresos(gmail_message_id)
  where gmail_message_id is not null;

-- Índice para consultas por empresa (reportes de nómina y sync Gmail)
create index if not exists idx_egresos_company_id
  on public.egresos(company_id);

-- RLS: asegurarse de que egresos solo sean visibles por la empresa correcta
-- (política existente probablemente ya usa user_id; esta migración no la toca)
