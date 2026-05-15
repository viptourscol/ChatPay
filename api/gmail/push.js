/**
 * api/gmail/push.js
 *
 * Recibe notificaciones en tiempo real de Google Cloud Pub/Sub cuando
 * llega un email nuevo a la bandeja de entrada de Gmail.
 *
 * Flujo:
 *   1. Llega email de Bancolombia al correo configurado
 *   2. Gmail notifica al tópico de Pub/Sub (< 10 segundos)
 *   3. Pub/Sub hace POST a este endpoint
 *   4. Usamos la Gmail History API para obtener el mensaje nuevo
 *   5. Lo parseamos y almacenamos como transaction { status: 'pending' }
 *
 * Configuración en Google Cloud:
 *   - Crear tópico Pub/Sub: gmail-notifications
 *   - Dar permiso de publicar a: gmail-api-push@system.gserviceaccount.com
 *   - Crear suscripción push apuntando a: https://tu-dominio.com/api/gmail/push
 *   - Llamar a /api/gmail/watch una vez para activar el watch
 */

import { processGmailHistory } from '../../lib/gmail.js';

export const config = { api: { bodyParser: true } };

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  // Responder inmediatamente a Pub/Sub (si tardamos > 10s, reintenta)
  res.status(200).json({ received: true });

  try {
    const envelope = req.body;
    if (!envelope?.message?.data) {
      console.warn('[gmail push] payload sin message.data');
      return;
    }

    // Decodificar el mensaje de Pub/Sub (base64 → JSON)
    const decoded = Buffer.from(envelope.message.data, 'base64').toString('utf8');
    const notification = JSON.parse(decoded);

    // { emailAddress: "...", historyId: "12345" }
    const { historyId, emailAddress } = notification;
    if (!historyId) {
      console.warn('[gmail push] notificación sin historyId:', notification);
      return;
    }

    console.log(`[gmail push] notificación recibida | email=${emailAddress} | historyId=${historyId}`);

    const result = await processGmailHistory(historyId);
    console.log(`[gmail push] procesadas ${result.processed} transacción(es) nueva(s)`);
  } catch (err) {
    console.error('[gmail push] error:', err);
  }
}
