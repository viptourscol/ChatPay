/**
 * lib/subscription.js
 *
 * Helpers para validar el plan y límites de una empresa.
 * Usado por los endpoints de employees, verifications y bank-accounts.
 */
import { supabaseAdmin } from './supabase.js';

export const PLANS = {
  starter: {
    label: 'Starter',
    price: 49900,
    maxEmployees: 1,
    maxVerificationsMonth: 200,
    maxBankAccounts: 1,
    color: 'blue'
  },
  business: {
    label: 'Business',
    price: 129900,
    maxEmployees: 20,
    maxVerificationsMonth: 1000,
    maxBankAccounts: 3,
    color: 'emerald'
  },
  enterprise: {
    label: 'Enterprise',
    price: 299900,
    maxEmployees: 999999,
    maxVerificationsMonth: 999999,
    maxBankAccounts: 999999,
    color: 'purple'
  }
};

/**
 * Obtiene la empresa con sus límites y estado de suscripción.
 */
export async function getCompanySubscription(companyId) {
  const { data, error } = await supabaseAdmin
    .from('companies')
    .select('id, name, plan, subscription_status, trial_ends_at, is_active, max_employees, max_verifications_month, max_bank_accounts')
    .eq('id', companyId)
    .maybeSingle();
  if (error || !data) return null;
  return data;
}

/**
 * Verifica si la suscripción está activa (trial vigente o active).
 * Devuelve { ok: true } o { ok: false, reason: string }
 */
export function checkSubscriptionActive(company) {
  if (!company.is_active) {
    return { ok: false, reason: 'Cuenta suspendida. Contacta a soporte.' };
  }
  if (company.subscription_status === 'cancelled') {
    return { ok: false, reason: 'Suscripción cancelada.' };
  }
  if (company.subscription_status === 'trial') {
    const trialEnd = company.trial_ends_at ? new Date(company.trial_ends_at) : null;
    if (trialEnd && trialEnd < new Date()) {
      return { ok: false, reason: 'Tu período de prueba ha vencido. Activa tu suscripción para continuar.' };
    }
  }
  if (company.subscription_status === 'suspended') {
    return { ok: false, reason: 'Suscripción suspendida por pago pendiente. Contacta a soporte.' };
  }
  return { ok: true };
}

/**
 * Verifica si la empresa puede agregar más empleados.
 */
export async function checkEmployeeLimit(companyId) {
  const company = await getCompanySubscription(companyId);
  if (!company) return { ok: false, reason: 'Empresa no encontrada.' };

  const subCheck = checkSubscriptionActive(company);
  if (!subCheck.ok) return subCheck;

  const { count } = await supabaseAdmin
    .from('employees')
    .select('id', { count: 'exact', head: true })
    .eq('company_id', companyId)
    .eq('is_active', true);

  if (count >= company.max_employees) {
    const plan = PLANS[company.plan];
    return {
      ok: false,
      reason: `Tu plan ${plan?.label || company.plan} permite máximo ${company.max_employees} empleado${company.max_employees === 1 ? '' : 's'} activo${company.max_employees === 1 ? '' : 's'}. Actualiza tu plan para agregar más.`,
      limitReached: true
    };
  }
  return { ok: true };
}

/**
 * Verifica si la empresa puede agregar más cuentas bancarias.
 */
export async function checkBankAccountLimit(companyId) {
  const company = await getCompanySubscription(companyId);
  if (!company) return { ok: false, reason: 'Empresa no encontrada.' };

  const subCheck = checkSubscriptionActive(company);
  if (!subCheck.ok) return subCheck;

  const { count } = await supabaseAdmin
    .from('company_bank_accounts')
    .select('id', { count: 'exact', head: true })
    .eq('company_id', companyId);

  if (count >= company.max_bank_accounts) {
    const plan = PLANS[company.plan];
    return {
      ok: false,
      reason: `Tu plan ${plan?.label || company.plan} permite máximo ${company.max_bank_accounts} cuenta${company.max_bank_accounts === 1 ? '' : 's'} bancaria${company.max_bank_accounts === 1 ? '' : 's'}. Actualiza tu plan para agregar más.`,
      limitReached: true
    };
  }
  return { ok: true };
}

/**
 * Cuenta verificaciones del mes actual para la empresa.
 */
export async function getMonthlyVerificationCount(companyId) {
  const start = new Date();
  start.setDate(1); start.setHours(0, 0, 0, 0);
  const { count } = await supabaseAdmin
    .from('verifications')
    .select('id', { count: 'exact', head: true })
    .eq('company_id', companyId)
    .gte('created_at', start.toISOString());
  return count || 0;
}

/**
 * Verifica si la empresa puede hacer más verificaciones este mes.
 */
export async function checkVerificationLimit(companyId) {
  const company = await getCompanySubscription(companyId);
  if (!company) return { ok: true }; // No bloquear si no se puede obtener

  const subCheck = checkSubscriptionActive(company);
  if (!subCheck.ok) return subCheck;

  const used = await getMonthlyVerificationCount(companyId);
  if (used >= company.max_verifications_month) {
    const plan = PLANS[company.plan];
    return {
      ok: false,
      reason: `Alcanzaste el límite de ${company.max_verifications_month} verificaciones este mes (plan ${plan?.label || company.plan}). Renueva o actualiza tu plan.`,
      limitReached: true,
      used,
      max: company.max_verifications_month
    };
  }
  return { ok: true, used, max: company.max_verifications_month };
}
