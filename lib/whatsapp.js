const GRAPH = 'https://graph.facebook.com/v21.0';
const TOKEN = process.env.WHATSAPP_TOKEN;
const PHONE_ID = process.env.WHATSAPP_PHONE_NUMBER_ID;

// Import lazy para evitar circular dependencies en tests
async function getSupabaseAdmin() {
  const { supabaseAdmin } = await import('./supabase.js');
  return supabaseAdmin;
}

/**
 * Registra un mensaje enviado (o fallido) en whatsapp_logs.
 * Nunca lanza excepción para no interrumpir el flujo principal.
 */
async function logMessage({ companyId, verificationId, recipient, messageType, messageText, status, metaMessageId, errorMessage }) {
  try {
    const sb = await getSupabaseAdmin();
    await sb.from('whatsapp_logs').insert({
      company_id:     companyId     || null,
      verification_id: verificationId || null,
      recipient,
      message_type:   messageType,
      message_text:   messageText   ? messageText.slice(0, 2000) : null,
      status,
      meta_message_id: metaMessageId || null,
      error_message:  errorMessage  || null,
    });
  } catch (e) {
    console.error('[whatsapp/log] error guardando log:', e.message);
  }
}

/**
 * Envía un mensaje de texto por WhatsApp Cloud API.
 * ctx: { companyId, verificationId, messageType } — opcionales para logging.
 */
export async function sendMessage(to, text, ctx = {}) {
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
    await logMessage({ ...ctx, recipient: to, messageType: ctx.messageType || 'other', messageText: text, status: 'failed', errorMessage: err });
    throw new Error(`WhatsApp send failed: ${res.status}`);
  }
  const data = await res.json();
  await logMessage({ ...ctx, recipient: to, messageType: ctx.messageType || 'other', messageText: text, status: 'sent', metaMessageId: data?.messages?.[0]?.id });
  return data;
}

/**
 * Envía una notificación de pago usando la plantilla aprobada notificacion_pago.
 * ctx: { companyId, verificationId } — opcionales para logging.
 */
export async function sendPaymentNotification(to, { empresa, empleado, monto, referencia, estado, fecha }, ctx = {}) {
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

  const summaryText = `[Template] ${empresa} | ${empleado} | ${monto} | ${estado}`;

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
    // Loggear el fallo del template
    await logMessage({ ...ctx, recipient: normalized, messageType: 'payment_notification', messageText: summaryText, status: 'failed', errorMessage: errBody.slice(0, 500) });
    // Enviar fallback (se loggea como 'fallback_text')
    return sendMessage(normalized, textFallback, { ...ctx, messageType: 'fallback_text' });
  }

  const data = await res.json();
  console.log('[whatsapp] template enviado OK a', normalized);
  await logMessage({ ...ctx, recipient: normalized, messageType: 'payment_notification', messageText: summaryText, status: 'sent', metaMessageId: data?.messages?.[0]?.id });
  return data;
}

/**
 * Envía alerta al admin cuando se detecta un pago falso o duplicado.
 * ctx: { companyId, verificationId } — opcionales para logging.
 */
export async function sendAdminAlert(to, { empleado, monto, estado, referencia, fecha }, ctx = {}) {
  const estadoLabel = estado === 'fake' ? '⚠️ FALSO' : estado === 'duplicate' ? '🔁 DUPLICADO' : estado.toUpperCase();
  const text = `🚨 *ChatPay — Alerta de pago ${estadoLabel}*\n\n` +
    `👤 Empleado: ${empleado || '—'}\n` +
    `💰 Monto: ${monto || '—'}\n` +
    `🔖 Referencia: ${referencia || '—'}\n` +
    `🕐 Fecha: ${fecha || '—'}\n\n` +
    `_Revisa el dashboard para más detalles._`;
  return sendMessage(to, text, { ...ctx, messageType: 'admin_alert' });
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

/**
 * Envía notificación de verificación usando plantillas aprobadas por Meta.
 * status: 'pending' | 'real' | 'fake' | 'duplicate' | 'error'
 */
export async function sendVerificationNotification(to, {
  status,
  nombreEmpleado,
  montoFormato,
  nombreBanco,
  fechaTransaccion,
  referencia,
  razonRechazo
}, ctx = {}) {
  console.log(`[whatsapp/template] starting: to=${to} status=${status}`);
  
  const normalized = /^57\d{10}$/.test(to) ? to : `57${to.replace(/\D/g, '').replace(/^0+/, '')}`;
  console.log(`[whatsapp/template] normalized: ${to} → ${normalized}`);
  
  let templateName, parameters = [];
  
  switch(status) {
    case 'pending':
      templateName = process.env.WHATSAPP_TEMPLATE_PENDING || 'comprobante_pendiente';
      parameters = [
        { type: 'text', text: String(nombreEmpleado || 'Empleado') },
        { type: 'text', text: String(montoFormato || '') },
        { type: 'text', text: String(referencia || 'N/A') }
      ];
      break;
    
    case 'real':
    case 'confirmed':
      templateName = process.env.WHATSAPP_TEMPLATE_VERIFIED || 'comprobante_verificado';
      parameters = [
        { type: 'text', text: String(nombreEmpleado || 'Empleado') },
        { type: 'text', text: String(montoFormato || '') },
        { type: 'text', text: String(nombreBanco || 'Banco') },
        { type: 'text', text: String(fechaTransaccion || '') },
        { type: 'text', text: String(referencia || 'N/A') }
      ];
      break;
    
    case 'fake':
    case 'duplicate':
    case 'error':
      templateName = process.env.WHATSAPP_TEMPLATE_REJECTED || 'comprobante_rechazado';
      parameters = [
        { type: 'text', text: String(nombreEmpleado || 'Empleado') },
        { type: 'text', text: String(montoFormato || '') },
        { type: 'text', text: String(razonRechazo || 'No se pudo verificar') },
        { type: 'text', text: String(referencia || 'N/A') }
      ];
      break;
    
    default:
      throw new Error(`Unknown verification status: ${status}`);
  }

  const payload = {
    messaging_product: 'whatsapp',
    to: normalized,
    type: 'template',
    template: {
      name: templateName,
      language: { code: 'es_CO' },
      components: [{ type: 'body', parameters }]
    }
  };

  console.log(`[whatsapp/template] sending: templateName=${templateName} to=${normalized} params=${JSON.stringify(parameters.map(p => p.text))}`);

  const res = await fetch(`${GRAPH}/${PHONE_ID}/messages`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  if (!res.ok) {
    const errBody = await res.text();
    console.error(`[whatsapp/template] ERROR from Meta: status=${res.status} body=${errBody}`);
    
    // Fallback a texto plano si template falla
    const fallbackText = `Verificación de pago: ${status}\nMonto: ${montoFormato}\nReferencia: ${referencia}`;
    console.warn('[whatsapp/template] Using fallback text to', normalized);
    await logMessage({ 
      ...ctx, 
      recipient: normalized, 
      messageType: `verification_${status}`,
      messageText: fallbackText,
      status: 'fallback',
      errorMessage: errBody.slice(0, 200)
    });
    return sendMessage(normalized, fallbackText, { ...ctx, messageType: `verification_${status}_fallback` });
  }

  const data = await res.json();
  console.log(`[whatsapp/template] SUCCESS: templateName=${templateName} to=${normalized} metaMessageId=${data?.messages?.[0]?.id}`);
  await logMessage({
    ...ctx,
    recipient: normalized,
    messageType: `verification_${status}`,
    messageText: `[Template] ${templateName}`,
    status: 'sent',
    metaMessageId: data?.messages?.[0]?.id
  });
  
  return data;
}

/**
 * Obtiene el perfil de WhatsApp Business (campo about).
 */
export async function getWhatsAppProfile() {
  const url = new URL(`${GRAPH}/${PHONE_ID}/whatsapp_business_profile`);
  url.searchParams.set('fields', 'about');

  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${TOKEN}` }
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`WhatsApp profile read failed: ${res.status} ${err}`);
  }

  return res.json();
}

/**
 * Actualiza el campo About del perfil de WhatsApp Business.
 */
export async function setWhatsAppAbout(about) {
  const res = await fetch(`${GRAPH}/${PHONE_ID}/whatsapp_business_profile`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      about
    })
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`WhatsApp profile update failed: ${res.status} ${err}`);
  }

  return res.json();
}
