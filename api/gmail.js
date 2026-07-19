/**
 * api/gmail/index.js
 *
 * Endpoint unificado para gmail. Usa query ?action=sync|push|watch
 * Reemplaza los tres archivos separados sync.js / push.js / watch.js
 * para mantenerse dentro del límite de 12 funciones del plan Hobby de Vercel.
 */

import { syncBancolombiaEmails, saveHistoryId, watchGmailInbox } from '../lib/gmail.js';
import { runBankHealthJob } from '../lib/bankHealthJob.js';

export const config = { api: { bodyParser: true } };

function checkSecret(req) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return true;
  const provided =
    req.headers['x-cron-secret'] ||
    (req.headers['authorization'] || '').replace('Bearer ', '');
  return provided === secret;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') return res.status(204).end();

  const action = req.query.action || req.query.path?.split('/').pop();

  // ── PUSH (Pub/Sub) ────────────────────────────────────────────────────────
  if (action === 'push') {
    if (req.method !== 'POST') return res.status(405).end();
    try {
      const envelope = req.body;
      if (!envelope?.message?.data) {
        console.warn('[gmail/push] payload sin message.data');
        return res.status(200).json({ received: true });
      }
      const decoded = Buffer.from(envelope.message.data, 'base64').toString('utf8');
      const notification = JSON.parse(decoded);
      const { historyId, emailAddress } = notification;
      if (!historyId) {
        console.warn('[gmail/push] sin historyId:', notification);
        return res.status(200).json({ received: true });
      }
      console.log(`[gmail/push] email=${emailAddress} historyId=${historyId}`);
      const result = await syncBancolombiaEmails({ minutes: 10 });
      await saveHistoryId(historyId);
      console.log(`[gmail/push] scanned=${result.scanned} inserted=${result.inserted}`);
      return res.status(200).json({ received: true, inserted: result.inserted });
    } catch (err) {
      console.error('[gmail/push] error:', err);
      return res.status(200).json({ received: true, error: err.message });
    }
  }

  // ── WATCH ─────────────────────────────────────────────────────────────────
  if (action === 'watch') {
    if (!checkSecret(req)) return res.status(401).json({ error: 'unauthorized' });
    if (req.method !== 'GET' && req.method !== 'POST') return res.status(405).end();
    try {
      const result = await watchGmailInbox();
      const expiresAt = new Date(Number(result.expiration)).toISOString();
      console.log(`[gmail/watch] renovado | expira=${expiresAt}`);
      return res.json({ ok: true, historyId: result.historyId, expiresAt });
    } catch (err) {
      console.error('[gmail/watch] error:', err);
      return res.status(500).json({ error: err.message });
    }
  }

  // ── BANK HEALTH (global WhatsApp info status) ───────────────────────────
  if (action === 'bank-health') {
    if (!checkSecret(req)) return res.status(401).json({ error: 'unauthorized' });
    if (req.method !== 'GET' && req.method !== 'POST') return res.status(405).end();
    try {
      const result = await runBankHealthJob();
      return res.json(result);
    } catch (err) {
      console.error('[bank-health] error:', err);
      return res.status(500).json({ error: err.message });
    }
  }

  // ── SYNC (default) ────────────────────────────────────────────────────────
  if (!checkSecret(req)) return res.status(401).json({ error: 'unauthorized' });
  if (req.method !== 'GET' && req.method !== 'POST') return res.status(405).end();
  const minutes = parseInt(req.query.minutes || '30');
  try {
    const result = await syncBancolombiaEmails({ minutes });
    console.log(`[gmail/sync] scanned=${result.scanned} inserted=${result.inserted}`);
    return res.json({ ok: true, scanned: result.scanned, inserted: result.inserted, minutes, timestamp: new Date().toISOString() });
  } catch (err) {
    console.error('[gmail/sync] error:', err);
    return res.status(500).json({ error: err.message });
  }
}
