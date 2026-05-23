-- 0014: Multi-sede / sucursales
-- Ejecutar en el SQL editor de Supabase

-- ============================
-- 1. Nueva tabla company_locations
-- ============================
CREATE TABLE IF NOT EXISTS public.company_locations (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id  uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  name        text NOT NULL,
  city        text,
  address     text,
  is_active   boolean NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_locations_company ON public.company_locations(company_id);

ALTER TABLE public.company_locations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "locations_own" ON public.company_locations
  USING (company_id IN (SELECT id FROM public.companies WHERE user_id = auth.uid()));

-- ============================
-- 2. Insertar sede principal automáticamente para cada empresa existente
-- ============================
INSERT INTO public.company_locations (company_id, name)
SELECT id, 'Sede Principal'
FROM public.companies
WHERE id NOT IN (SELECT DISTINCT company_id FROM public.company_locations);

-- ============================
-- 3. Agregar location_id a employees (referencia a su sede)
-- ============================
ALTER TABLE public.employees
  ADD COLUMN IF NOT EXISTS location_id uuid REFERENCES public.company_locations(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_employees_location ON public.employees(location_id);

-- Asignar empleados existentes a la sede principal de su empresa
UPDATE public.employees e
SET location_id = (
  SELECT cl.id FROM public.company_locations cl
  WHERE cl.company_id = e.company_id
  ORDER BY cl.created_at ASC
  LIMIT 1
)
WHERE e.location_id IS NULL AND e.company_id IS NOT NULL;

-- ============================
-- 4. Agregar location_id a verifications (heredado del empleado)
-- ============================
ALTER TABLE public.verifications
  ADD COLUMN IF NOT EXISTS location_id uuid REFERENCES public.company_locations(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_verifications_location ON public.verifications(location_id);

-- Rellenar location_id en verificaciones existentes desde el empleado
UPDATE public.verifications v
SET location_id = e.location_id
FROM public.employees e
WHERE v.employee_id = e.id AND v.location_id IS NULL;

-- ============================
-- 5. Agregar max_locations a companies (límite por plan)
-- ============================
ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS max_locations integer NOT NULL DEFAULT 1;

-- Setear max_locations según plan actual
UPDATE public.companies SET max_locations = CASE
  WHEN plan IN ('free')                          THEN 1
  WHEN plan IN ('basico', 'starter')             THEN 1
  WHEN plan IN ('estandar', 'business')          THEN 3
  WHEN plan IN ('pro')                           THEN 15
  WHEN plan IN ('empresarial', 'enterprise')     THEN 999
  ELSE 1
END;
