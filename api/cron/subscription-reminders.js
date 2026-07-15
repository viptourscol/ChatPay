/**
 * api/cron/subscription-reminders.js
 *
 * Cron job diario que detecta empresas con suscripción por vencer y envía
 * mensajes WhatsApp de recordatorio al admin.
 *
 * Etapas:
 *   1d   → 1 día antes: aviso con precio y descuentos disponibles
 *   0d   → mismo día que vence: alerta urgente
 *   post → día siguiente (ya suspendido): mensaje de seguimiento
 *
 * Invocado por Vercel Crons (vercel.json) — valida Authorization: Bearer {CRON_SECRET}.
 * También acepta GET ?test=true para revisar qué empresas recibirían notificación sin enviar.
 */

import { supabaseAdmin } from '../../lib/supabase.js';
import { sendMessage }   from '../../lib/whatsapp.js';

/* ─── Precios por plan ────────────────────────────────── */
const PLAN_LABELS = {
  basico:      'Básico',
  estandar:    'Estándar',
  pro:         'Pro',
  empresarial: 'Empresarial',
  starter:     'Básico',
  business:    'Estándar',
  enterprise:  'Empresarial',
};

const PLAN_PRICES = {
  basico:      '$49.900',
  estandar:    '$99.900',
  pro:         '$199.900',
  empresarial: '$349.900',
  starter:     '$49.900',
  business:    '$99.900',
  enterprise:  '$349.900',
};

/* ─── Formatear fecha DD/MM/YYYY ──────────────────────── */
function formatDate(isoDate) {
  const d = new Date(isoDate);
  const day   = String(d.getUTCDate()).padStart(2, '0');
  const month = String(d.getUTCMonth() + 1).padStart(2, '0');
  const year  = d.getUTCFullYear();
  return `${day}/${month}/${year}`;
}

/* ─── Mensajes por etapa ──────────────────────────────── */
function buildMessage(stage, { adminName, companyName, plan, expiresAt }) {
  const firstName  = (adminName || companyName || 'Admin').split(' ')[0];
  const planLabel  = PLAN_LABELS[plan] || plan;
  const planPrice  = PLAN_PRICES[plan] || '';
  const dateStr    = formatDate(expiresAt);

  if (stage === '1d') {
    return (
      `Hola ${firstName} 😊\n\n` +
      `Tu plan de ChatPay vence mañana ${dateStr} 📅.\n` +
      `Valor del plan: ${planLabel} ${planPrice} 🧾.\n\n` +
      `Puedes realizar tu pago a través de la pasarela Wompi integrada en la sección *Suscripción* de ChatPay, o mediante la llave Bre-B 💳.\n\n` +
      `Obtén un descuento especial según el periodo que elijas: *3% trimestral*, *6% semestral* y *20% anual*. ¿Qué opción prefieres?`
    );
  }

  if (stage === '0d') {
    return (
      `⚠️ Hola ${firstName}, tu plan de ChatPay vence *hoy* 🚨.\n\n` +
      `Valor del plan: ${planLabel} ${planPrice}\n\n` +
      `Para evitar interrupciones en el servicio, realiza tu pago lo antes posible en la sección *Suscripción* de ChatPay.\n\n` +
      `Recuerda que puedes obtener hasta un *20% de descuento* pagando anual 💡.`
    );
  }

  if (stage === 'post') {
    return (
      `Hola, ¿cómo estás? 👋\n\n` +
      `Te recuerdo que está pendiente la renovación de tu plan para que sigas contando con la confirmación de transferencias y la protección frente a comprobantes falsos sin interrupciones.\n\n` +
      `Apenas hagas el pago, compártenos el comprobante por este medio para mantener tu cuenta al día. ¿Te ayudo con algo?\n\n` +
      `⚠️ Tu plan ha sido suspendido automáticamente. Para reactivar el servicio, por favor contáctanos.`
    );
  }

  return null;
}

/* ─── Obtener nombre del admin desde Supabase Auth ───── */
async function getAdminName(userId) {
  try {
    const { data, error } = await supabaseAdmin.auth.admin.getUserById(userId);
    if (error || !data?.user) return null;
    const meta = data.user.user_metadata || {};
    return meta.full_name || meta.name || data.user.email?.split('@')[0] || null;
  } catch {
    return null;
  }
}

/* ─── Normalizar número a formato E.164 sin + ────────── */
function normalizePhone(phone) {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, '');
  if (/^57\d{10}$/.test(digits)) return digits;
  if (/^\d{10}$/.test(digits)) return `57${digits}`;
  return digits || null;
}

/* ─── Handler principal ───────────────────────────────── */
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') return res.status(204).end();

  /* ── Autenticación: solo Vercel Cron o secret manual ── */
  const isTest = req.query?.test === 'true';

  if (!isTest) {
    const cronSecret = process.env.CRON_SECRET;
    const authHeader = req.headers['authorization'] || '';
    if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
  }

  /* ── Fecha de hoy en UTC (solo la parte date) ─────── */
  const now       = new Date();
  const todayUTC  = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));

  const tomorrowUTC  = new Date(todayUTC); tomorrowUTC.setUTCDate(todayUTC.getUTCDate() + 1);
  const yesterdayUTC = new Date(todayUTC); yesterdayUTC.setUTCDate(todayUTC.getUTCDate() - 1);

  const todayStr      = todayUTC.toISOString().slice(0, 10);
  const tomorrowStr   = tomorrowUTC.toISOString().slice(0, 10);
  const yesterdayStr  = yesterdayUTC.toISOString().slice(0, 10);

  /* ── Consultar empresas con suscripción relevante ─── */
  // Incluye: vence mañana, vence hoy, venció ayer
  const { data: companies, error } = await supabaseAdmin
    .from('companies')
    .select('id, user_id, name, plan, admin_whatsapp, subscription_expires_at, subscription_reminder_sent')
    .not('admin_whatsapp', 'is', null)
    .not('subscription_expires_at', 'is', null)
    .gte('subscription_expires_at', `${yesterdayStr}T00:00:00Z`)
    .lte('subscription_expires_at', `${tomorrowStr}T23:59:59Z`);

  if (error) {
    console.error('[cron/subscription-reminders] DB error:', error.message);
    return res.status(500).json({ error: error.message });
  }

  const results = [];

  for (const company of companies || []) {
    const expiresDate = company.subscription_expires_at.slice(0, 10);
    const sent        = company.subscription_reminder_sent || {};
    const phone       = normalizePhone(company.admin_whatsapp);

    if (!phone) {
      results.push({ company: company.name, skipped: 'no valid phone' });
      continue;
    }

    // Determinar etapa según fecha
    let stage = null;
    if (expiresDate === tomorrowStr) stage = '1d';
    else if (expiresDate === todayStr)   stage = '0d';
    else if (expiresDate === yesterdayStr) stage = 'post';

    if (!stage) {
      results.push({ company: company.name, skipped: 'no matching stage' });
      continue;
    }

    // Verificar si ya se envió hoy para esta etapa
    if (sent[stage] === todayStr) {
      results.push({ company: company.name, stage, skipped: 'already sent today' });
      continue;
    }

    const adminName = await getAdminName(company.user_id);
    const message   = buildMessage(stage, {
      adminName,
      companyName: company.name,
      plan:        company.plan || 'basico',
      expiresAt:   company.subscription_expires_at,
    });

    if (!message) {
      results.push({ company: company.name, stage, skipped: 'no message built' });
      continue;
    }

    if (isTest) {
      // Modo test: solo reportar sin enviar
      results.push({ company: company.name, stage, phone, message, test: true });
      continue;
    }

    // Enviar mensaje WhatsApp
    try {
      await sendMessage(phone, message, {
        companyId:   company.id,
        messageType: `subscription_reminder_${stage}`,
      });

      // Marcar etapa como enviada
      const updatedSent = { ...sent, [stage]: todayStr };
      await supabaseAdmin
        .from('companies')
        .update({ subscription_reminder_sent: updatedSent })
        .eq('id', company.id);

      results.push({ company: company.name, stage, phone, status: 'sent' });
      console.log(`[cron/reminders] Enviado stage=${stage} → ${company.name} (${phone})`);
    } catch (err) {
      results.push({ company: company.name, stage, phone, status: 'failed', error: err.message });
      console.error(`[cron/reminders] Error stage=${stage} → ${company.name}:`, err.message);
    }
  }

  return res.json({
    date:       todayStr,
    processed:  results.length,
    test:       isTest,
    results,
  });
}
