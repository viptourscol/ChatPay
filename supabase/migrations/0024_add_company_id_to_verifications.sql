-- 0024: Agregar company_id a verifications
-- Esto es CRÍTICO para aislar datos por empresa en notificaciones programadas

-- Agregar columna company_id a verifications
ALTER TABLE public.verifications 
ADD COLUMN company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE;

-- Índice para queries eficientes
CREATE INDEX idx_verifications_company_id 
  ON public.verifications(company_id);

-- Combo índice para notificaciones: empresa + estado + fecha
CREATE INDEX idx_verifications_company_status_date
  ON public.verifications(company_id, status, created_at DESC)
  WHERE status = 'pending';

-- Llenar company_id existentes desde employees → employee.company_id
UPDATE public.verifications v
SET company_id = e.company_id
FROM public.employees e
WHERE v.employee_id = e.id
  AND v.company_id IS NULL;

-- Hacer NOT NULL (después de llenar)
ALTER TABLE public.verifications 
ALTER COLUMN company_id SET NOT NULL;

COMMENT ON COLUMN public.verifications.company_id IS 'Empresa propietaria de esta verificación. Requerido para aislamiento multi-tenant.';
