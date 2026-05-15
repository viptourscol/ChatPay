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
