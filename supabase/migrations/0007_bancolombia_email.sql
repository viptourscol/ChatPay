-- Agrega campo bancolombia_email a companies
-- Este campo se usa para el routing automático de emails Bancolombia por empresa
ALTER TABLE companies
  ADD COLUMN IF NOT EXISTS bancolombia_email text;
