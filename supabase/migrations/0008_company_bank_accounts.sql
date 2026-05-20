-- Tabla para múltiples cuentas bancarias por empresa
CREATE TABLE IF NOT EXISTS company_bank_accounts (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id      uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  label           text NOT NULL DEFAULT 'Cuenta principal',
  bank_name       text NOT NULL DEFAULT 'Bancolombia',
  bancolombia_email text NOT NULL,
  created_at      timestamptz DEFAULT now()
);

-- RLS
ALTER TABLE company_bank_accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "company_bank_accounts_own" ON company_bank_accounts
  USING (company_id IN (SELECT id FROM companies WHERE user_id = auth.uid()));
