-- Agrega fecha de vencimiento de suscripción y tabla de historial de pagos

ALTER TABLE companies
  ADD COLUMN IF NOT EXISTS subscription_expires_at timestamptz;

-- Historial de pagos de suscripción
CREATE TABLE IF NOT EXISTS subscription_payments (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id    uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  wompi_tx_id   text,
  plan          text NOT NULL,
  months        int  NOT NULL DEFAULT 1,
  amount_cop    int  NOT NULL,
  status        text NOT NULL DEFAULT 'approved', -- approved | failed | pending
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS subscription_payments_company_id_idx
  ON subscription_payments (company_id, created_at DESC);

ALTER TABLE subscription_payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "companies can read own payments"
  ON subscription_payments FOR SELECT
  USING (
    company_id IN (
      SELECT id FROM companies WHERE user_id = auth.uid()
    )
  );
