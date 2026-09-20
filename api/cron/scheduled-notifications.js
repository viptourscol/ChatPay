/**
 * api/cron/scheduled-notifications.js
 *
 * Cron job que ejecuta cada hora.
 * Verifica qué notificaciones programadas deben ejecutarse y las envía.
 *
 * URL de invocación (Vercel Cron): GET /api/cron/scheduled-notifications
 * Schedule: "0 * * * *" (cada hora)
 */

import { processScheduledNotifications } from '../../lib/scheduledNotifications.js';

export const config = { api: { bodyParser: true } };

export default async function handler(req, res) {
  // Validar que es una request del cron de Vercel
  const authHeader = req.headers.authorization || '';
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret) {
    const provided = authHeader.replace(/Bearer\s+/i, '');
    if (provided !== cronSecret) {
      console.error('[cron/scheduled-notifications] unauthorized attempt');
      return res.status(401).json({ error: 'Unauthorized' });
    }
  }

  try {
    console.log('[cron/scheduled-notifications] starting');
    
    const result = await processScheduledNotifications();

    console.log('[cron/scheduled-notifications] completed:', result);
    return res.status(200).json(result);
  } catch (error) {
    console.error('[cron/scheduled-notifications] fatal error:', error);
    return res.status(500).json({
      error: 'Internal Server Error',
      message: error.message
    });
  }
}
