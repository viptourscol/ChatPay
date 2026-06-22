const GRAPH = 'https://graph.facebook.com/v21.0';
const TOKEN = process.env.WHATSAPP_TOKEN;
const PHONE_ID = process.env.WHATSAPP_PHONE_NUMBER_ID;

/**
 * Envía un mensaje de texto por WhatsApp Cloud API.
 */
export async function sendMessage(to, text) {
  const res = await fetch(`${GRAPH}/${PHONE_ID}/messages`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      to,
      type: 'text',
      text: { body: text }
    })
  });
  if (!res.ok) {
    const err = await res.text();
    console.error('[whatsapp] sendMessage error:', err);
    throw new Error(`WhatsApp send failed: ${res.status}`);
  }
  return res.json();
}

/**
 * Envía una notificación de pago usando la plantilla aprobada notificacion_pago.
 * Si el template falla (fuera de ventana 24h sin template aprobado, número incorrecto, etc.)
 * loggea el error real de Meta y hace fallback a texto plano.
 */
export async function sendPaymentNotification(to, { empresa, empleado, monto, referencia, estado, fecha }) {
  // Normalizar número: agregar código de país Colombia (57) si no lo tiene
  const normalized = /^57\d{10}$/.test(to) ? to : `57${to.replace(/\D/g, '').replace(/^0+/, '')}`;

  const templatePayload = {
    messaging_product: 'whatsapp',
    to: normalized,
    type: 'template',
    template: {
      name: 'notificacion_pago',
      language: { code: 'es_CO' },
      components: [{
        type: 'body',
        parameters: [
          { type: 'text', text: String(empresa    || '') },
          { type: 'text', text: String(empleado   || '') },
          { type: 'text', text: String(monto      || '') },
          { type: 'text', text: String(referencia || 'N/A') },
          { type: 'text', text: String(estado     || '') },
          { type: 'text', text: String(fecha      || 'N/A') },
        ]
      }]
    }
  };

  const res = await fetch(`${GRAPH}/${PHONE_ID}/messages`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(templatePayload)
  });

  if (!res.ok) {
    const errBody = await res.text();
    console.error('[whatsapp] template error — to:', normalized, '| status:', res.status, '| body:', errBody);

    // Fallback: texto plano (funciona dentro de la ventana de 24h)
    const textFallback =
      `📋 *ChatPay — Notificación de pago*\n\n` +
      `🏢 Empresa: ${empresa}\n` +
      `👤 Empleado: ${empleado}\n` +
      `💰 Monto: ${monto}\n` +
      `🔖 Referencia: ${referencia || 'N/A'}\n` +
      `📋 Estado: ${estado}\n` +
      `🕐 Fecha: ${fecha || 'N/A'}\n\n` +
      `_Mensaje generado automáticamente por ChatPay._`;

    console.warn('[whatsapp] Usando fallback texto plano a', normalized);
    return sendMessage(normalized, textFallback);
  }

  console.log('[whatsapp] template enviado OK a', normalized);
  return res.json();
}

/**
 * Envía alerta al admin cuando se detecta un pago falso o duplicado.
 */
export async function sendAdminAlert(to, { empleado, monto, estado, referencia, fecha }) {
  const estadoLabel = estado === 'fake' ? '⚠️ FALSO' : estado === 'duplicate' ? '🔁 DUPLICADO' : estado.toUpperCase();
  const text = `🚨 *ChatPay — Alerta de pago ${estadoLabel}*\n\n` +
    `👤 Empleado: ${empleado || '—'}\n` +
    `💰 Monto: ${monto || '—'}\n` +
    `🔖 Referencia: ${referencia || '—'}\n` +
    `🕐 Fecha: ${fecha || '—'}\n\n` +
    `_Revisa el dashboard para más detalles._`;
  return sendMessage(to, text);
}

/**
 * Descarga una imagen recibida en WhatsApp y la devuelve como Buffer + mime type.
 */
export async function downloadMedia(mediaId) {
  const metaRes = await fetch(`${GRAPH}/${mediaId}`, {
    headers: { Authorization: `Bearer ${TOKEN}` }
  });
  if (!metaRes.ok) throw new Error(`media metadata failed: ${metaRes.status}`);
  const meta = await metaRes.json();

  const fileRes = await fetch(meta.url, {
    headers: { Authorization: `Bearer ${TOKEN}` }
  });
  if (!fileRes.ok) throw new Error(`media download failed: ${fileRes.status}`);
  const buffer = Buffer.from(await fileRes.arrayBuffer());
  return { buffer, mimeType: meta.mime_type || 'image/jpeg' };
}
