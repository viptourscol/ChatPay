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

  try {
    const envelope = req.body;
    if (!envelope?.message?.data) {
      console.warn('[gmail push] payload sin message.data');
      return res.status(200).json({ received: true });
    }

    // Decodificar el mensaje de Pub/Sub (base64 → JSON)
    const decoded = Buffer.from(envelope.message.data, 'base64').toString('utf8');
    const notification = JSON.parse(decoded);

    const { historyId, emailAddress } = notification;
    if (!historyId) {
      console.warn('[gmail push] notificación sin historyId:', notification);
      return res.status(200).json({ received: true });
    }

    console.log(`[gmail push] notificación recibida | email=${emailAddress} | historyId=${historyId}`);

    // Procesar ANTES de responder para que Vercel no corte la ejecución
    const result = await processGmailHistory(historyId);
    console.log(`[gmail push] procesadas ${result.processed} transacción(es) nueva(s)`);

    return res.status(200).json({ received: true, processed: result.processed });
  } catch (err) {
    console.error('[gmail push] error:', err);
    // Responder 200 igual para que Pub/Sub no reintente indefinidamente
    return res.status(200).json({ received: true, error: err.message });
  }
}
