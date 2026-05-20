import { supabaseAdmin } from './supabase.js';

// Cache en memoria: userId → company (TTL 5 minutos)
const cache = new Map();
const TTL = 30 * 1000; // 30 segundos — para que cambios de plan/suspensión tomen efecto rápido

/**
 * Devuelve la empresa del usuario autenticado.
 * Si no tiene empresa, retorna null.
 */
export async function getCompany(userId) {
  const cached = cache.get(userId);
  if (cached && Date.now() - cached.ts < TTL) return cached.company;

  const { data, error } = await supabaseAdmin
    .from('companies')
    .select('id, name, email_alias, plan, max_employees, is_active')
    .eq('user_id', userId)
    .single();

  if (error || !data) return null;

  cache.set(userId, { company: data, ts: Date.now() });
  return data;
}

/**
 * Devuelve el company_id del usuario, o responde 403 si no tiene empresa.
 * Uso: const companyId = await requireCompany(user.id, res); if (!companyId) return;
 */
export async function requireCompany(userId, res) {
  const company = await getCompany(userId);
  if (!company) {
    res.status(403).json({ error: 'No se encontró una empresa asociada a este usuario.' });
    return null;
  }
  if (!company.is_active) {
    res.status(403).json({ error: 'La cuenta de esta empresa está suspendida.' });
    return null;
  }
  return company;
}

/** Invalida la cache para un usuario (útil al actualizar empresa). */
export function invalidateCompanyCache(userId) {
  cache.delete(userId);
}
