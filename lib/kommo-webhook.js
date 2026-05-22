/**
 * api/webhook/kommo.js
 *
 * Recibe webhooks de Kommo CRM cuando llega un mensaje de WhatsApp.
 *
 * Flujo:
 *  1. Kommo recibe el mensaje de WhatsApp del cliente/empleado
 *  2. Kommo llama a este endpoint (POST)
 *  3. Extraemos la imagen del comprobante
 *  4. Groq OCR extrae los datos del comprobante
 *  5. Se busca la transacción en DB (ya almacenada por el sync de Gmail)
 *  6. Matcher: real (confirma) / duplicado / falso
 *  7. Se responde al chat de Kommo con el resultado
 *
 * Configurar en Kommo:
 *   Configuración → Integraciones → Webhook → URL: https://tu-dominio.com/api/webhook/kommo
 *   Eventos a escuchar: "Mensaje entrante" / "add_message"
 */

import { supabaseAdmin } from './supabase.js';
import { extractComprobanteData } from './groq.js';
import { matchTransaction, buildResponseMessage } from './matcher.js';
import {
  sendKommoMessage,
  downloadKommoFile,
  verifyKommoSignature
} from './kommo.js';

export const config = { api: { bodyParser: true } };

export default async function handler(req, res) {
  // Solo aceptar POST
  if (req.method !== 'POST') return res.status(405).end();

  // Verificar firma si está configurada
  const rawBody = JSON.stringify(req.body);
  const signature = req.headers['x-signature'] || req.headers['x-kommo-signature'] || '';
  if (!verifyKommoSignature(rawBody, signature)) {
    console.warn('[kommo webhook] firma inválida');
    return res.status(401).json({ error: 'invalid signature' });
  }

  // Responder inmediatamente a Kommo (timeout de 5s)
  res.status(200).json({ received: true });

  try {
    await processKommoWebhook(req.body);
  } catch (err) {
    console.error('[kommo webhook] error procesando:', err);
  }
}

async function processKommoWebhook(body) {
  // ── Parsear payload de Kommo ──────────────────────────────────────────────
  // Kommo envía los mensajes entrantes en body.message.add[]
  // El formato puede variar: algunos usan body.messages, otros body.message.add
  const messages =
    body?.message?.add ||
    body?.messages?.add ||
    body?.add ||
    [];

  if (!messages.length) {
    console.log('[kommo webhook] sin mensajes nuevos en el payload');
    return;
  }

  for (const msg of messages) {
    await processMessage(msg);
  }
}

async function processMessage(msg) {
  const chatId = msg.chat_id;
  const talkId = msg.talk_id;
  const msgId = msg.id || String(talkId) + '_' + Date.now();

  // Solo procesar mensajes entrantes de contactos (no los enviados por nosotros)
  const authorType = msg.author?.type || msg.author_type;
  if (authorType === 'user' || authorType === 'bot') {
    // Mensaje enviado por el agente/bot, ignorar
    return;
  }

  // Número de teléfono del remitente
  const phone =
    msg.source?.data?.phone ||
    msg.origin?.phone ||
    msg.contact?.phone ||
    null;
  const fromE164 = phone
    ? phone.startsWith('+') ? phone : `+${phone}`
    : null;

  console.log(`[kommo] mensaje entrante | chat=${chatId} | tipo=${msg.type} | from=${fromE164}`);

  // ── Idempotencia ──────────────────────────────────────────────────────────
  const { data: existing } = await supabaseAdmin
    .from('verifications')
    .select('id')
    .eq('whatsapp_message_id', msgId)
    .maybeSingle();
  if (existing) return;

  // ── Validar empleado autorizado ───────────────────────────────────────────
  let employee = null;
  if (fromE164) {
    const { data } = await supabaseAdmin
      .from('employees')
      .select('*')
      .eq('whatsapp_number', fromE164)
      .eq('is_active', true)
      .maybeSingle();
    employee = data;
  }

  if (!employee) {
    if (chatId) {
      await sendKommoMessage(
        chatId,
        '🚫 Tu número no está autorizado para verificar pagos. Contacta al administrador.'
      );
    }
    await supabaseAdmin.from('verifications').insert({
      whatsapp_message_id: msgId,
      whatsapp_from: fromE164 || 'desconocido',
      status: 'error',
      notes: 'empleado no autorizado (Kommo)'
    });
    return;
  }

  // ── Verificar que sea una imagen ──────────────────────────────────────────
  const isImage =
    msg.type === 'picture' ||
    msg.type === 'image' ||
    msg.content?.type === 'image' ||
    !!msg.content?.url?.match(/\.(jpg|jpeg|png|webp)/i);

  if (!isImage) {
    if (chatId) {
      await sendKommoMessage(
        chatId,
        `Hola ${employee.name} 👋\nEnvíame la *foto del comprobante* de pago para verificarlo.`
      );
    }
    return;
  }

  // ── Descargar imagen desde Kommo ──────────────────────────────────────────
  const fileUrl = msg.content?.url || msg.content?.download_url;
  if (!fileUrl) {
    console.error('[kommo] no se encontró URL de imagen en el mensaje');
    return;
  }

  let buffer, mimeType;
  try {
    ({ buffer, mimeType } = await downloadKommoFile(fileUrl));
  } catch (e) {
    console.error('[kommo] error descargando imagen:', e);
    if (chatId) {
      await sendKommoMessage(
        chatId,
        `${employee.name}, no pude descargar la imagen. Intenta enviarla de nuevo.`
      );
    }
    return;
  }

  // ── Subir imagen a Supabase Storage ──────────────────────────────────────
  const ext = mimeType.split('/')[1]?.split(';')[0] || 'jpg';
  const storagePath = `${employee.id}/${Date.now()}-kommo-${msgId}.${ext}`;

  const { error: upErr } = await supabaseAdmin.storage
    .from('comprobantes')
    .upload(storagePath, buffer, { contentType: mimeType, upsert: false });
  if (upErr) console.error('[storage] upload error:', upErr);

  const { data: signed } = await supabaseAdmin.storage
    .from('comprobantes')
    .createSignedUrl(storagePath, 60 * 60 * 24 * 7); // 7 días

  // ── OCR con Groq ──────────────────────────────────────────────────────────
  let extracted = {};
  try {
    extracted = await extractComprobanteData(signed?.signedUrl || fileUrl);
  } catch (e) {
    console.error('[groq] error:', e);
  }

  if (!extracted?.is_receipt) {
    if (chatId) {
      await sendKommoMessage(
        chatId,
        `${employee.name}, la imagen no parece un comprobante de pago válido. Envía una foto clara del comprobante.`
      );
    }
    await supabaseAdmin.from('verifications').insert({
      employee_id: employee.id,
      whatsapp_message_id: msgId,
      whatsapp_from: fromE164 || employee.whatsapp_number,
      comprobante_image_url: storagePath,
      status: 'error',
      notes: 'no es comprobante (Kommo OCR)'
    });
    return;
  }

  // ── Matching contra transacciones almacenadas (pending → confirmed) ────────
  const { transaction, status } = await matchTransaction({
    amount: extracted.amount,
    reference: extracted.reference,
    date: extracted.date
  });

  // ── Guardar verificación en Supabase ──────────────────────────────────────
  await supabaseAdmin.from('verifications').insert({
    employee_id: employee.id,
    transaction_id: transaction?.id || null,
    whatsapp_message_id: msgId,
    whatsapp_from: fromE164 || employee.whatsapp_number,
    comprobante_image_url: storagePath,
    status,
    extracted_amount: extracted.amount,
    extracted_reference: extracted.reference,
    extracted_date: extracted.date,
    extracted_sender: extracted.sender_name,
    notes: `Procesado vía Kommo CRM | chat_id=${chatId}`
  });

  // ── Responder por Kommo ───────────────────────────────────────────────────
  const responseText = buildResponseMessage({
    status,
    employeeName: employee.name,
    amount: extracted.amount,
    reference: extracted.reference
  });

  if (chatId) {
    await sendKommoMessage(chatId, responseText);
  }

  console.log(`[kommo] verificación completada | empleado=${employee.name} | status=${status}`);
}
