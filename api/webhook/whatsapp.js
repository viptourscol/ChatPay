import { supabaseAdmin } from '../../lib/supabase.js';
import { sendMessage, downloadMedia } from '../../lib/whatsapp.js';
import { extractComprobanteData } from '../../lib/groq.js';
import { matchTransaction, buildResponseMessage } from '../../lib/matcher.js';

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

  // Responder rápido a Meta para no superar timeout
  res.status(200).json({ received: true });

  try {
    const entry = req.body?.entry?.[0];
    const change = entry?.changes?.[0]?.value;
    const message = change?.messages?.[0];
    if (!message) return;

    const from = message.from; // ej: 573001234567
    const fromE164 = `+${from}`;
    const wamid = message.id;

    // Idempotencia: si ya procesamos este mensaje, salir
    const { data: existing } = await supabaseAdmin
      .from('verifications')
      .select('id')
      .eq('whatsapp_message_id', wamid)
      .maybeSingle();
    if (existing) return;

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
      return;
    }

    // --- Mensajes que no son imagen ---
    if (message.type !== 'image') {
      await sendMessage(
        from,
        `Hola ${employee.name} 👋\nEnvíame la *foto del comprobante* de pago para verificarlo.`
      );
      return;
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
        whatsapp_message_id: wamid,
        whatsapp_from: fromE164,
        comprobante_image_url: path,
        status: 'error',
        notes: 'no es comprobante (OCR)'
      });
      return;
    }

    // --- Matching contra transacciones almacenadas (pending → confirmed) ---
    const { transaction, status } = await matchTransaction({
      amount: extracted.amount,
      reference: extracted.reference,
      date: extracted.date,
      senderName: extracted.sender_name
    });

    const responseText = buildResponseMessage({
      status,
      employeeName: employee.name,
      amount: extracted.amount,
      reference: extracted.reference
    });

    await sendMessage(from, responseText);

    await supabaseAdmin.from('verifications').insert({
      employee_id: employee.id,
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
  } catch (err) {
    console.error('[webhook] fatal', err);
  }
}
