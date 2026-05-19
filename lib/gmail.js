import { google } from 'googleapis';
import { supabaseAdmin } from './supabase.js';

const BANCOLOMBIA_QUERY =
  'from:(alertasynotificaciones@an.notificacionesbancolombia.com OR alertasynotificaciones@notificacionesbancolombia.com OR alertasynotificaciones@bancolombia.com.co OR notificacionesBreB@bbva.com OR BBVAHomeBanking@bbva.com.co OR BANCO_DAVIVIENDA@davivienda.com OR no-reply@wompi.co)';

function getGmailClient() {
  const oauth2 = new google.auth.OAuth2(
    process.env.GMAIL_CLIENT_ID,
    process.env.GMAIL_CLIENT_SECRET,
    'urn:ietf:wg:oauth:2.0:oob'
  );
  oauth2.setCredentials({ refresh_token: process.env.GMAIL_REFRESH_TOKEN });
  return google.gmail({ version: 'v1', auth: oauth2 });
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function decode(b64) {
  if (!b64) return '';
  return Buffer.from(b64.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8');
}

function flattenParts(payload) {
  const parts = [];
  function walk(p) {
    if (!p) return;
    if (p.body?.data) parts.push(p);
    if (p.parts) p.parts.forEach(walk);
  }
  walk(payload);
  return parts;
}

function getBodyText(msg) {
  const parts = flattenParts(msg.payload);
  const textPart = parts.find((p) => p.mimeType === 'text/plain') || parts.find((p) => p.mimeType === 'text/html');
  if (!textPart) return msg.snippet || '';
  let body = decode(textPart.body.data);
  if (textPart.mimeType === 'text/html') {
    body = body.replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ');
  }
  return body.replace(/\s+/g, ' ').trim();
}

/**
 * Parser heurístico para notificaciones de Bancolombia.
 * Captura monto, número de comprobante/aprobación y nombre de quien envía.
 * Funciona con los formatos típicos de "Bancolombia te informa" / "Recibiste una transferencia".
 */
export function parseBancolombiaEmail({ subject = '', body = '', date }) {
  const text = `${subject}\n${body}`;

  // Monto: $130,000.00 (formato US/Bancolombia) ó $130.000,00 (formato colombiano) ó $1.00
  const amountMatch = text.match(/\$\s?([\d.,]+)/) || text.match(/COP\s?\$?\s?([\d.,]+)/i);
  let amount = null;
  if (amountMatch) {
    const raw = amountMatch[1];
    let n;
    const dotIdx = raw.lastIndexOf('.');
    const commaIdx = raw.lastIndexOf(',');
    if (dotIdx > commaIdx) {
      // Formato US: 130,000.00 o 1.00 → punto es decimal, comas son miles
      n = parseFloat(raw.replace(/,/g, ''));
    } else if (commaIdx > dotIdx) {
      // Formato colombiano: 130.000,00 → coma es decimal, puntos son miles
      n = parseFloat(raw.replace(/\./g, '').replace(',', '.'));
    } else {
      // Sin separadores: solo número entero
      n = parseFloat(raw);
    }
    if (!isNaN(n)) amount = n;
  }

  // Referencia / número de comprobante
  const refMatch =
    text.match(/(?:n[uú]mero\s+de\s+(?:comprobante|aprobaci[oó]n|operaci[oó]n)|referencia|cus|ticket)[\s:#]*([A-Z0-9\-]{4,})/i) ||
    text.match(/comprobante\s+([0-9]{4,})/i);
  const reference = refMatch ? refMatch[1].trim() : null;

  // Remitente: "de NOMBRE APELLIDO" / "por NOMBRE"
  const senderMatch =
    text.match(/de\s+([A-ZÁÉÍÓÚÑ][A-ZÁÉÍÓÚÑa-záéíóúñ\s]{3,40}?)(?:\s+en\s|\s+por|\s+con|\s+a\s+tu|\s+cuenta|\s+\$|,|\.|$)/) ||
    text.match(/remitente[:\s]+([A-ZÁÉÍÓÚÑ][^\n.,]{3,60})/i);
  const sender_name = senderMatch ? senderMatch[1].trim() : null;

  return {
    amount,
    reference_number: reference,
    sender_name,
    transaction_date: date ? new Date(date).toISOString() : new Date().toISOString()
  };
}

/**
 * Sincroniza emails recientes de Bancolombia y los guarda en `transactions`.
 * @param {object} opts
 * @param {number} opts.minutes ventana hacia atrás (default 60)
 */
export async function syncBancolombiaEmails({ minutes = 60 } = {}) {
  const gmail = getGmailClient();
  const after = Math.floor((Date.now() - minutes * 60 * 1000) / 1000);
  const q = `${BANCOLOMBIA_QUERY} after:${after}`;

  const list = await gmail.users.messages.list({ userId: 'me', q, maxResults: 25 });
  const messages = list.data.messages || [];

  let inserted = 0;
  for (const m of messages) {
    const { data: msg } = await gmail.users.messages.get({ userId: 'me', id: m.id, format: 'full' });
    const headers = msg.payload?.headers || [];
    const subject = headers.find((h) => h.name === 'Subject')?.value || '';
    const dateHdr = headers.find((h) => h.name === 'Date')?.value;
    // Usar snippet + body: el snippet tiene el texto plano relevante sin CSS
    const body = `${msg.snippet || ''} ${getBodyText(msg)}`;

    const parsed = parseBancolombiaEmail({ subject, body, date: dateHdr });
    if (!parsed.amount) continue;

    // Deduplicar por amount + transaction_date (±2 min) para evitar doble registro
    // cuando Bancolombia envía dos emails distintos para el mismo pago
    const txDate = new Date(parsed.transaction_date);
    const lo = new Date(txDate.getTime() - 2 * 60 * 1000).toISOString();
    const hi = new Date(txDate.getTime() + 2 * 60 * 1000).toISOString();
    const { data: existing } = await supabaseAdmin
      .from('transactions')
      .select('id')
      .eq('amount', parsed.amount)
      .gte('transaction_date', lo)
      .lte('transaction_date', hi)
      .maybeSingle();
    if (existing) continue; // ya existe una transacción igual, omitir

    const { error } = await supabaseAdmin
      .from('transactions')
      .upsert(
        {
          amount: parsed.amount,
          reference_number: parsed.reference_number,
          sender_name: parsed.sender_name,
          transaction_date: parsed.transaction_date,
          raw_subject: subject,
          raw_snippet: msg.snippet,
          gmail_message_id: msg.id,
          status: 'pending'
        },
        { onConflict: 'gmail_message_id', ignoreDuplicates: true }
      );
    if (!error) inserted++;
  }
  return { scanned: messages.length, inserted };
}

// ── Gmail Push Notifications (tiempo real) ────────────────────────────────────

/**
 * Registra (o renueva) el watch de Gmail Push para recibir notificaciones
 * en tiempo real vía Google Cloud Pub/Sub.
 *
 * Debe llamarse:
 *  - Una vez al configurar el sistema
 *  - Cada ~7 días (el watch expira), por un cron semanal
 *
 * Requiere:
 *  GMAIL_PUBSUB_TOPIC = projects/{project-id}/topics/{topic-name}
 */
export async function watchGmailInbox() {
  const gmail = getGmailClient();
  const topicName = process.env.GMAIL_PUBSUB_TOPIC;
  if (!topicName) throw new Error('GMAIL_PUBSUB_TOPIC no definido');

  const res = await gmail.users.watch({
    userId: 'me',
    requestBody: {
      topicName,
      labelIds: ['INBOX'],
      labelFilterBehavior: 'INCLUDE'
    }
  });

  const { historyId, expiration } = res.data;
  console.log(`[gmail watch] registrado | historyId=${historyId} | expira=${new Date(Number(expiration)).toISOString()}`);

  // Guardar historyId inicial en DB
  await saveHistoryId(historyId);
  return { historyId, expiration };
}

/**
 * Lee el último historyId almacenado en Supabase.
 */
export async function getStoredHistoryId() {
  const { data } = await supabaseAdmin
    .from('system_state')
    .select('value')
    .eq('key', 'gmail_history_id')
    .single();
  return data?.value || '0';
}

/**
 * Guarda el historyId actual en Supabase.
 */
export async function saveHistoryId(historyId) {
  await supabaseAdmin
    .from('system_state')
    .upsert({ key: 'gmail_history_id', value: String(historyId), updated_at: new Date().toISOString() });
}

/**
 * Procesa los emails nuevos desde un historyId dado usando la Gmail History API.
 * Solo procesa mensajes de Bancolombia. Almacena transacciones como 'pending'.
 *
 * @param {string} newHistoryId — historyId recibido del Pub/Sub notification
 * @returns {{ processed: number }}
 */
export async function processGmailHistory(newHistoryId) {
  const gmail = getGmailClient();
  const startHistoryId = await getStoredHistoryId();

  // Si el historyId que nos llega es menor o igual al que ya procesamos, salir
  if (BigInt(newHistoryId) <= BigInt(startHistoryId)) {
    console.log(`[gmail push] historyId ${newHistoryId} ya procesado (último: ${startHistoryId})`);
    return { processed: 0 };
  }

  let processed = 0;

  try {
    // Obtener historial de cambios desde startHistoryId
    const histRes = await gmail.users.history.list({
      userId: 'me',
      startHistoryId,
      historyTypes: ['messageAdded']
    });

    const records = histRes.data.history || [];
    const messageIds = new Set();

    for (const record of records) {
      for (const added of record.messagesAdded || []) {
        messageIds.add(added.message.id);
      }
    }

    console.log(`[gmail push] ${messageIds.size} mensaje(s) nuevo(s) a revisar`);

    for (const msgId of messageIds) {
      try {
        const { data: msg } = await gmail.users.messages.get({
          userId: 'me',
          id: msgId,
          format: 'full'
        });

        const headers = msg.payload?.headers || [];
        const from = headers.find((h) => h.name.toLowerCase() === 'from')?.value || '';

        // Solo procesar emails de bancos configurados
        const BANK_DOMAINS = [
          'notificacionesbancolombia.com',
          'bancolombia.com.co',
          'bbva.com',
          'bbva.com.co',
          'davivienda.com',
          'wompi.co'
        ];
        if (!BANK_DOMAINS.some(d => from.toLowerCase().includes(d))) continue;

        const subject = headers.find((h) => h.name === 'Subject')?.value || '';
        const dateHdr = headers.find((h) => h.name === 'Date')?.value;
        const body = `${msg.snippet || ''} ${getBodyText(msg)}`;

        const parsed = parseBancolombiaEmail({ subject, body, date: dateHdr });
        if (!parsed.amount) continue;

        const { error } = await supabaseAdmin
          .from('transactions')
          .upsert(
            {
              amount: parsed.amount,
              reference_number: parsed.reference_number,
              sender_name: parsed.sender_name,
              transaction_date: parsed.transaction_date,
              raw_subject: subject,
              raw_snippet: msg.snippet,
              gmail_message_id: msg.id,
              status: 'pending'
            },
            { onConflict: 'gmail_message_id', ignoreDuplicates: true }
          );

        if (!error) {
          processed++;
          console.log(`[gmail push] transacción almacenada | monto=${parsed.amount} | ref=${parsed.reference_number}`);
        }
      } catch (e) {
        console.error(`[gmail push] error procesando mensaje ${msgId}:`, e.message);
      }
    }
  } catch (e) {
    console.error('[gmail push] error en history.list:', e.message);
  }

  // Actualizar historyId siempre, incluso si no hubo emails de Bancolombia
  await saveHistoryId(newHistoryId);
  return { processed };
}
