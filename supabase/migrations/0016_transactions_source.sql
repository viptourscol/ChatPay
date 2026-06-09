-- 0016: Agregar columna source a transactions
-- Ejecutar en el SQL editor de Supabase

ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'email';

-- Marcar las transacciones existentes como email
UPDATE public.transactions SET source = 'email' WHERE source IS NULL OR source = 'email';
