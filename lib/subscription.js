/**
 * lib/subscription.js
 *
 * Helpers para validar el plan y límites de una empresa.
 * Usado por los endpoints de employees, verifications y bank-accounts.
 */
import { supabaseAdmin } from './supabase.js';

export const PLANS = {
  free: {
    label: 'Free Trial',
    price: 0,
    maxEmployees: 3,
    maxVerificationsMonth: 50,
    maxBankAccounts: 1,
    maxAdminAlerts: 10,
    maxAdminNumbers: 1,
    maxLocations: 1,
    trialDays: 14,
    color: 'slate'
  },
  basico: {
    label: 'Básico',
    price: 49900,
    maxEmployees: 2,
    maxVerificationsMonth: 300,
    maxBankAccounts: 1,
    maxAdminAlerts: 0,
    maxAdminNumbers: 0,
    maxLocations: 1,
    color: 'blue'
  },
  estandar: {
    label: 'Estándar',
    price: 99900,
    maxEmployees: 5,
    maxVerificationsMonth: 800,
    maxBankAccounts: 2,
    maxAdminAlerts: 20,
    maxAdminNumbers: 1,
    maxLocations: 3,
    color: 'emerald'
  },
  pro: {
    label: 'Pro',
    price: 199900,
    maxEmployees: 15,
    maxVerificationsMonth: 2500,
    maxBankAccounts: 5,
    maxAdminAlerts: 50,
    maxAdminNumbers: 2,
    maxLocations: 15,
    color: 'violet'
  },
  empresarial: {
    label: 'Empresarial',
    price: 349900,
    maxEmployees: 999999,
    maxVerificationsMonth: 999999,
    maxBankAccounts: 999999,
    maxAdminAlerts: 999999,
    maxAdminNumbers: 2,
    maxLocations: 999,
    color: 'purple'
  }
};

// Compatibilidad con nombres anteriores
PLANS.starter    = PLANS.basico;
PLANS.business   = PLANS.estandar;
PLANS.enterprise = PLANS.empresarial;

/**
 * Obtiene la empresa con sus límites y estado de suscripción.
 */
export async function getCompanySubscription(companyId) {
  const { data, error } = await supabaseAdmin
    .from('companies')
    .select('id, name, plan, subscription_status, trial_ends_at, is_active, max_employees, max_verifications_month, max_bank_accounts, max_admin_alerts, max_admin_numbers, max_locations, alerts_sent_month, alerts_reset_at')
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
 * Verifica si la empresa puede crear más sedes.
 */
export async function checkLocationLimit(companyId) {
  const company = await getCompanySubscription(companyId);
  if (!company) return { ok: false, reason: 'Empresa no encontrada.' };

  const subCheck = checkSubscriptionActive(company);
  if (!subCheck.ok) return subCheck;

  const { count } = await supabaseAdmin
    .from('company_locations')
    .select('id', { count: 'exact', head: true })
    .eq('company_id', companyId)
    .eq('is_active', true);

  if (count >= company.max_locations) {
    const plan = PLANS[company.plan];
    return {
      ok: false,
      reason: `Tu plan ${plan?.label || company.plan} permite máximo ${company.max_locations} sede${company.max_locations === 1 ? '' : 's'}. Actualiza tu plan para agregar más.`,
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

/**
 * Verifica si la empresa puede enviar más alertas al admin este mes.
 * Incrementa el contador si está dentro del límite.
 */
export async function checkAndIncrementAlertLimit(companyId) {
  const company = await getCompanySubscription(companyId);
  if (!company) return { ok: true }; // No bloquear si no se puede obtener

  const plan = PLANS[company.plan];
  const maxAlerts = plan?.maxAdminAlerts ?? 0;

  if (maxAlerts === 0) {
    return { ok: false, reason: 'Tu plan no incluye alertas de administrador.' };
  }

  // Reset mensual: si alerts_reset_at es de un mes anterior, reiniciar contador
  const now = new Date();
  const resetAt = company.alerts_reset_at ? new Date(company.alerts_reset_at) : null;
  const needsReset = !resetAt ||
    resetAt.getMonth() !== now.getMonth() ||
    resetAt.getFullYear() !== now.getFullYear();

  if (needsReset) {
    await supabaseAdmin
      .from('companies')
      .update({ alerts_sent_month: 0, alerts_reset_at: now.toISOString() })
      .eq('id', companyId);
    company.alerts_sent_month = 0;
  }

  const used = company.alerts_sent_month || 0;

  if (maxAlerts !== 999999 && used >= maxAlerts) {
    return {
      ok: false,
      reason: `Alcanzaste el límite de ${maxAlerts} alertas este mes (plan ${plan?.label || company.plan}).`,
      limitReached: true,
      used,
      max: maxAlerts
    };
  }

  // Incrementar contador
  await supabaseAdmin
    .from('companies')
    .update({ alerts_sent_month: used + 1 })
    .eq('id', companyId);

  return { ok: true, used: used + 1, max: maxAlerts };
}
