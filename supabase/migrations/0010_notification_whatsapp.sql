-- 0010: numeros de notificacion WhatsApp (array jsonb [{number, active}])
ALTER TABLE companies
  ADD COLUMN IF NOT EXISTS notification_whatsapp jsonb DEFAULT '[]'::jsonb;

-- Si ya existía como text, convertir al nuevo formato
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'companies'
      AND column_name = 'notification_whatsapp'
      AND data_type = 'text'
  ) THEN
    ALTER TABLE companies
      ALTER COLUMN notification_whatsapp TYPE jsonb
      USING CASE
        WHEN notification_whatsapp IS NULL OR notification_whatsapp = '' THEN '[]'::jsonb
        ELSE jsonb_build_array(jsonb_build_object('number', notification_whatsapp, 'active', true))
      END;
    ALTER TABLE companies
      ALTER COLUMN notification_whatsapp SET DEFAULT '[]'::jsonb;
  END IF;
END $$;
