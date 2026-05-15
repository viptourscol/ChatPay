/**
 * api/gmail/sync.js
 *
 * Sincroniza los emails de Bancolombia y los almacena como transacciones 'pending'.
 * Se invoca:
 *   - Automáticamente cada 15 min por Vercel Cron
 *   - Manualmente desde el Dashboard con header x-cron-secret
 *
 * Variable de entorno requerida:
 *   CRON_SECRET — token secreto para proteger el endpoint
 */

import { syncBancolombiaEmails } from '../../lib/gmail.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') return res.status(204).end();

  // Verificar secreto (Vercel Cron lo envía en Authorization, nosotros en x-cron-secret)
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

  const minutes = parseInt(req.query.minutes || '30');

  try {
    const result = await syncBancolombiaEmails({ minutes });
    console.log(`[gmail/sync] scanned=${result.scanned} inserted=${result.inserted}`);
    return res.json({
      ok: true,
      scanned: result.scanned,
      inserted: result.inserted,
      minutes,
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    console.error('[gmail/sync] error:', err);
    return res.status(500).json({ error: err.message });
  }
}
