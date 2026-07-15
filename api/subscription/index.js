/**
 * api/subscription/index.js
 *
 * GET  /api/subscription                        — estado de suscripción y métricas
 * GET  /api/subscription?action=cron-reminders  — cron diario de recordatorios WhatsApp
 * POST /api/subscription                        — crear link de pago en Wompi
 */
import { requireUser } from '../../lib/auth.js';
import { requireCompany, getCompany } from '../../lib/getCompany.js';
import { supabaseAdmin } from '../../lib/supabase.js';
import { getMonthlyVerificationCount, PLANS } from '../../lib/subscription.js';
/* ─── Lógica de recordatorios de vencimiento ──────────── */
const PLAN_PRICES_LABEL = {
  basico: '$49.900', estandar: '$99.900', pro: '$199.900', empresarial: '$349.900',
  starter: '$49.900', business: '$99.900', enterprise: '$349.900',
};

const GRAPH    = 'https://graph.facebook.com/v21.0';
const WA_TOKEN = () => process.env.WHATSAPP_TOKEN;
const PHONE_ID = () => process.env.WHATSAPP_PHONE_NUMBER_ID;

function _fmtDate(isoDate) {
  const d = new Date(isoDate);
  return `${String(d.getUTCDate()).padStart(2,'0')}/${String(d.getUTCMonth()+1).padStart(2,'0')}/${d.getUTCFullYear()}`;
}

function _normalizePhone(phone) {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, '');
  if (/^57\d{10}$/.test(digits)) return digits;
  if (/^\d{10}$/.test(digits)) return `57${digits}`;
  return digits || null;
}

/**
 * Envía un mensaje usando plantilla aprobada de WhatsApp.
 * stage: '1d' | '0d' | 'post'
 */
async function _sendReminderTemplate(to, stage, { firstName, planLabel, planPrice, expiresAt }) {
  const TEMPLATES = {
    '1d':   { name: 'recordatorio_plan_1d',   params: [firstName, _fmtDate(expiresAt), planLabel, planPrice] },
    '0d':   { name: 'recordatorio_plan_0d',   params: [firstName, planLabel, planPrice] },
    'post': { name: 'recordatorio_plan_post', params: [] },
  };
  const tpl = TEMPLATES[stage];
  if (!tpl) throw new Error(`Stage desconocido: ${stage}`);

  const body = {
    messaging_product: 'whatsapp',
    to,
    type: 'template',
    template: {
      name: tpl.name,
      language: { code: 'es_CO' },
      ...(tpl.params.length > 0 && {
        components: [{
          type: 'body',
          parameters: tpl.params.map(p => ({ type: 'text', text: String(p || '') })),
        }],
      }),
    },
  };

  const res = await fetch(`${GRAPH}/${PHONE_ID()}/messages`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${WA_TOKEN()}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`WhatsApp template error ${res.status}: ${err}`);
  }
  return res.json();
}

async function handleCronReminders(req, res) {
  const isTest     = req.query?.test === 'true';
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = req.headers['authorization'] || '';
  if (!isTest && (!cronSecret || authHeader !== `Bearer ${cronSecret}`)) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const now          = new Date();
  const todayUTC     = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const tomorrowUTC  = new Date(todayUTC); tomorrowUTC.setUTCDate(todayUTC.getUTCDate() + 1);
  const yesterdayUTC = new Date(todayUTC); yesterdayUTC.setUTCDate(todayUTC.getUTCDate() - 1);
  const todayStr     = todayUTC.toISOString().slice(0, 10);
  const tomorrowStr  = tomorrowUTC.toISOString().slice(0, 10);
  const yesterdayStr = yesterdayUTC.toISOString().slice(0, 10);

  const { data: companies, error } = await supabaseAdmin
    .from('companies')
    .select('id, user_id, name, plan, admin_whatsapp, subscription_expires_at, subscription_reminder_sent')
    .not('admin_whatsapp', 'is', null)
    .not('subscription_expires_at', 'is', null)
    .gte('subscription_expires_at', `${yesterdayStr}T00:00:00Z`)
    .lte('subscription_expires_at', `${tomorrowStr}T23:59:59Z`);

  if (error) return res.status(500).json({ error: error.message });

  const results = [];
  for (const company of companies || []) {
    const expiresDate = company.subscription_expires_at.slice(0, 10);
    const sent        = company.subscription_reminder_sent || {};
    const phone       = _normalizePhone(company.admin_whatsapp);
    if (!phone) { results.push({ company: company.name, skipped: 'no valid phone' }); continue; }

    let stage = null;
    if (expiresDate === tomorrowStr) stage = '1d';
    else if (expiresDate === todayStr)    stage = '0d';
    else if (expiresDate === yesterdayStr) stage = 'post';
    if (!stage) { results.push({ company: company.name, skipped: 'no matching stage' }); continue; }
    if (sent[stage] === todayStr) { results.push({ company: company.name, stage, skipped: 'already sent today' }); continue; }

    // Obtener nombre del admin
    let firstName = company.name;
    try {
      const { data: ud } = await supabaseAdmin.auth.admin.getUserById(company.user_id);
      const meta = ud?.user?.user_metadata || {};
      const fullName = meta.full_name || meta.name || ud?.user?.email?.split('@')[0];
      if (fullName) firstName = fullName.split(' ')[0];
    } catch { /* usa nombre empresa como fallback */ }

    const planLabel  = PLAN_LABELS[company.plan] || company.plan || 'Básico';
    const planPrice  = PLAN_PRICES_LABEL[company.plan] || '';
    const tplParams  = { firstName, planLabel, planPrice, expiresAt: company.subscription_expires_at };

    if (isTest) { results.push({ company: company.name, stage, phone, template: `recordatorio_plan_${stage}`, params: tplParams, test: true }); continue; }

    try {
      await _sendReminderTemplate(phone, stage, tplParams);
      await supabaseAdmin.from('companies').update({ subscription_reminder_sent: { ...sent, [stage]: todayStr } }).eq('id', company.id);
      results.push({ company: company.name, stage, phone, status: 'sent' });
      console.log(`[cron/reminders] stage=${stage} → ${company.name} (${phone})`);
    } catch (err) {
      results.push({ company: company.name, stage, phone, status: 'failed', error: err.message });
      console.error(`[cron/reminders] error stage=${stage} → ${company.name}:`, err.message);
    }
  }
  return res.json({ date: todayStr, processed: results.length, test: isTest, results });
}

/* ─── Precios y descuentos ────────────────────────────── */
const BASE_PRICES = {
  basico:      49900,
  estandar:    99900,
  pro:         199900,
  empresarial: 349900,
  // compat nombres anteriores
  starter:     49900,
  business:    99900,
  enterprise:  349900,
};
const DISCOUNTS   = { 1: 0, 3: 5, 6: 10, 12: 15 };
const PLAN_LABELS = {
  basico:      'Básico',
  estandar:    'Estándar',
  pro:         'Pro',
  empresarial: 'Empresarial',
  starter:     'Básico',
  business:    'Estándar',
  enterprise:  'Empresarial',
};

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

  /* ── Cron: no requiere usuario JWT ─────────────────── */
  if (req.method === 'GET' && req.query?.action === 'cron-reminders') {
    return handleCronReminders(req, res);
  }

  const user = await requireUser(req, res);
  if (!user) return;

  /* ── GET: estado de suscripción ─────────────────────── */
  if (req.method === 'GET') {
    // Usar getCompany (no requireCompany) para que funcione aunque esté suspendida
    // El PaymentWall necesita este endpoint para mostrar estado y crear link de pago
    const company = await getCompany(user.id);
    if (!company) return res.status(404).json({ error: 'Empresa no encontrada' });

    const companyId = company.id;
    const [verifications_used, { count: employees_count }, { count: bank_accounts_count }, { data: payments }] = await Promise.all([
      getMonthlyVerificationCount(companyId),
      supabaseAdmin.from('employees').select('id', { count: 'exact', head: true }).eq('company_id', companyId).eq('is_active', true),
      supabaseAdmin.from('company_bank_accounts').select('id', { count: 'exact', head: true }).eq('company_id', companyId),
      supabaseAdmin.from('subscription_payments').select('id, plan, months, amount_cop, status, created_at').eq('company_id', companyId).order('created_at', { ascending: false }).limit(10),
    ]);    const planDef = PLANS[company.plan];

    return res.json({
      plan:                    company.plan || 'starter',
      subscription_status:     company.subscription_status || 'trial',
      trial_ends_at:           company.trial_ends_at || null,
      subscription_expires_at: company.subscription_expires_at || null,
      is_active:               company.is_active,
      max_employees:           planDef?.maxEmployees           ?? company.max_employees           ?? 1,
      max_verifications_month: planDef?.maxVerificationsMonth  ?? company.max_verifications_month ?? 200,
      max_bank_accounts:       planDef?.maxBankAccounts        ?? company.max_bank_accounts       ?? 1,
      verifications_used,
      employees_count:         employees_count || 0,
      bank_accounts_count:     bank_accounts_count || 0,
      payments:                payments || [],
    });
  }

  /* ── POST: crear link de pago Wompi o verificar transacción ────────────── */
  if (req.method === 'POST') {
    const body = req.body || {};

    // --- Acción: verificar transacción tras redirect de Wompi ---
    if (body.action === 'verify' || body.transactionId) {
      const { transactionId } = body;
      if (!transactionId) return res.status(400).json({ error: 'transactionId requerido' });

      const WOMPI_PRIVATE_KEY = process.env.WOMPI_PRIVATE_KEY;
      const isTestKey = WOMPI_PRIVATE_KEY?.startsWith('prv_test_');
      const wBaseUrl  = isTestKey ? 'https://sandbox.wompi.co/v1' : 'https://api.wompi.co/v1';

      const wr = await fetch(`${wBaseUrl}/transactions/${transactionId}`, {
        headers: { Authorization: `Bearer ${WOMPI_PRIVATE_KEY}` },
      });

      if (!wr.ok) {
        const we = await wr.json().catch(() => ({}));
        console.error('[verify] Wompi error:', wr.status, JSON.stringify(we));
        return res.status(502).json({ error: 'No se pudo consultar la transacción', status: wr.status });
      }

      const { data: wtx } = await wr.json();
      console.log('[verify] Wompi tx:', JSON.stringify({ id: wtx?.id, status: wtx?.status, reference: wtx?.reference }));
      if (!wtx || wtx.status !== 'APPROVED') {
        return res.json({ activated: false, status: wtx?.status || 'UNKNOWN' });
      }

      // Obtener plan/meses: primero del body (enviado por el frontend), luego fallback a la reference de Wompi
      let vPlan   = body.plan;
      let vMonths = parseInt(body.months) || 1;

      if (!vPlan) {
        // Intentar parsear desde reference de la transacción
        const vParts = (wtx.reference || '').split('|');
        if (vParts.length >= 2) {
          vPlan   = vParts[1];
          vMonths = parseInt(vParts[2]) || 1;
        }
      }

      if (!vPlan || !BASE_PRICES[vPlan]) {
        console.error('[verify] No se pudo determinar el plan. reference:', wtx.reference, 'body.plan:', body.plan);
        return res.json({ activated: false, reason: 'no se pudo determinar el plan' });
      }

      // Obtener empresa del usuario autenticado (más seguro que confiar en la URL)
      const { data: vCompany } = await supabaseAdmin
        .from('companies').select('id').eq('user_id', user.id).maybeSingle();
      if (!vCompany) return res.status(404).json({ error: 'Empresa no encontrada' });      const PLAN_LIMITS = {
        basico:      { max_employees: 1,  max_verifications_month: 300,   max_bank_accounts: 1 },
        estandar:    { max_employees: 2,  max_verifications_month: 800,   max_bank_accounts: 2 },
        pro:         { max_employees: 5,  max_verifications_month: 2500,  max_bank_accounts: 4 },
        empresarial: { max_employees: 10, max_verifications_month: 10000, max_bank_accounts: 8 },
        // compat nombres anteriores
        starter:     { max_employees: 1,  max_verifications_month: 300,   max_bank_accounts: 1 },
        business:    { max_employees: 2,  max_verifications_month: 800,   max_bank_accounts: 2 },
        enterprise:  { max_employees: 10, max_verifications_month: 10000, max_bank_accounts: 8 },
      };
      const vLimits    = PLAN_LIMITS[vPlan] || PLAN_LIMITS.starter;
      const vExpiresAt = new Date();
      vExpiresAt.setMonth(vExpiresAt.getMonth() + vMonths);

      // Siempre actualizamos la empresa (idempotente — mismos valores si se llama dos veces)
      const { error: vDbErr } = await supabaseAdmin.from('companies').update({
        plan:                    vPlan,
        subscription_status:     'active',
        is_active:               true,
        trial_ends_at:           null,
        subscription_expires_at: vExpiresAt.toISOString(),
        max_employees:           vLimits.max_employees,
        max_verifications_month: vLimits.max_verifications_month,
        max_bank_accounts:       vLimits.max_bank_accounts,
      }).eq('id', vCompany.id);

      if (vDbErr) return res.status(500).json({ error: vDbErr.message });

      // Idempotencia de pago: solo insertar si no existe ya
      const { data: existingPayment } = await supabaseAdmin
        .from('subscription_payments')
        .select('id')
        .eq('wompi_tx_id', transactionId)
        .maybeSingle();

      if (!existingPayment) {
        await supabaseAdmin.from('subscription_payments').insert({
          company_id:  vCompany.id,
          wompi_tx_id: transactionId,
          plan:        vPlan,
          months:      vMonths,
          amount_cop:  wtx.amount_in_cents ? Math.round(wtx.amount_in_cents / 100) : 0,
          status:      'approved',
        });
      }

      console.log(`[verify] Suscripción activada: empresa=${vCompany.id} plan=${vPlan} meses=${vMonths} vence=${vExpiresAt.toISOString()}`);
      return res.json({ activated: true, plan: vPlan, months: vMonths, expiresAt: vExpiresAt.toISOString() });
    }

    // --- Acción: crear link de pago Wompi ---
    // Para pagos NO requerimos requireCompany (la cuenta puede estar suspendida)
    const { plan = 'starter', months = 1 } = body;

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
