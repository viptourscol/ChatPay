import { supabaseAdmin } from './supabase.js';

// Cache en memoria: userId → company (TTL 30 segundos)
const cache = new Map();
const TTL = 30 * 1000;

/**
 * Devuelve la empresa del usuario autenticado.
 */
export async function getCompany(userId) {
  const cached = cache.get(userId);
  if (cached && Date.now() - cached.ts < TTL) return cached.company;

  const { data, error } = await supabaseAdmin
    .from('companies')
    .select('id, name, email_alias, plan, max_employees, is_active, subscription_status, trial_ends_at, subscription_expires_at, max_verifications_month, max_bank_accounts')
    .eq('user_id', userId)
    .single();

  if (error || !data) return null;

  cache.set(userId, { company: data, ts: Date.now() });
  return data;
}

/**
 * Devuelve el company, o responde con error si no tiene empresa o está suspendida.
 * Cuando la cuenta está suspendida/trial vencido devuelve 402 con datos para mostrar
 * la pasarela de pago en el frontend.
 */
export async function requireCompany(userId, res) {
  const company = await getCompany(userId);
  if (!company) {
    res.status(403).json({ error: 'No se encontró una empresa asociada a este usuario.' });
    return null;
  }
  if (!company.is_active || company.subscription_status === 'suspended' || company.subscription_status === 'cancelled') {
    res.status(402).json({
      error: 'payment_required',
      suspended: true,
      company: {
        id:                      company.id,
        name:                    company.name,
        plan:                    company.plan || 'starter',
        subscription_status:     company.subscription_status,
        trial_ends_at:           company.trial_ends_at,
        max_verifications_month: company.max_verifications_month,
        max_employees:           company.max_employees,
        max_bank_accounts:       company.max_bank_accounts,
      }
    });
    return null;
  }
  // Trial vencido
  if (company.subscription_status === 'trial' && company.trial_ends_at) {
    if (new Date(company.trial_ends_at) < new Date()) {
      res.status(402).json({
        error: 'payment_required',
        suspended: true,
        trialExpired: true,
        company: {
          id:                      company.id,
          name:                    company.name,
          plan:                    company.plan || 'starter',
          subscription_status:     'trial_expired',
          trial_ends_at:           company.trial_ends_at,
          max_verifications_month: company.max_verifications_month,
          max_employees:           company.max_employees,
          max_bank_accounts:       company.max_bank_accounts,
        }
      });
      return null;
    }
  }
  return company;
}

/** Invalida la cache para un usuario. */
export function invalidateCompanyCache(userId) {
  cache.delete(userId);
}
