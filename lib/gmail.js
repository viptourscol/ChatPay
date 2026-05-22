import { google } from 'googleapis';
import { supabaseAdmin } from './supabase.js';

const BANCOLOMBIA_QUERY =
  'from:(alertasynotificaciones@an.notificacionesbancolombia.com OR alertasynotificaciones@notificacionesbancolombia.com OR alertasynotificaciones@bancolombia.com.co OR notificacionesBreB@bbva.com OR BBVAHomeBanking@bbva.com.co OR BANCO_DAVIVIENDA@davivienda.com OR no-reply@wompi.co OR notificaciones@lulo.com.co OR no-reply@lulo.com.co OR noreply@lulo.com.co)';

function getGmailClient() {
  const oauth2 = new google.auth.OAuth2(
    process.env.GMAIL_CLIENT_ID,
    process.env.GMAIL_CLIENT_SECRET,
    'urn:ietf:wg:oauth:2.0:oob'
  );
  oauth2.setCredentials({ refresh_token: process.env.GMAIL_REFRESH_TOKEN });
  return google.gmail({ version: 'v1', auth: oauth2 });
}

// Cache de etiquetas para no llamar la API en cada email
const labelCache = new Map(); // labelName → labelId

async function applyGmailLabel(gmail, messageId, labelName) {
  try {
    // Obtener o crear etiqueta
    let labelId = labelCache.get(labelName);
    if (!labelId) {
      const listRes = await gmail.users.labels.list({ userId: 'me' });
      const existing = (listRes.data.labels || []).find(l => l.name === labelName);
      if (existing) {
        labelId = existing.id;
      } else {
        const created = await gmail.users.labels.create({
          userId: 'me',
          requestBody: { name: labelName, labelListVisibility: 'labelShow', messageListVisibility: 'show' },
        });
        labelId = created.data.id;
      }
      labelCache.set(labelName, labelId);
    }
    await gmail.users.messages.modify({
      userId: 'me',
      id: messageId,
      requestBody: { addLabelIds: [labelId] },
    });
  } catch (err) {
    // No fallar el flujo principal si la etiqueta falla
    console.warn('[gmail/label] Error aplicando etiqueta:', err.message);
  }
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

  // Detectar si es un débito (dinero saliendo) — NO debe registrarse como pago pendiente
  const debitPatterns = [
    /transferiste/i,
    /enviaste/i,
    /realizaste\s+(?:un\s+)?pago/i,
    /tu\s+pago\s+(?:de|por)/i,
    /retiro\s+(?:de|por)/i,
    /d[eé]bito\s+(?:de|por)/i,
    /pagaste/i,
    /hiciste\s+una\s+transferencia/i,
  ];
  const isDebit = debitPatterns.some((p) => p.test(text));

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

  // Destinatario: "a NOMBRE APELLIDO el DD/MM" o "cuenta *XXXX a NOMBRE APELLIDO el"
  const receiverMatch =
    text.match(/cuenta\s+\*\d+\s+a\s+([A-ZÁÉÍÓÚÑ][A-ZÁÉÍÓÚÑ\s]{3,50}?)\s+el\s/i) ||
    text.match(/transferiste[^a]+a\s+(?:la\s+llave\s+\S+\s+[^\n]*?a\s+)([A-ZÁÉÍÓÚÑ][A-ZÁÉÍÓÚÑ\s]{3,50}?)\s+el\s/i) ||
    text.match(/destinatario[:\s]+([A-ZÁÉÍÓÚÑ][^\n.,]{3,60})/i);
  const receiver_name = receiverMatch ? receiverMatch[1].trim() : null;

  return {
    amount,
    reference_number: reference,
    sender_name,
    receiver_name,
    transaction_date: date ? new Date(date).toISOString() : new Date().toISOString(),
    isDebit
  };
}

/**
 * Extrae todos los emails de un header (To, X-Forwarded-To, Delivered-To, etc.)
 */
function extractEmails(headerValue) {
  if (!headerValue) return [];
  const matches = headerValue.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g);
  return (matches || []).map(e => e.toLowerCase());
}

/**
 * Dado un conjunto de headers del email, busca qué empresa tiene configurado
 * ese correo como bancolombia_email. Revisa To, X-Forwarded-To, Delivered-To.
 */
async function resolveCompanyFromHeaders(headers) {
  // Recopilar todos los posibles emails destinatarios
  const headerNames = ['To', 'X-Forwarded-To', 'X-Forwarded-For', 'Delivered-To', 'X-Original-To'];
  const candidates = new Set();
  for (const name of headerNames) {
    const val = headers.find(h => h.name.toLowerCase() === name.toLowerCase())?.value;
    extractEmails(val).forEach(e => candidates.add(e));
  }
  if (candidates.size === 0) return null;

  // 1. Buscar en cuentas bancarias múltiples (company_bank_accounts)
  const { data: bankAccounts } = await supabaseAdmin
    .from('company_bank_accounts')
    .select('company_id, bancolombia_email');
  if (bankAccounts) {
    for (const acct of bankAccounts) {
      if (candidates.has(acct.bancolombia_email?.toLowerCase())) return acct.company_id;
    }
  }

  // 2. Fallback: buscar en campo legacy companies.bancolombia_email
  const { data: companies } = await supabaseAdmin
    .from('companies')
    .select('id, bancolombia_email')
    .not('bancolombia_email', 'is', null);
  if (companies) {
    for (const company of companies) {
      if (candidates.has(company.bancolombia_email?.toLowerCase())) return company.id;
    }
  }

  return null;
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

  // Fallback: usar company ID explícito del env, o el primer tenant por fecha
  let fallbackCompanyId = process.env.GMAIL_DEFAULT_COMPANY_ID || null;
  if (!fallbackCompanyId) {
    const { data: fallbackCompany } = await supabaseAdmin
      .from('companies')
      .select('id')
      .order('created_at', { ascending: true })
      .limit(1)
      .single();
    fallbackCompanyId = fallbackCompany?.id || null;
  }

  let inserted = 0;
  // Cache nombre de empresa companyId → name para las etiquetas
  const companyNames = new Map();
  async function getCompanyName(id) {
    if (companyNames.has(id)) return companyNames.get(id);
    const { data } = await supabaseAdmin.from('companies').select('name').eq('id', id).maybeSingle();
    const name = data?.name || id;
    companyNames.set(id, name);
    return name;
  }
  for (const m of messages) {
    const { data: msg } = await gmail.users.messages.get({ userId: 'me', id: m.id, format: 'full' });
    const headers = msg.payload?.headers || [];
    const subject = headers.find((h) => h.name === 'Subject')?.value || '';
    const dateHdr = headers.find((h) => h.name === 'Date')?.value;
    // Usar snippet + body: el snippet tiene el texto plano relevante sin CSS
    const body = `${msg.snippet || ''} ${getBodyText(msg)}`;

    const parsed = parseBancolombiaEmail({ subject, body, date: dateHdr });
    if (!parsed.amount) continue;

    // Es un débito (dinero saliendo) → registrar como egreso automático
    if (parsed.isDebit) {
      const companyId = (await resolveCompanyFromHeaders(headers)) || fallbackCompanyId;
      if (!companyId) continue;
      // Obtener user_id de la empresa
      const { data: comp } = await supabaseAdmin
        .from('companies')
        .select('user_id')
        .eq('id', companyId)
        .maybeSingle();
      if (!comp?.user_id) continue;

      const txDate = new Date(parsed.transaction_date);
      const lo = new Date(txDate.getTime() - 2 * 60 * 1000).toISOString().slice(0, 10);
      const hi = new Date(txDate.getTime() + 2 * 60 * 1000).toISOString().slice(0, 10);

      const { data: existingEgreso } = await supabaseAdmin
        .from('egresos')
        .select('id')
        .eq('gmail_message_id', msg.id)
        .maybeSingle();
      if (existingEgreso) continue;

      await supabaseAdmin.from('egresos').insert({
        user_id: comp.user_id,
        company_id: companyId,
        description: parsed.receiver_name
          ? `Transferencia a ${parsed.receiver_name}`
          : (subject || 'Débito automático desde Gmail'),
        amount: parsed.amount,
        recipient: parsed.receiver_name || null,
        payment_date: parsed.transaction_date
          ? new Date(parsed.transaction_date).toISOString().slice(0, 10)
          : new Date().toISOString().slice(0, 10),
        method: 'transferencia',
        category: 'otro',
        source: 'gmail',
        gmail_message_id: msg.id,
        notes: `Detectado automáticamente. Ref: ${parsed.reference_number || '—'}`,
      });
      continue;
    }

    // Identificar empresa por bancolombia_email (revisa To, X-Forwarded-To, Delivered-To)
    const companyId = (await resolveCompanyFromHeaders(headers)) || fallbackCompanyId;

    // Deduplicar por amount + transaction_date (±2 min) para evitar doble registro
    // cuando Bancolombia envía dos emails distintos para el mismo pago
    const txDate = new Date(parsed.transaction_date);
    const lo = new Date(txDate.getTime() - 2 * 60 * 1000).toISOString();
    const hi = new Date(txDate.getTime() + 2 * 60 * 1000).toISOString();
    const { data: existing } = await supabaseAdmin
      .from('transactions')
      .select('id')
      .eq('amount', parsed.amount)
      .eq('company_id', companyId)
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
          company_id: companyId,
          status: 'pending'
        },
        { onConflict: 'gmail_message_id', ignoreDuplicates: true }
      );
    if (!error) {
      inserted++;
      // Etiquetar en Gmail bajo "ChatPay/NombreEmpresa"
      const companyName = await getCompanyName(companyId);
      await applyGmailLabel(gmail, msg.id, `ChatPay/${companyName}`);
    }
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
