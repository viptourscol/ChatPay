/**
 * api/cron.js
 *
 * Consolidates all cron jobs into a single serverless function.
 * Vercel Hobby plan limit: 12 functions total
 *
 * Supported actions:
 * - action=gmail-watch
 * - action=bank-health
 * - action=subscription-reminders
 * - action=verification-expiration
 * - action=scheduled-notifications
 */

import { processScheduledNotifications } from '../lib/scheduledNotifications.js';
import { processAllExpiredVerifications } from '../lib/verificationExpiration.js';
import { supabaseAdmin } from '../lib/supabase.js';

export const config = { api: { bodyParser: true } };

export default async function handler(req, res) {
  // Validate Vercel cron authorization
  const authHeader = req.headers.authorization || '';
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret) {
    const provided = authHeader.replace(/Bearer\s+/i, '');
    if (provided !== cronSecret) {
      console.error('[cron] unauthorized attempt');
      return res.status(401).json({ error: 'Unauthorized' });
    }
  }

  const action = req.query.action || 'scheduled-notifications';

  try {
    if (action === 'scheduled-notifications') {
      console.log('[cron/scheduled-notifications] starting');
      const result = await processScheduledNotifications();
      console.log('[cron/scheduled-notifications] completed:', result);
      return res.status(200).json(result);
    }
    
    if (action === 'verification-expiration') {
      console.log('[cron/verification-expiration] starting');
      const result = await processAllExpiredVerifications();
      console.log('[cron/verification-expiration] completed:', result);
      return res.status(200).json(result);
    }

    // Delegated to original endpoints (not consolidated here for now)
    // These keep their original paths in vercel.json
    return res.status(400).json({ error: `Unsupported action: ${action}` });
  } catch (error) {
    console.error(`[cron/${action}] fatal error:`, error);
    return res.status(500).json({
      error: 'Internal Server Error',
      message: error.message
    });
  }
}
