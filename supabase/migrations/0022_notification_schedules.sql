-- 0022: Notificaciones Programadas por Sede
-- Permite a admins programar notificaciones diarias/semanales sobre comprobantes pendientes

CREATE TABLE IF NOT EXISTS public.notification_schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  
  -- Configuración de la notificación
  enabled BOOLEAN DEFAULT true,
  frequency VARCHAR(20) NOT NULL DEFAULT 'daily', -- 'daily' | 'weekly'
  day_of_week INTEGER, -- 0=Monday, 1=Tuesday, ... 6=Sunday (solo si frequency='weekly')
  time_of_day TIME NOT NULL DEFAULT '09:00:00', -- Hora en horario Colombia (se convierte a UTC)
  timezone VARCHAR(50) DEFAULT 'America/Bogota',
  
  -- Destinatario y canal
  recipient_phone VARCHAR(20) NOT NULL, -- Número WhatsApp del admin (E.164 format)
  channel VARCHAR(20) DEFAULT 'whatsapp', -- 'whatsapp' | 'email' (future)
  
  -- Configuración de sedes
  include_all_locations BOOLEAN DEFAULT true, -- Si false, usar location_ids específicos
  location_ids UUID[] DEFAULT '{}', -- IDs de company_locations si include_all_locations=false
  
  -- Tracking
  last_sent_at TIMESTAMP, -- Última vez que se envió esta notificación
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  
  -- Constraints
  CONSTRAINT valid_frequency CHECK (frequency IN ('daily', 'weekly')),
  CONSTRAINT valid_day_of_week CHECK (day_of_week IS NULL OR (day_of_week >= 0 AND day_of_week <= 6)),
  CONSTRAINT valid_channel CHECK (channel IN ('whatsapp', 'email')),
  CONSTRAINT recipient_phone_not_empty CHECK (recipient_phone != '')
);

-- Índices para búsquedas rápidas
CREATE INDEX idx_notification_schedules_company_enabled 
  ON public.notification_schedules(company_id, enabled);

CREATE INDEX idx_notification_schedules_last_sent 
  ON public.notification_schedules(last_sent_at DESC);

-- Trigger para auto-actualizar updated_at
CREATE OR REPLACE FUNCTION public.update_notification_schedules_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_notification_schedules_updated_at ON public.notification_schedules;
CREATE TRIGGER trigger_notification_schedules_updated_at
  BEFORE UPDATE ON public.notification_schedules
  FOR EACH ROW
  EXECUTE FUNCTION public.update_notification_schedules_updated_at();

-- Row Level Security
ALTER TABLE public.notification_schedules ENABLE ROW LEVEL SECURITY;

-- SELECT: Solo accesibles por la empresa propietaria
CREATE POLICY notification_schedules_select ON public.notification_schedules
  FOR SELECT USING (
    company_id IN (SELECT id FROM public.companies WHERE user_id = auth.uid())
  );

-- INSERT: Solo admin de la empresa puede crear
CREATE POLICY notification_schedules_insert ON public.notification_schedules
  FOR INSERT WITH CHECK (
    company_id IN (SELECT id FROM public.companies WHERE user_id = auth.uid())
  );

-- UPDATE: Solo admin de la empresa puede editar
CREATE POLICY notification_schedules_update ON public.notification_schedules
  FOR UPDATE USING (
    company_id IN (SELECT id FROM public.companies WHERE user_id = auth.uid())
  );

-- DELETE: Solo admin de la empresa puede eliminar
CREATE POLICY notification_schedules_delete ON public.notification_schedules
  FOR DELETE USING (
    company_id IN (SELECT id FROM public.companies WHERE user_id = auth.uid())
  );

-- Grant permisos a Vercel service role (para cron job)
GRANT SELECT, UPDATE ON public.notification_schedules TO service_role;
GRANT SELECT ON public.company_locations TO service_role;
GRANT SELECT ON public.employees TO service_role;
GRANT SELECT ON public.verifications TO service_role;
