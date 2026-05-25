-- 0015: Respaldo por SMS bancarios
-- Ejecutar en el SQL editor de Supabase

-- ============================
-- 1. Columnas en companies
-- ============================
ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS sms_webhook_token uuid NOT NULL DEFAULT gen_random_uuid(),
  ADD COLUMN IF NOT EXISTS sms_phone_number  text;

-- Asegurar que el token sea único
CREATE UNIQUE INDEX IF NOT EXISTS idx_companies_sms_token ON public.companies(sms_webhook_token);

-- ============================
-- 2. Tabla transaction_sms
-- ============================
CREATE TABLE IF NOT EXISTS public.transaction_sms (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id     uuid        NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  transaction_id uuid        REFERENCES public.transactions(id) ON DELETE SET NULL,
  raw_text       text        NOT NULL,
  bank           text,
  amount         numeric(14,2),
  reference      text,
  sender_name    text,
  received_at    timestamptz NOT NULL DEFAULT now(),
  source         text        NOT NULL DEFAULT 'android', -- 'android' | 'ios' | 'manual'
  status         text        NOT NULL DEFAULT 'pending_match',
  -- 'linked'        → vinculado a una transacción
  -- 'pending_match' → SMS llegó antes que el email, esperando match
  -- 'ignored'       → la transacción ya estaba verificada como real
  created_at     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sms_company   ON public.transaction_sms(company_id);
CREATE INDEX IF NOT EXISTS idx_sms_reference ON public.transaction_sms(reference) WHERE reference IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_sms_status    ON public.transaction_sms(status);

-- Solo el superadmin (service_role) puede leer esta tabla
-- Los usuarios normales no tienen acceso (RLS bloqueante sin políticas)
ALTER TABLE public.transaction_sms ENABLE ROW LEVEL SECURITY;
