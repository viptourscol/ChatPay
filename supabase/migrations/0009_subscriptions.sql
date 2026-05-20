-- Agrega columnas de suscripción a companies
-- plan: starter | business | enterprise
-- subscription_status: trial | active | suspended | cancelled
ALTER TABLE companies
  ADD COLUMN IF NOT EXISTS subscription_status   text NOT NULL DEFAULT 'trial',
  ADD COLUMN IF NOT EXISTS trial_ends_at         timestamptz DEFAULT (now() + interval '14 days'),
  ADD COLUMN IF NOT EXISTS max_verifications_month int NOT NULL DEFAULT 200,
  ADD COLUMN IF NOT EXISTS max_bank_accounts     int NOT NULL DEFAULT 1;

-- Ajustar valores según el plan actual
UPDATE companies SET
  max_employees            = CASE plan
    WHEN 'starter'   THEN 1
    WHEN 'business'  THEN 20
    WHEN 'enterprise' THEN 999999
    ELSE 1
  END,
  max_verifications_month = CASE plan
    WHEN 'starter'   THEN 200
    WHEN 'business'  THEN 1000
    WHEN 'enterprise' THEN 999999
    ELSE 200
  END,
  max_bank_accounts       = CASE plan
    WHEN 'starter'   THEN 1
    WHEN 'business'  THEN 3
    WHEN 'enterprise' THEN 999999
    ELSE 1
  END;

-- Empresas activas con plan pasamos a 'active'
UPDATE companies SET subscription_status = 'active' WHERE is_active = true AND plan IS NOT NULL;
