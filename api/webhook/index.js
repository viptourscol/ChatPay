/**
 * api/webhook/index.js
 *
 * Webhook unificado para WhatsApp y Wompi, enrutado por ?provider=
 *
 * Rutas (vercel.json rewrites):
 *   /api/webhook/whatsapp  →  /api/webhook?provider=whatsapp
 *   /api/webhook/wompi     →  /api/webhook?provider=wompi
 */
import { createHmac }               from 'crypto';
import { supabaseAdmin }            from '../../lib/supabase.js';
import { sendMessage, downloadMedia, sendPaymentNotification } from '../../lib/whatsapp.js';
import { extractComprobanteData }   from '../../lib/groq.js';
import { matchTransaction, buildResponseMessage } from '../../lib/matcher.js';
import { checkVerificationLimit }   from '../../lib/subscription.js';

export const config = { api: { bodyParser: true } };

// ─── Límites por plan ────────────────────────────────────────────────────────
const PLAN_LIMITS = {
  starter:    { max_employees: 1,        max_verifications_month: 200,    max_bank_accounts: 1 },
  business:   { max_employees: 20,       max_verifications_month: 1000,   max_bank_accounts: 3 },
  enterprise: { max_employees: 999999,   max_verifications_month: 999999, max_bank_accounts: 999999 },
};

// ─── Wompi ───────────────────────────────────────────────────────────────────
async function handleWompi(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const event = req.body;
  const { event: eventType, data, signature } = event || {};

  if (eventType !== 'transaction.updated') return res.status(200).json({ ok: true });

  const tx = data?.transaction;
  if (!tx || tx.status !== 'APPROVED') return res.status(200).json({ ok: true });

  // Verificar firma si está configurado WOMPI_EVENTS_SECRET
  const eventsSecret = process.env.WOMPI_EVENTS_SECRET;
  if (eventsSecret && signature?.checksum) {
    const chain = (signature.properties || []).map(p =>
      p.split('.').reduce((obj, key) => obj?.[key], event)
    ).join('') + eventsSecret;
    const computed = createHmac('sha256', eventsSecret).update(chain).digest('hex');
    if (computed !== signature.checksum) {
      console.error('[wompi-webhook] Firma inválida');
      return res.status(401).json({ error: 'Firma inválida' });
    }
  }

  // Decodificar reference: "companyId|plan|months"
  const parts = (tx.reference || '').split('|');
  if (parts.length < 2) {
    console.log('[wompi-webhook] reference sin formato esperado:', tx.reference);
    return res.status(200).json({ ok: true });
  }

  const [companyId, plan, monthsStr] = parts;
  const months = parseInt(monthsStr) || 1;
  const limits = PLAN_LIMITS[plan] || PLAN_LIMITS.starter;

  const expiresAt = new Date();
  expiresAt.setMonth(expiresAt.getMonth() + months);

  const { error } = await supabaseAdmin
    .from('companies')
    .update({
      plan,
      subscription_status:     'active',
      is_active:               true,
      trial_ends_at:           null,
      subscription_expires_at: expiresAt.toISOString(),
      max_employees:           limits.max_employees,
      max_verifications_month: limits.max_verifications_month,
      max_bank_accounts:       limits.max_bank_accounts,
    })
    .eq('id', companyId);

  if (error) {
    console.error('[wompi-webhook] Error actualizando empresa:', error.message);
    return res.status(500).json({ error: error.message });
  }

  console.log(`[wompi-webhook] Activo: empresa=${companyId} plan=${plan} meses=${months} vence=${expiresAt.toISOString()}`);
  return res.status(200).json({ ok: true });
}

// ─── WhatsApp ────────────────────────────────────────────────────────────────
async function handleWhatsApp(req, res) {
  // Verificación de webhook (Meta GET)
  if (req.method === 'GET') {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];
    if (mode === 'subscribe' && token === process.env.WHATSAPP_VERIFY_TOKEN) {
      return res.status(200).send(challenge);
    }
    return res.status(403).send('forbidden');
  }

  if (req.method !== 'POST') return res.status(405).end();

  try {
    const entry = req.body?.entry?.[0];
    const change = entry?.changes?.[0]?.value;
    const message = change?.messages?.[0];
    if (!message) return res.status(200).json({ received: true });

    const from = message.from;
    const fromE164 = `+${from}`;
    const wamid = message.id;

    // Idempotencia
    const { data: existing } = await supabaseAdmin
      .from('verifications')
      .select('id')
      .eq('whatsapp_message_id', wamid)
      .maybeSingle();
    if (existing) return res.status(200).json({ received: true });

    const { data: employee } = await supabaseAdmin
      .from('employees')
      .select('*')
      .eq('whatsapp_number', fromE164)
      .eq('is_active', true)
      .maybeSingle();

    if (!employee) {
      await sendMessage(from, '🚫 Tu número no está autorizado para verificar pagos. Contacta al administrador.');
      await supabaseAdmin.from('verifications').insert({
        whatsapp_message_id: wamid,
        whatsapp_from: fromE164,
        status: 'error',
        notes: 'empleado no autorizado'
      });
      return res.status(200).json({ received: true });
    }

    const companyId = employee.company_id;

    if (message.type === 'text') {
      const text = message.text?.body?.trim();
      const { data: pending } = await supabaseAdmin
        .from('disambiguations')
        .select('*')
        .eq('whatsapp_from', fromE164)
        .eq('resolved', false)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (pending && /^[1-9]$/.test(text)) {
        const idx = parseInt(text, 10) - 1;
        const txId = pending.candidate_ids[idx];
        if (!txId) {
          await sendMessage(from, `Opción inválida. Responde con un número entre 1 y ${pending.candidate_ids.length}.`);
          return res.status(200).json({ received: true });
        }
        const { data: tx } = await supabaseAdmin.from('transactions').select('*').eq('id', txId).maybeSingle();
        await supabaseAdmin.from('transactions').update({ status: 'confirmed' }).eq('id', txId);
        await supabaseAdmin.from('disambiguations').update({ resolved: true }).eq('id', pending.id);
        const responseText = buildResponseMessage({
          status: 'real',
          employeeName: employee.name,
          amount: tx?.amount,
          senderName: tx?.sender_name,
          transactionDate: tx?.transaction_date,
          transactionId: tx?.id
        });
        await sendMessage(from, responseText);
        await supabaseAdmin.from('verifications').insert({
          employee_id: employee.id,
          transaction_id: txId,
          company_id: companyId,
          status: 'real',
          extracted_amount: pending.extracted_amount,
          extracted_reference: pending.extracted_reference,
          comprobante_image_url: pending.comprobante_image_url,
          whatsapp_message_id: wamid,
          whatsapp_from: fromE164,
          response_text: responseText,
          notes: 'confirmado por selección manual'
        });
        return res.status(200).json({ received: true });
      }

      await sendMessage(
        from,
        `Hola ${employee.name} 👋\nEnvíame la *foto del comprobante* de pago para verificarlo.`
      );
      return res.status(200).json({ received: true });
    }

    if (message.type !== 'image') return res.status(200).json({ received: true });

    const verifyLimit = await checkVerificationLimit(companyId);
    if (!verifyLimit.ok) {
      await sendMessage(from, `⚠️ ${verifyLimit.reason}`);
      return res.status(200).json({ received: true });
    }

    const { buffer, mimeType } = await downloadMedia(message.image.id);
    const ext = mimeType.split('/')[1] || 'jpg';
    const path = `${employee.id}/${Date.now()}-${wamid}.${ext}`;
    const { error: upErr } = await supabaseAdmin.storage
      .from('comprobantes')
      .upload(path, buffer, { contentType: mimeType, upsert: false });
    if (upErr) console.error('[storage] upload', upErr);

    const { data: signed } = await supabaseAdmin.storage
      .from('comprobantes')
      .createSignedUrl(path, 60 * 60 * 24 * 7);

    let extracted = {};
    try {
      extracted = await extractComprobanteData(signed.signedUrl);
    } catch (e) {
      console.error('[groq] error', e);
    }

    if (!extracted?.is_receipt) {
      await sendMessage(from, `${employee.name}, no parece un comprobante de pago válido. Envía una foto clara del comprobante.`);
      await supabaseAdmin.from('verifications').insert({
        employee_id: employee.id,
        company_id: companyId,
        whatsapp_message_id: wamid,
        whatsapp_from: fromE164,
        comprobante_image_url: path,
        status: 'error',
        notes: 'no es comprobante (OCR)'
      });
      return res.status(200).json({ received: true });
    }

    const { transaction, status, candidates } = await matchTransaction({
      amount: extracted.amount,
      reference: extracted.reference,
      date: extracted.date,
      senderName: extracted.sender_name,
      companyId
    });

    if (status === 'ambiguous') {
      await supabaseAdmin.from('disambiguations').insert({
        employee_id: employee.id,
        company_id: companyId,
        whatsapp_from: fromE164,
        candidate_ids: candidates.map(c => c.id),
        comprobante_image_url: path,
        extracted_amount: extracted.amount,
        extracted_reference: extracted.reference,
        extracted_date: extracted.date ? new Date(extracted.date).toISOString() : null,
        extracted_sender: extracted.sender_name
      });
      const fmt = extracted.amount ? `$${Number(extracted.amount).toLocaleString('es-CO')}` : '';
      const list = candidates.map((c, i) => {
        const d = new Date(c.transaction_date).toLocaleString('es-CO', {
          timeZone: 'America/Bogota', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit'
        });
        return `${i + 1}. ${c.sender_name || 'Sin nombre'} — ${d}`;
      }).join('\n');
      await sendMessage(from,
        `${employee.name}, encontré ${candidates.length} pagos pendientes de ${fmt}:\n\n${list}\n\n¿Cuál corresponde a este comprobante? Responde con el número.`
      );
      return res.status(200).json({ received: true });
    }

    const responseParams = {
      status,
      employeeName: employee.name,
      amount: extracted.amount,
      reference: extracted.reference,
      senderName: transaction?.sender_name || extracted.sender_name,
      transactionDate: transaction?.transaction_date,
      transactionId: transaction?.id
    };

    if (status === 'duplicate' && transaction?.id) {
      const { data: prevVerif } = await supabaseAdmin
        .from('verifications')
        .select('created_at, employees(name)')
        .eq('transaction_id', transaction.id)
        .eq('status', 'real')
        .order('created_at', { ascending: true })
        .limit(1)
        .maybeSingle();
      if (prevVerif) {
        responseParams.verifiedAt = prevVerif.created_at;
        responseParams.verifiedByName = prevVerif.employees?.name || null;
      }
    }

    const responseText = buildResponseMessage(responseParams);
    await sendMessage(from, responseText);

    try {
      const { data: co } = await supabaseAdmin
        .from('companies')
        .select('notification_whatsapp, name')
        .eq('id', companyId)
        .maybeSingle();

      let rawContacts = co?.notification_whatsapp;
      if (typeof rawContacts === 'string') {
        try { rawContacts = JSON.parse(rawContacts); } catch { rawContacts = []; }
      }
      const contacts = Array.isArray(rawContacts)
        ? rawContacts.filter(c => c?.active && c?.number)
        : [];

      if (contacts.length > 0) {
        const fmtDate = transaction?.transaction_date
          ? new Date(transaction.transaction_date).toLocaleString('es-CO', {
              timeZone: 'America/Bogota', day: '2-digit', month: '2-digit',
              year: 'numeric', hour: '2-digit', minute: '2-digit'
            })
          : null;
        for (const contact of contacts) {
          await sendPaymentNotification(contact.number.replace(/^\+/, ''), {
            empresa:    co.name,
            empleado:   employee.name,
            monto:      extracted.amount ? `$${Number(extracted.amount).toLocaleString('es-CO')}` : 'desconocido',
            referencia: extracted.reference || null,
            estado:     { real: 'Verificado ✅', duplicate: 'Duplicado ⚠️', not_found: 'No encontrado ❓', error: 'Error 🚫' }[status] ?? status,
            fecha:      fmtDate,
          });
        }
      }
    } catch (notifErr) {
      console.error('[webhook] notif-admin error:', notifErr.message);
    }

    await supabaseAdmin.from('verifications').insert({
      employee_id: employee.id,
      company_id: companyId,
      transaction_id: transaction?.id || null,
      status,
      extracted_amount: extracted.amount || null,
      extracted_reference: extracted.reference || null,
      extracted_date: extracted.date || null,
      extracted_sender: extracted.sender_name || null,
      comprobante_image_url: path,
      whatsapp_message_id: wamid,
      whatsapp_from: fromE164,
      response_text: responseText
    });

    return res.status(200).json({ received: true });
  } catch (err) {
    console.error('[webhook] fatal', err);
    return res.status(200).json({ received: true });
  }
}

// ─── Router ───────────────────────────────────────────────────────────────────
export default function handler(req, res) {
  const provider = req.query.provider;
  if (provider === 'wompi')    return handleWompi(req, res);
  if (provider === 'whatsapp') return handleWhatsApp(req, res);
  return res.status(400).json({ error: 'provider requerido: ?provider=whatsapp|wompi' });
}
