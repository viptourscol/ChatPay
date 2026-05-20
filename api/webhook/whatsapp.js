import { supabaseAdmin } from '../../lib/supabase.js';
import { sendMessage, downloadMedia } from '../../lib/whatsapp.js';
import { extractComprobanteData } from '../../lib/groq.js';
import { matchTransaction, buildResponseMessage } from '../../lib/matcher.js';
import { checkVerificationLimit } from '../../lib/subscription.js';

export const config = { api: { bodyParser: true } };

export default async function handler(req, res) {
  // --- Verificación de webhook (Meta GET) ---
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

  // Responder rápido a Meta para no superar timeout de 20s
  // IMPORTANTE: procesamos ANTES de responder para que Vercel no corte la ejecución
  try {
    const entry = req.body?.entry?.[0];
    const change = entry?.changes?.[0]?.value;
    const message = change?.messages?.[0];
    if (!message) return res.status(200).json({ received: true });

    const from = message.from; // ej: 573001234567
    const fromE164 = `+${from}`;
    const wamid = message.id;

    // Idempotencia: si ya procesamos este mensaje, salir
    const { data: existing } = await supabaseAdmin
      .from('verifications')
      .select('id')
      .eq('whatsapp_message_id', wamid)
      .maybeSingle();
    if (existing) return res.status(200).json({ received: true });

    // --- Validar empleado ---
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

    // --- Mensajes de texto: verificar si hay desambiguación pendiente ---
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
        // Confirmar la transacción seleccionada
        const { data: tx } = await supabaseAdmin.from('transactions').select('*').eq('id', txId).maybeSingle();
        await supabaseAdmin.from('transactions').update({ status: 'confirmed' }).eq('id', txId);
        await supabaseAdmin.from('disambiguations').update({ resolved: true }).eq('id', pending.id);
        const { buildResponseMessage } = await import('../../lib/matcher.js');
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

      // Texto sin desambiguación pendiente → instrucción normal
      await sendMessage(
        from,
        `Hola ${employee.name} 👋\nEnvíame la *foto del comprobante* de pago para verificarlo.`
      );
      return res.status(200).json({ received: true });
    }

    // --- Otros tipos que no son imagen ---
    if (message.type !== 'image') {
      return res.status(200).json({ received: true });
    }

    // --- Verificar límite de verificaciones del plan ---
    const verifyLimit = await checkVerificationLimit(companyId);
    if (!verifyLimit.ok) {
      await sendMessage(from, `⚠️ ${verifyLimit.reason}`);
      return res.status(200).json({ received: true });
    }

    // --- Descargar imagen y subir a Supabase Storage ---
    const { buffer, mimeType } = await downloadMedia(message.image.id);
    const ext = mimeType.split('/')[1] || 'jpg';
    const path = `${employee.id}/${Date.now()}-${wamid}.${ext}`;
    const { error: upErr } = await supabaseAdmin.storage
      .from('comprobantes')
      .upload(path, buffer, { contentType: mimeType, upsert: false });
    if (upErr) console.error('[storage] upload', upErr);

    const { data: signed } = await supabaseAdmin.storage
      .from('comprobantes')
      .createSignedUrl(path, 60 * 60 * 24 * 7); // 7 días para OCR + dashboard

    // --- OCR con Groq ---
    let extracted = {};
    try {
      extracted = await extractComprobanteData(signed.signedUrl);
    } catch (e) {
      console.error('[groq] error', e);
    }

    if (!extracted?.is_receipt) {
      await sendMessage(
        from,
        `${employee.name}, no parece un comprobante de pago válido. Envía una foto clara del comprobante.`
      );
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

    // --- Matching contra transacciones almacenadas (pending → confirmed) ---
    const { transaction, status, candidates } = await matchTransaction({
      amount: extracted.amount,
      reference: extracted.reference,
      date: extracted.date,
      senderName: extracted.sender_name,
      companyId
    });

    // --- Caso ambiguo: múltiples pagos con el mismo monto ---
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

    // Para duplicados: buscar quién y cuándo verificó este comprobante antes
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

    // --- Notificación al número configurado por el admin (opcional) ---
    try {
      const { data: co } = await supabaseAdmin
        .from('companies')
        .select('notification_whatsapp, name')
        .eq('id', companyId)
        .maybeSingle();

      if (co?.notification_whatsapp) {
        const notifTo = co.notification_whatsapp.replace(/^\+/, '');
        const statusLabel = {
          real:      '✅ Verificado',
          duplicate: '⚠️ Duplicado',
          not_found: '❓ No encontrado',
          error:     '🚫 Error',
        }[status] ?? status;
        const fmtAmt = extracted.amount
          ? `$${Number(extracted.amount).toLocaleString('es-CO')}`
          : 'monto desconocido';
        const fmtDate = transaction?.transaction_date
          ? new Date(transaction.transaction_date).toLocaleString('es-CO', {
              timeZone: 'America/Bogota', day: '2-digit', month: '2-digit',
              year: 'numeric', hour: '2-digit', minute: '2-digit'
            })
          : null;
        const lines = [
          `📋 *Pago verificado — ${co.name}*`,
          `👤 Empleado: ${employee.name}`,
          `💰 Monto: ${fmtAmt}`,
          extracted.reference ? `🔑 Referencia: ${extracted.reference}` : null,
          fmtDate            ? `📅 Fecha: ${fmtDate}`                   : null,
          `📊 Estado: ${statusLabel}`,
        ].filter(Boolean).join('\n');
        await sendMessage(notifTo, lines);
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
