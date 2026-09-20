-- 0023: Verification Expiration Tasks (Reemplazar cron cada minuto)
-- Usa triggers para crear tareas de expiración automáticamente
-- El cron diario/horario las procesa en lugar de hacer polling cada minuto

-- Tabla: Tareas de expiración programadas
CREATE TABLE IF NOT EXISTS public.verification_expiration_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  verification_id UUID NOT NULL REFERENCES public.verifications(id) ON DELETE CASCADE,
  
  -- Timing
  expiration_time TIMESTAMP NOT NULL, -- Cuándo debería expirar (NOW() + 2 min)
  status VARCHAR(20) NOT NULL DEFAULT 'pending', -- 'pending' | 'processed' | 'skipped'
  
  -- Audit
  reason VARCHAR(50), -- 'automatic_creation' | 'webhook_reconciled' | 'manual_skip'
  processed_at TIMESTAMP, -- Cuándo se procesó realmente
  error_message TEXT, -- Si falló al procesar
  
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  
  -- Constraints
  CONSTRAINT valid_status CHECK (status IN ('pending', 'processed', 'skipped'))
);

-- Índices para queries eficientes
CREATE INDEX idx_verification_expiration_time_status 
  ON public.verification_expiration_tasks(expiration_time ASC, status)
  WHERE status = 'pending';

CREATE INDEX idx_verification_expiration_company_id 
  ON public.verification_expiration_tasks(company_id);

CREATE INDEX idx_verification_expiration_verification_id 
  ON public.verification_expiration_tasks(verification_id);

-- Trigger: Auto-actualizar updated_at
CREATE OR REPLACE FUNCTION public.update_verification_expiration_tasks_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_verification_expiration_tasks_updated_at 
  ON public.verification_expiration_tasks;
CREATE TRIGGER trigger_verification_expiration_tasks_updated_at
  BEFORE UPDATE ON public.verification_expiration_tasks
  FOR EACH ROW
  EXECUTE FUNCTION public.update_verification_expiration_tasks_updated_at();

-- TRIGGER 1: Crear tarea de expiración cuando se inserta verification pendiente
-- Se dispara DESPUÉS de insertar en verifications
CREATE OR REPLACE FUNCTION public.create_verification_expiration_task()
RETURNS TRIGGER AS $$
BEGIN
  -- Solo crear tarea si:
  -- 1. Status es 'pending'
  -- 2. whatsapp_from NO es NULL (necesitamos enviar notificación)
  IF NEW.status = 'pending' AND NEW.whatsapp_from IS NOT NULL THEN
    INSERT INTO public.verification_expiration_tasks (
      company_id,
      verification_id,
      expiration_time,
      reason,
      status
    ) VALUES (
      NEW.company_id,
      NEW.id,
      NOW() + INTERVAL '2 minutes',
      'automatic_creation',
      'pending'
    );
    
    -- Log
    RAISE NOTICE '[verification_expiration] Created task for verification % to expire at %', 
      NEW.id, (NOW() + INTERVAL '2 minutes');
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_verification_insert_expiration 
  ON public.verifications;
CREATE TRIGGER trigger_verification_insert_expiration
  AFTER INSERT ON public.verifications
  FOR EACH ROW
  EXECUTE FUNCTION public.create_verification_expiration_task();

-- TRIGGER 2: Marcar tarea como 'skipped' cuando verification pasa de 'pending' a otro estado
-- Se dispara DESPUÉS de actualizar verifications
CREATE OR REPLACE FUNCTION public.skip_verification_expiration_task()
RETURNS TRIGGER AS $$
BEGIN
  -- Solo si cambió de 'pending' a otro estado
  IF OLD.status = 'pending' AND NEW.status != 'pending' THEN
    UPDATE public.verification_expiration_tasks
    SET 
      status = 'skipped',
      reason = 'webhook_reconciled',
      updated_at = NOW()
    WHERE 
      verification_id = NEW.id
      AND status = 'pending';
    
    -- Log
    RAISE NOTICE '[verification_expiration] Skipped expiration task for verification % (status: % → %)', 
      NEW.id, OLD.status, NEW.status;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_verification_update_expiration 
  ON public.verifications;
CREATE TRIGGER trigger_verification_update_expiration
  AFTER UPDATE ON public.verifications
  FOR EACH ROW
  EXECUTE FUNCTION public.skip_verification_expiration_task();

-- Row Level Security
ALTER TABLE public.verification_expiration_tasks ENABLE ROW LEVEL SECURITY;

-- SELECT: Solo accesibles por la empresa propietaria
CREATE POLICY verification_expiration_tasks_select 
  ON public.verification_expiration_tasks
  FOR SELECT USING (
    company_id IN (SELECT id FROM public.companies WHERE user_id = auth.uid())
  );

-- INSERT: Solo el sistema (via triggers) puede crear
CREATE POLICY verification_expiration_tasks_insert 
  ON public.verification_expiration_tasks
  FOR INSERT WITH CHECK (
    company_id IN (SELECT id FROM public.companies WHERE user_id = auth.uid())
  );

-- UPDATE: Solo para marcar processed/skipped
CREATE POLICY verification_expiration_tasks_update 
  ON public.verification_expiration_tasks
  FOR UPDATE USING (
    company_id IN (SELECT id FROM public.companies WHERE user_id = auth.uid())
  )
  WITH CHECK (
    company_id IN (SELECT id FROM public.companies WHERE user_id = auth.uid())
  );

-- SELECT: Service role puede ver para procesar
-- UPDATE: Service role puede actualizar con status/processed_at
GRANT SELECT, UPDATE ON public.verification_expiration_tasks TO service_role;
GRANT USAGE, SELECT ON SEQUENCE verification_expiration_tasks_id_seq TO service_role;

-- Grant para ejecutar los triggers
GRANT EXECUTE ON FUNCTION public.create_verification_expiration_task() TO authenticated;
GRANT EXECUTE ON FUNCTION public.skip_verification_expiration_task() TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_verification_expiration_tasks_updated_at() TO authenticated;
