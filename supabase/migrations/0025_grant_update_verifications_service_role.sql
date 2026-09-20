-- 0025: Grant UPDATE permission to service_role for verifications
-- 
-- PROBLEMA: 
-- - reconcilePendingVerifications.js intenta actualizar verifications con service_role
-- - Pero solo tiene permiso SELECT, no UPDATE
-- - El UPDATE falla silenciosamente y las verificaciones quedan en estado pending
--
-- SOLUCIÓN:
-- - Agregar GRANT UPDATE para service_role en verifications
-- - Ahora puede cambiar status de pending a real/fake/duplicate/error

-- Dar permisos de UPDATE al service_role
GRANT UPDATE ON public.verifications TO service_role;

-- Comentario para documentar
COMMENT ON ROLE service_role IS 'Service role de Vercel para ejecutar cron jobs. Permisos: SELECT, UPDATE en verifications para reconciliación automática.';
