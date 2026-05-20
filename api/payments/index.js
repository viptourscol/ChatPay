/**
 * api/payments/index.js
 *
 * POST /api/payments
 * Crea un link de pago en Bold para renovar la suscripción.
 *
 * Body: { plan: 'starter'|'business'|'enterprise', months: 1|3|6|12 }
 * Responde: { url: string }   — URL de checkout de Bold
 */
import { requireUser } from '../../lib/auth.js';
import { supabaseAdmin } from '../../lib/supabase.js';

/* ─── Precios base por plan (COP) ─────────────────────── */
const BASE_PRICES = {
  starter:    49900,
  business:   129900,
  enterprise: 299900,
};

/* ─── Descuentos por duración ────────────────────────── */
const DISCOUNTS = {
  1:  0,    // 0 %
  3:  5,    // 5 %
  6:  10,   // 10 %
  12: 15,   // 15 %
};

const PLAN_LABELS = {
  starter:    'Starter',
  business:   'Business',
  enterprise: 'Enterprise',
};

/**
 * Crea un link de pago en Bold y devuelve la URL.
 * Docs: https://developers.bold.co/reference/create-payment-link
 */
async function createBoldLink({ amount, description, orderId, callbackUrl }) {
  const BOLD_API_KEY = process.env.BOLD_API_KEY;
  if (!BOLD_API_KEY) throw new Error('BOLD_API_KEY no configurada.');

  const expiresAt = Math.floor(Date.now() / 1000) + 60 * 60 * 24; // 24 h

  const body = {
    amount: {
      local: {
        total:    amount,
        currency: 'COP',
      },
    },
    description,
    expiration_date: expiresAt,
    order_id:        orderId,
    redirect_url:    callbackUrl,
    callback_url:    callbackUrl,
    payment_methods: ['CARD', 'PSE', 'NEQUI'],
  };

  const res = await fetch('https://integrations.api.bold.co/online/link/v1/payment-links', {
    method:  'POST',
    headers: {
      'Content-Type':  'application/json',
      Authorization:   `x-api-key ${BOLD_API_KEY}`,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`Bold API error ${res.status}: ${txt}`);
  }

  const data = await res.json();
  // Bold devuelve el URL en data.payload.url o data.payload.payment_link
  return data?.payload?.url || data?.payload?.payment_link || data?.url;
}

/* ─── Handler ─────────────────────────────────────────── */
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).end();

  /* Auth — no bloqueamos si la cuenta está suspendida, solo necesitamos el userId */
  const user = await requireUser(req, res);
  if (!user) return;

  const { plan = 'starter', months = 1 } = req.body || {};

  if (!BASE_PRICES[plan]) {
    return res.status(400).json({ error: 'Plan inválido.' });
  }
  if (![1, 3, 6, 12].includes(Number(months))) {
    return res.status(400).json({ error: 'Duración inválida. Use 1, 3, 6 o 12.' });
  }

  const m          = Number(months);
  const base       = BASE_PRICES[plan];
  const discount   = DISCOUNTS[m] ?? 0;
  const subtotal   = base * m;
  const totalCOP   = Math.round(subtotal * (1 - discount / 100));
  const planLabel  = PLAN_LABELS[plan];

  /* Obtener company_id para incluirlo en el orderId */
  const { data: company } = await supabaseAdmin
    .from('companies')
    .select('id, name')
    .eq('user_id', user.id)
    .maybeSingle();

  const companyId = company?.id || user.id;
  const orderId   = `chatpay-${companyId.slice(0, 8)}-${plan}-${m}m-${Date.now()}`;

  const appUrl     = process.env.VITE_APP_URL || 'https://chat-pay-six.vercel.app';
  const callbackUrl = `${appUrl}/suscripcion?payment=success&plan=${plan}&months=${m}&order=${orderId}`;

  const description = `ChatPay · Plan ${planLabel} · ${m} mes${m > 1 ? 'es' : ''}${discount > 0 ? ` (${discount}% desc.)` : ''}`;

  let url;
  try {
    url = await createBoldLink({ amount: totalCOP, description, orderId, callbackUrl });
  } catch (err) {
    console.error('[payments] Bold error:', err.message);
    return res.status(502).json({ error: `No se pudo crear el link de pago: ${err.message}` });
  }

  if (!url) {
    return res.status(502).json({ error: 'Bold no devolvió una URL de pago.' });
  }

  return res.json({ url, orderId, amount: totalCOP, plan, months: m, discount });
}
