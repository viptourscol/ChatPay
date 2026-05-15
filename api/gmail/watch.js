/**
 * api/gmail/watch.js
 *
 * Registra o renueva el watch de Gmail Push Notifications.
 * Debe llamarse:
 *   - Una vez al configurar el sistema por primera vez
 *   - Cada 7 días (el watch expira), por el cron semanal en vercel.json
 *
 * Requiere header: x-cron-secret o Authorization: Bearer <CRON_SECRET>
 */

import { watchGmailInbox } from '../../lib/gmail.js';

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(204).end();

  // Verificar secreto
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const provided =
      req.headers['x-cron-secret'] ||
      (req.headers['authorization'] || '').replace('Bearer ', '');
    if (provided !== secret) {
      return res.status(401).json({ error: 'unauthorized' });
    }
  }

  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ error: 'method not allowed' });
  }

  try {
    const result = await watchGmailInbox();
    const expiresAt = new Date(Number(result.expiration)).toISOString();
    console.log(`[gmail watch] renovado | expira=${expiresAt}`);
    return res.json({
      ok: true,
      historyId: result.historyId,
      expiresAt,
      message: 'Gmail watch registrado. Las notificaciones push están activas.'
    });
  } catch (err) {
    console.error('[gmail watch] error:', err);
    return res.status(500).json({ error: err.message });
  }
}
