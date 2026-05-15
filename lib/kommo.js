/**
 * lib/kommo.js
 * Cliente para la API de Kommo CRM.
 *
 * Variables de entorno necesarias:
 *   KOMMO_SUBDOMAIN     — subdominio de la cuenta (ej: "miempresa" → miempresa.kommo.com)
 *   KOMMO_ACCESS_TOKEN  — access token de larga duración (Configuración → Integraciones → API)
 */

const BASE = () => `https://${process.env.KOMMO_SUBDOMAIN}.kommo.com/api/v4`;

function headers() {
  return {
    Authorization: `Bearer ${process.env.KOMMO_ACCESS_TOKEN}`,
    'Content-Type': 'application/json'
  };
}

/**
 * Envía un mensaje de texto a un chat de Kommo.
 * @param {string} chatId   — UUID del chat (de la sesión de WhatsApp en Kommo)
 * @param {string} text     — mensaje a enviar
 */
export async function sendKommoMessage(chatId, text) {
  const url = `${BASE()}/chats/${chatId}/messages`;
  const res = await fetch(url, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify({ text })
  });
  if (!res.ok) {
    const err = await res.text();
    console.error('[kommo] sendMessage error:', res.status, err);
    throw new Error(`Kommo sendMessage failed: ${res.status}`);
  }
  return res.json();
}

/**
 * Descarga el archivo adjunto desde la URL de Kommo (CDN interno).
 * Kommo requiere el mismo token de autorización para acceder a archivos privados.
 * @param {string} fileUrl  — URL del archivo (del payload del webhook)
 * @returns {{ buffer: Buffer, mimeType: string }}
 */
export async function downloadKommoFile(fileUrl) {
  const res = await fetch(fileUrl, {
    headers: { Authorization: `Bearer ${process.env.KOMMO_ACCESS_TOKEN}` }
  });
  if (!res.ok) throw new Error(`Kommo file download failed: ${res.status}`);
  const mimeType = res.headers.get('content-type') || 'image/jpeg';
  const buffer = Buffer.from(await res.arrayBuffer());
  return { buffer, mimeType };
}

/**
 * Obtiene los datos de un contacto de Kommo por su ID.
 * @param {number} contactId
 */
export async function getKommoContact(contactId) {
  const url = `${BASE()}/contacts/${contactId}`;
  const res = await fetch(url, { headers: headers() });
  if (!res.ok) return null;
  return res.json();
}

/**
 * Verifica la firma HMAC del webhook si KOMMO_WEBHOOK_SECRET está definido.
 * Kommo incluye la firma en el header X-Signature o como parámetro.
 * @param {string} rawBody   — cuerpo crudo del request
 * @param {string} signature — valor del header de firma
 */
import { createHmac } from 'node:crypto';

export function verifyKommoSignature(rawBody, signature) {
  const secret = process.env.KOMMO_WEBHOOK_SECRET;
  if (!secret) return true; // sin secreto configurado, aceptar todo
  if (!signature) return false;
  const expected = createHmac('sha1', secret).update(rawBody).digest('hex');
  return expected === signature;
}
