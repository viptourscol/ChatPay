import { readSystemState, writeSystemState } from './systemState.js';
import { setWhatsAppAbout } from './whatsapp.js';

export const BANK_HEALTH_MODES = {
  AVAILABLE: 'available',
  INTERMITTENT: 'intermittent'
};

export function normalizeBankHealthMode(mode) {
  return mode === BANK_HEALTH_MODES.INTERMITTENT
    ? BANK_HEALTH_MODES.INTERMITTENT
    : BANK_HEALTH_MODES.AVAILABLE;
}

export function buildAboutMessage(mode, customMessage) {
  const trimmed = (customMessage || '').trim();
  if (trimmed) return trimmed;

  if (mode === BANK_HEALTH_MODES.INTERMITTENT) {
    return process.env.BANK_HEALTH_INTERMITTENT_ABOUT ||
      'Intermitencia bancaria: algunas notificaciones pueden demorar. Seguimos operando.';
  }

  return process.env.BANK_HEALTH_AVAILABLE_ABOUT ||
    'Disponible: procesamiento de notificaciones en tiempo real.';
}

export async function syncWhatsAppAbout({ mode, customMessage, force = false }) {
  const about = buildAboutMessage(mode, customMessage);
  const state = await readSystemState(['bank_health_last_applied_about']);
  const lastApplied = state.bank_health_last_applied_about || '';

  if (!force && lastApplied === about) {
    return { updated: false, about };
  }

  await setWhatsAppAbout(about);
  await writeSystemState({ bank_health_last_applied_about: about });

  return { updated: true, about };
}
