import { supabaseAdmin } from './supabase.js';
import {
  BANK_HEALTH_MODES,
  normalizeBankHealthMode,
  syncWhatsAppAbout
} from './bankHealth.js';
import { readSystemState, writeSystemState } from './systemState.js';

const RECOVERY_STREAK_TARGET = 2;

function minutesSince(isoDate) {
  if (!isoDate) return null;
  const ms = Date.now() - new Date(isoDate).getTime();
  return Number.isFinite(ms) ? Math.floor(ms / 60000) : null;
}

export async function runBankHealthJob() {
  const state = await readSystemState([
    'bank_health_mode',
    'bank_health_reason',
    'bank_health_since',
    'bank_health_manual_override',
    'bank_health_manual_message',
    'bank_health_recovery_streak'
  ]);

  const manualOverride = state.bank_health_manual_override === 'true';
  const currentMode = normalizeBankHealthMode(state.bank_health_mode);
  const currentReason = state.bank_health_reason || 'init';
  const manualMessage = state.bank_health_manual_message || '';
  const currentStreak = Number(state.bank_health_recovery_streak || '0') || 0;

  if (manualOverride) {
    const mode = normalizeBankHealthMode(currentMode);
    const sync = await syncWhatsAppAbout({ mode, customMessage: manualMessage });
    await writeSystemState({
      bank_health_last_eval_at: new Date().toISOString(),
      bank_health_reason: 'manual_override'
    });

    return {
      ok: true,
      source: 'manual_override',
      mode,
      reason: 'manual_override',
      aboutUpdated: sync.updated,
      about: sync.about
    };
  }

  const twoHoursAgo = new Date(Date.now() - 120 * 60 * 1000).toISOString();

  const [{ data: lastEmailTx }, { data: oldestPendingSms }, { count: recentSmsCount }] = await Promise.all([
    supabaseAdmin
      .from('transactions')
      .select('created_at')
      .eq('source', 'email')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabaseAdmin
      .from('transaction_sms')
      .select('received_at')
      .eq('status', 'pending_match')
      .order('received_at', { ascending: true })
      .limit(1)
      .maybeSingle(),
    supabaseAdmin
      .from('transaction_sms')
      .select('id', { count: 'exact', head: true })
      .gte('received_at', twoHoursAgo)
  ]);

  const lastEmailMinutes = minutesSince(lastEmailTx?.created_at);
  const pendingSmsMinutes = minutesSince(oldestPendingSms?.received_at);

  const signalEmailStall = (recentSmsCount || 0) > 0 && lastEmailMinutes !== null && lastEmailMinutes > 65;
  const signalOrphanedSms = pendingSmsMinutes !== null && pendingSmsMinutes > 120;

  const shouldBeIntermittent = signalEmailStall || signalOrphanedSms;
  const nextMode = shouldBeIntermittent ? BANK_HEALTH_MODES.INTERMITTENT : BANK_HEALTH_MODES.AVAILABLE;

  const reasons = [];
  if (signalEmailStall) reasons.push(`email_stall_${lastEmailMinutes}m`);
  if (signalOrphanedSms) reasons.push(`pending_sms_${pendingSmsMinutes}m`);
  const nextReason = reasons.length > 0 ? reasons.join('+') : 'healthy';

  let effectiveMode = currentMode;
  let effectiveReason = currentReason;
  let nextStreak = currentStreak;

  if (nextMode === BANK_HEALTH_MODES.INTERMITTENT) {
    effectiveMode = BANK_HEALTH_MODES.INTERMITTENT;
    effectiveReason = nextReason;
    nextStreak = 0;
  } else if (currentMode === BANK_HEALTH_MODES.INTERMITTENT) {
    nextStreak += 1;
    if (nextStreak >= RECOVERY_STREAK_TARGET) {
      effectiveMode = BANK_HEALTH_MODES.AVAILABLE;
      effectiveReason = 'healthy_recovered';
    } else {
      effectiveMode = BANK_HEALTH_MODES.INTERMITTENT;
      effectiveReason = `recovery_streak_${nextStreak}`;
    }
  } else {
    effectiveMode = BANK_HEALTH_MODES.AVAILABLE;
    effectiveReason = 'healthy';
    nextStreak = 0;
  }

  const modeChanged = effectiveMode !== currentMode;
  const sync = await syncWhatsAppAbout({
    mode: effectiveMode,
    customMessage: manualMessage,
    force: modeChanged
  });

  await writeSystemState({
    bank_health_mode: effectiveMode,
    bank_health_reason: effectiveReason,
    bank_health_since: modeChanged ? new Date().toISOString() : (state.bank_health_since || new Date().toISOString()),
    bank_health_recovery_streak: String(nextStreak),
    bank_health_last_eval_at: new Date().toISOString()
  });

  return {
    ok: true,
    source: 'automatic',
    mode: effectiveMode,
    reason: effectiveReason,
    modeChanged,
    signals: {
      signalEmailStall,
      signalOrphanedSms,
      lastEmailMinutes,
      pendingSmsMinutes,
      recentSmsCount: recentSmsCount || 0
    },
    aboutUpdated: sync.updated,
    about: sync.about
  };
}
