/**
 * api/subscription/index.js
 *
 * GET  /api/subscription        — estado de suscripción y métricas
 * POST /api/subscription        — crear link de pago en Wompi
 */
import { requireUser } from '../../lib/auth.js';
import { requireCompany } from '../../lib/getCompany.js';
import { supabaseAdmin } from '../../lib/supabase.js';
import { getMonthlyVerificationCount } from '../../lib/subscription.js';

/* ─── Precios y descuentos ────────────────────────────── */
const BASE_PRICES = { starter: 49900, business: 129900, enterprise: 299900 };
const DISCOUNTS   = { 1: 0, 3: 5, 6: 10, 12: 15 };
const PLAN_LABELS = { starter: 'Starter', business: 'Business', enterprise: 'Enterprise' };

/**
 * Crea un link de pago en Wompi.
 * Docs: POST https://api.wompi.co/v1/payment_links
 *
 * - amount_in_cents: monto en centavos COP (valor × 100)
 * - single_use: true  (link de un solo uso por pago)
 * - currency: "COP"
 * - redirect_url: URL de retorno tras el pago
 */
async function createWompiLink({ amountCOP, description, redirectUrl, reference }) {
  const WOMPI_PRIVATE_KEY = process.env.WOMPI_PRIVATE_KEY;
  if (!WOMPI_PRIVATE_KEY) throw new Error('WOMPI_PRIVATE_KEY no configurada en las variables de entorno.');

  // Seleccionar endpoint según tipo de llave (test vs producción)
  const isTest = WOMPI_PRIVATE_KEY.startsWith('prv_test_');
  const baseUrl = isTest
    ? 'https://sandbox.wompi.co/v1'
    : 'https://api.wompi.co/v1';

  const body = {
    name:              description.slice(0, 60),
    description:       description.slice(0, 255),
    single_use:        true,
    collect_shipping:  false,
    currency:          'COP',
    amount_in_cents:   amountCOP * 100,
    expires_in_days:   2,
    redirect_url:      redirectUrl,
    ...(reference && { reference }),
  };

  const r = await fetch(`${baseUrl}/payment_links`, {
    method:  'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization:  `Bearer ${WOMPI_PRIVATE_KEY}`,
    },
    body: JSON.stringify(body),
  });

  const data = await r.json().catch(() => ({}));

  if (!r.ok) {
    const errMsg = data?.error?.messages
      ? Object.values(data.error.messages).flat().join(', ')
      : (data?.error?.type || r.status);
    throw new Error(`Wompi API ${r.status}: ${errMsg}`);
  }

  console.log('[wompi] response:', JSON.stringify(data));

  // permalink puede venir directo o hay que construirlo desde el id
  const id  = data?.data?.id;
  const url = data?.data?.permalink || (id ? `https://checkout.wompi.co/l/${id}` : null);

  return { url, payment_id: id };
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

  /* ── POST: crear link de pago Wompi ─────────────────── */
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
    const appUrl      = process.env.VITE_APP_URL || 'https://chat-pay-six.vercel.app';
    const redirectUrl = `${appUrl}/suscripcion?payment=pending&plan=${plan}&months=${m}`;
    const description = `ChatPay Plan ${PLAN_LABELS[plan]} ${m}mes${m > 1 ? 'es' : ''}${discount > 0 ? ` -${discount}%` : ''}`;
    // reference permite al webhook identificar qué empresa pagó y qué plan activar
    const reference   = `${companyId}|${plan}|${m}`;

    let wompiResult;
    try {
      wompiResult = await createWompiLink({ amountCOP: total, description, redirectUrl, reference });
    } catch (err) {
      console.error('[subscription/payment] Wompi error:', err.message);
      return res.status(502).json({ error: `No se pudo crear el link de pago: ${err.message}` });
    }

    if (!wompiResult?.url) return res.status(502).json({ error: 'Wompi no devolvió una URL de pago.', debug: wompiResult });

    return res.json({
      url:        wompiResult.url,
      payment_id: wompiResult.payment_id,
      amount:     total,
      plan,
      months:     m,
      discount,
    });
  }

  return res.status(405).end();
}
