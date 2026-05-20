/**
 * api/subscription/index.js
 *
 * GET  /api/subscription        — estado de suscripción y métricas
 * POST /api/subscription        — crear link de pago en Bold
 */
import { requireUser } from '../../lib/auth.js';
import { requireCompany } from '../../lib/getCompany.js';
import { supabaseAdmin } from '../../lib/supabase.js';
import { getMonthlyVerificationCount } from '../../lib/subscription.js';

/* ─── Precios y descuentos Bold ───────────────────────── */
const BASE_PRICES = { starter: 49900, business: 129900, enterprise: 299900 };
const DISCOUNTS   = { 1: 0, 3: 5, 6: 10, 12: 15 };
const PLAN_LABELS = { starter: 'Starter', business: 'Business', enterprise: 'Enterprise' };

async function createBoldLink({ amount, description, orderId, callbackUrl }) {
  const BOLD_API_KEY = process.env.BOLD_API_KEY;
  if (!BOLD_API_KEY) throw new Error('BOLD_API_KEY no configurada.');

  const body = {
    amount:          { local: { total: amount, currency: 'COP' } },
    description,
    expiration_date: Math.floor(Date.now() / 1000) + 86400,
    order_id:        orderId,
    redirect_url:    callbackUrl,
    callback_url:    callbackUrl,
    payment_methods: ['CARD', 'PSE', 'NEQUI'],
  };

  const r = await fetch('https://integrations.api.bold.co/online/link/v1/payment-links', {
    method:  'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `x-api-key ${BOLD_API_KEY}` },
    body:    JSON.stringify(body),
  });
  if (!r.ok) throw new Error(`Bold ${r.status}: ${await r.text()}`);
  const data = await r.json();
  return data?.payload?.url || data?.payload?.payment_link || data?.url;
}

/* ─── Handler ─────────────────────────────────────────── */
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(204).end();

  const user = await requireUser(req, res);
  if (!user) return;

  /* ── GET: estado de suscripción ─────────────────────── */
  if (req.method === 'GET') {
    const company = await requireCompany(user.id, res);
    if (!company) return;

    const companyId = company.id;
    const [verifications_used, { count: employees_count }, { count: bank_accounts_count }] = await Promise.all([
      getMonthlyVerificationCount(companyId),
      supabaseAdmin.from('employees').select('id', { count: 'exact', head: true }).eq('company_id', companyId).eq('is_active', true),
      supabaseAdmin.from('company_bank_accounts').select('id', { count: 'exact', head: true }).eq('company_id', companyId),
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
      bank_accounts_count:     bank_accounts_count || 0,
    });
  }

  /* ── POST: crear link de pago Bold ──────────────────── */
  if (req.method === 'POST') {
    // Para pagos NO requerimos requireCompany (la cuenta puede estar suspendida)
    const { plan = 'starter', months = 1 } = req.body || {};

    if (!BASE_PRICES[plan])            return res.status(400).json({ error: 'Plan inválido.' });
    if (![1,3,6,12].includes(+months)) return res.status(400).json({ error: 'Duración inválida.' });

    const m        = +months;
    const discount = DISCOUNTS[m] ?? 0;
    const total    = Math.round(BASE_PRICES[plan] * m * (1 - discount / 100));

    const { data: company } = await supabaseAdmin
      .from('companies').select('id, name').eq('user_id', user.id).maybeSingle();

    const companyId   = company?.id || user.id;
    const orderId     = `chatpay-${companyId.slice(0,8)}-${plan}-${m}m-${Date.now()}`;
    const appUrl      = process.env.VITE_APP_URL || 'https://chat-pay-six.vercel.app';
    const callbackUrl = `${appUrl}/suscripcion?payment=success&plan=${plan}&months=${m}&order=${orderId}`;
    const description = `ChatPay · Plan ${PLAN_LABELS[plan]} · ${m} mes${m>1?'es':''}${discount>0?` (${discount}% desc.)`:''}`;

    let url;
    try {
      url = await createBoldLink({ amount: total, description, orderId, callbackUrl });
    } catch (err) {
      console.error('[subscription/payment] Bold error:', err.message);
      return res.status(502).json({ error: `No se pudo crear el link de pago: ${err.message}` });
    }

    if (!url) return res.status(502).json({ error: 'Bold no devolvió una URL de pago.' });

    return res.json({ url, orderId, amount: total, plan, months: m, discount });
  }

  return res.status(405).end();
}
