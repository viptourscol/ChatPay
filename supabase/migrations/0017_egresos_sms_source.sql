-- 0017_egresos_sms_source
-- Agrega 'sms' como valor permitido en egresos.source
-- El CHECK constraint original solo permitía 'manual' | 'gmail'

ALTER TABLE public.egresos
  DROP CONSTRAINT IF EXISTS egresos_source_check;

ALTER TABLE public.egresos
  ADD CONSTRAINT egresos_source_check
  CHECK (source IN ('manual', 'gmail', 'sms'));
