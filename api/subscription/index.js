/**
 * api/subscription/index.js
 *
 * GET /api/subscription
 * Devuelve el estado de suscripción y métricas de uso del mes actual
 * para la empresa del usuario autenticado.
 */
import { requireUser } from '../../lib/auth.js';
import { requireCompany } from '../../lib/getCompany.js';
import { supabaseAdmin } from '../../lib/supabase.js';
import { getMonthlyVerificationCount } from '../../lib/subscription.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'GET') return res.status(405).end();

  const user = await requireUser(req, res);
  if (!user) return;

  const company = await requireCompany(user.id, res);
  if (!company) return;

  const companyId = company.id;

  // Conteos de uso
  const [verifications_used, { count: employees_count }, { count: bank_accounts_count }] = await Promise.all([
    getMonthlyVerificationCount(companyId),
    supabaseAdmin.from('employees').select('id', { count: 'exact', head: true }).eq('company_id', companyId).eq('is_active', true),
    supabaseAdmin.from('company_bank_accounts').select('id', { count: 'exact', head: true }).eq('company_id', companyId)
  ]);

  return res.json({
    plan:                    company.plan || 'starter',
    subscription_status:     company.subscription_status || 'trial',
    trial_ends_at:           company.trial_ends_at || null,
    is_active:               company.is_active,
    max_employees:           company.max_employees || 1,
    max_verifications_month: company.max_verifications_month || 200,
    max_bank_accounts:       company.max_bank_accounts || 1,
    verifications_used,
    employees_count:         employees_count || 0,
    bank_accounts_count:     bank_accounts_count || 0
  });
}
