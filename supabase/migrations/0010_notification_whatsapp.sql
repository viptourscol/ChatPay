-- 0010: numero de notificacion WhatsApp opcional por empresa
ALTER TABLE companies
  ADD COLUMN IF NOT EXISTS notification_whatsapp text DEFAULT NULL;
