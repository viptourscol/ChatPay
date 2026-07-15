-- ChatPay — columna para rastrear recordatorios de vencimiento de suscripción
-- Ejecutar en el SQL editor de Supabase

-- Columna que almacena qué recordatorios ya se enviaron para el ciclo actual
-- Ejemplo: {"1d": "2026-07-14", "0d": "2026-07-15", "post": "2026-07-16"}
ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS subscription_reminder_sent jsonb NOT NULL DEFAULT '{}';
