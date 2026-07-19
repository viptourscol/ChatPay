import { supabaseAdmin } from '../../lib/supabase.js';
import { requireUser } from '../../lib/auth.js';
import {
  BANK_HEALTH_MODES,
  normalizeBankHealthMode,
  syncWhatsAppAbout
} from '../../lib/bankHealth.js';
import { readSystemState, writeSystemState } from '../../lib/systemState.js';

const ADMIN_EMAILS = (process.env.ADMIN_EMAILS || '').split(',').map(e => e.trim().toLowerCase());

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(204).end();

  const user = await requireUser(req, res);
  if (!user) return;

  // Soporte de impersonación para super admin (solo lectura vía GET)
  const impersonateId = req.headers['x-impersonate-company'];
  const isAdmin = ADMIN_EMAILS.includes((user.email || '').toLowerCase());
  const impersonating = impersonateId && isAdmin;

  // GET — obtener settings de la empresa
  if (req.method === 'GET') {
    let query = supabaseAdmin.from('companies').select('*');
    if (impersonating) {
      query = query.eq('id', impersonateId);
    } else {
      query = query.eq('user_id', user.id);
    }
    const { data, error } = await query.single();

    // Si no existe, devolver vacío (se creará al guardar)
    if (error && error.code === 'PGRST116') {
      return res.json({ id: null, name: '', nit: '', tax_regime: '', address: '', phone: '' });
    }
    if (error) return res.status(500).json({ error: error.message });

    // Auto-deshabilitar números activos que excedan el límite del plan actual
    const PLAN_MAX_GET = { free: 1, basico: 0, estandar: 1, pro: 2, empresarial: 2, enterprise: 2, business: 1 };
    const maxActive = PLAN_MAX_GET[data.plan] ?? 0;
    const contacts = Array.isArray(data.notification_whatsapp) ? data.notification_whatsapp : [];
    let activeCount = 0;
    let needsUpdate = false;
    const adjusted = contacts.map(c => {
      if (c.active) {
        if (activeCount < maxActive) { activeCount++; return c; }
        needsUpdate = true;
        return { ...c, active: false };
      }
      return c;
    });
    if (needsUpdate) {
      const updateTarget = impersonating ? { id: impersonateId } : { user_id: user.id };
      const col = impersonating ? 'id' : 'user_id';
      const val = impersonating ? impersonateId : user.id;
      await supabaseAdmin.from('companies').update({ notification_whatsapp: adjusted }).eq(col, val);
      data.notification_whatsapp = adjusted;
    }

    if (isAdmin) {
      try {
        const state = await readSystemState([
          'bank_health_mode',
          'bank_health_reason',
          'bank_health_since',
          'bank_health_manual_override',
          'bank_health_manual_message'
        ]);

        data.bank_health = {
          enabled: true,
          mode: normalizeBankHealthMode(state.bank_health_mode),
          reason: state.bank_health_reason || 'init',
          since: state.bank_health_since || null,
          manual_override: state.bank_health_manual_override === 'true',
          manual_message: state.bank_health_manual_message || ''
        };
      } catch (err) {
        console.error('[settings/get] bank_health fallback:', err?.message || err);
        data.bank_health = {
          enabled: false,
          mode: 'available',
          reason: 'unavailable',
          since: null,
          manual_override: false,
          manual_message: ''
        };
      }
    }

    return res.json(data);
  }

  // PUT — crear o actualizar settings
  if (req.method === 'PUT') {
    const { name, nit, tax_regime, address, phone, bancolombia_email, notification_whatsapp, bank_health } = req.body || {};
    // notification_whatsapp es un array jsonb; guardar [] si viene vacío/nulo
    const rawContacts = Array.isArray(notification_whatsapp) ? notification_whatsapp : [];

    // Resolver qué empresa actualizar (impersonación o propia)
    let targetId = null;
    if (impersonating) {
      // Super admin editando empresa impersonada → actualizar por ID directamente
      targetId = impersonateId;
    }

    // Obtener el plan de la empresa objetivo para calcular límite de WhatsApp
    const planQuery = targetId
      ? supabaseAdmin.from('companies').select('id, plan').eq('id', targetId).maybeSingle()
      : supabaseAdmin.from('companies').select('id, plan').eq('user_id', user.id).maybeSingle();
    const { data: planData } = await planQuery;
    const plan = planData?.plan || 'basico';
    if (!targetId) targetId = planData?.id || null;

    const PLAN_MAX = { free: 1, basico: 0, estandar: 1, pro: 2, empresarial: 2, enterprise: 2, business: 1 };
    const maxNums = PLAN_MAX[plan] ?? 0;
    const sliced = rawContacts.slice(0, Math.max(maxNums, rawContacts.length));
    let activeAllowed = maxNums;
    const notifContacts = sliced.map(c => {
      if (c.active && activeAllowed > 0) { activeAllowed--; return c; }
      if (c.active && activeAllowed <= 0) return { ...c, active: false };
      return c;
    });

    let result, error;
    if (targetId) {
      ({ data: result, error } = await supabaseAdmin
        .from('companies')
        .update({ name, nit, tax_regime, address, phone, bancolombia_email: bancolombia_email || null, notification_whatsapp: notifContacts })
        .eq('id', targetId)
        .select()
        .single());
    } else {
      ({ data: result, error } = await supabaseAdmin
        .from('companies')
        .insert({ user_id: user.id, name, nit, tax_regime, address, phone, bancolombia_email: bancolombia_email || null, notification_whatsapp: notifContacts })
        .select()
        .single());
    }

    if (error) return res.status(500).json({ error: error.message });

    let bankHealthWarning = null;
    if (isAdmin && bank_health && typeof bank_health === 'object') {
      try {
        const manualOverride = bank_health.manual_override === true;
        const mode = normalizeBankHealthMode(bank_health.mode);
        const manualMessage = typeof bank_health.manual_message === 'string'
          ? bank_health.manual_message.trim()
          : '';

        const nowIso = new Date().toISOString();
        await writeSystemState({
          bank_health_manual_override: String(manualOverride),
          bank_health_manual_message: manualMessage,
          bank_health_mode: mode,
          bank_health_reason: manualOverride ? 'manual_override' : 'manual_release',
          bank_health_since: nowIso,
          bank_health_recovery_streak: '0'
        });

        if (manualOverride) {
          await syncWhatsAppAbout({ mode, customMessage: manualMessage, force: true });
        } else {
          await syncWhatsAppAbout({ mode: BANK_HEALTH_MODES.AVAILABLE, customMessage: manualMessage, force: true });
        }
      } catch (err) {
        bankHealthWarning = err?.message || 'No se pudo sincronizar el estado de WhatsApp';
      }
    }

    if (isAdmin) {
      try {
        const state = await readSystemState([
          'bank_health_mode',
          'bank_health_reason',
          'bank_health_since',
          'bank_health_manual_override',
          'bank_health_manual_message'
        ]);
        result.bank_health = {
          enabled: true,
          mode: normalizeBankHealthMode(state.bank_health_mode),
          reason: state.bank_health_reason || 'init',
          since: state.bank_health_since || null,
          manual_override: state.bank_health_manual_override === 'true',
          manual_message: state.bank_health_manual_message || ''
        };
      } catch (err) {
        console.error('[settings/put] bank_health fallback:', err?.message || err);
        result.bank_health = {
          enabled: false,
          mode: 'available',
          reason: 'unavailable',
          since: null,
          manual_override: false,
          manual_message: ''
        };
      }
    }

    if (bankHealthWarning) result.bank_health_warning = bankHealthWarning;
    return res.json(result);
  }

  res.status(405).json({ error: 'Método no permitido' });
}
