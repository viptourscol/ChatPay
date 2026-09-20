import { supabaseAdmin } from '../../lib/supabase.js';
import { requireUser } from '../../lib/auth.js';
import {
  BANK_HEALTH_MODES,
  normalizeBankHealthMode,
  syncWhatsAppAbout
} from '../../lib/bankHealth.js';
import { readSystemState, writeSystemState } from '../../lib/systemState.js';
import { getCompany } from '../../lib/getCompany.js';
import {
  getPendingTransactions,
  formatNotificationMessage
} from '../../lib/scheduledNotifications.js';
import { sendMessage } from '../../lib/whatsapp.js';

const ADMIN_EMAILS = (process.env.ADMIN_EMAILS || '').split(',').map(e => e.trim().toLowerCase());

// ─── Locations Handler ────────────────────────────────────────────────────

async function handleLocationsGet(req, res, user, impersonateId, isAdmin) {
  try {
    let companyId = null;

    if (impersonateId && isAdmin) {
      // Super admin impersonating another company
      companyId = impersonateId;
    } else {
      // Regular user - get their own company
      const company = await getCompany(user.id);
      if (!company) return res.status(401).json({ error: 'Unauthorized' });
      companyId = company.id;
    }

    // Obtener todas las locations de la compañía
    const { data, error } = await supabaseAdmin
      .from('company_locations')
      .select('id, name, city, address, is_active, created_at')
      .eq('company_id', companyId)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('[settings/locations] GET error:', error.message);
      return res.status(500).json({ error: error.message });
    }

    return res.status(200).json(data || []);
  } catch (err) {
    console.error('[settings/locations] GET fatal:', err.message);
    return res.status(500).json({ error: err.message });
  }
}

// ─── Notification Schedules Handlers ───────────────────────────────────────

async function handleNotificationSchedulesGet(req, res, user, impersonateId, isAdmin) {
  try {
    let companyId = null;
    
    if (impersonateId && isAdmin) {
      // Super admin impersonating another company
      companyId = impersonateId;
    } else {
      // Regular user - get their own company
      const company = await getCompany(user.id);
      if (!company) return res.status(401).json({ error: 'Unauthorized' });
      companyId = company.id;
    }

    const { data, error } = await supabaseAdmin
      .from('notification_schedules')
      .select('*')
      .eq('company_id', companyId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[settings/notification-schedules] GET error:', error.message);
      return res.status(500).json({ error: error.message });
    }

    return res.status(200).json(data || []);
  } catch (err) {
    console.error('[settings/notification-schedules] GET fatal:', err.message);
    return res.status(500).json({ error: err.message });
  }
}

async function handleNotificationSchedulesPost(req, res, user, impersonateId, isAdmin) {
  try {
    let companyId = null;
    
    if (impersonateId && isAdmin) {
      // Super admin impersonating another company
      companyId = impersonateId;
    } else {
      // Regular user - get their own company
      const company = await getCompany(user.id);
      if (!company) return res.status(401).json({ error: 'Unauthorized' });
      companyId = company.id;
    }

    const {
      frequency = 'daily',
      day_of_week = null,
      time_of_day = '09:00:00',
      timezone = 'America/Bogota',
      recipient_phone,
      channel = 'whatsapp',
      include_all_locations = true,
      location_ids = [],
      enabled = true
    } = req.body;

    // Validaciones
    if (!recipient_phone || recipient_phone.trim() === '') {
      return res.status(400).json({ error: 'recipient_phone is required' });
    }

    if (!['daily', 'weekly'].includes(frequency)) {
      return res.status(400).json({ error: 'frequency must be daily or weekly' });
    }

    if (frequency === 'weekly' && (day_of_week === null || day_of_week === undefined)) {
      return res.status(400).json({ error: 'day_of_week is required for weekly frequency' });
    }

    if (day_of_week !== null && (day_of_week < 0 || day_of_week > 6)) {
      return res.status(400).json({ error: 'day_of_week must be 0-6' });
    }

    // Normalizar número WhatsApp
    let normalizedPhone = recipient_phone.trim();
    if (!normalizedPhone.startsWith('+')) {
      normalizedPhone = '+' + normalizedPhone.replace(/\D/g, '');
    }

    // Crear
    const { data, error } = await supabaseAdmin
      .from('notification_schedules')
      .insert({
        company_id: companyId,
        frequency,
        day_of_week,
        time_of_day,
        timezone,
        recipient_phone: normalizedPhone,
        channel,
        include_all_locations,
        location_ids: include_all_locations ? [] : location_ids,
        enabled
      })
      .select()
      .single();

    if (error) {
      console.error('[settings/notification-schedules] POST error:', error.message);
      return res.status(500).json({ error: error.message });
    }

    console.log(`[settings/notification-schedules] created schedule ${data.id} for company ${companyId}`);
    return res.status(201).json(data);
  } catch (err) {
    console.error('[settings/notification-schedules] POST fatal:', err.message);
    return res.status(500).json({ error: err.message });
  }
}

async function handleNotificationSchedulesPatch(req, res, user, impersonateId, isAdmin) {
  try {
    let companyId = null;
    
    if (impersonateId && isAdmin) {
      // Super admin impersonating another company
      companyId = impersonateId;
    } else {
      // Regular user - get their own company
      const company = await getCompany(user.id);
      if (!company) return res.status(401).json({ error: 'Unauthorized' });
      companyId = company.id;
    }

    const { id } = req.query;
    if (!id) return res.status(400).json({ error: 'id is required' });

    const updates = req.body;

    // Validaciones de updates
    if (updates.frequency && !['daily', 'weekly'].includes(updates.frequency)) {
      return res.status(400).json({ error: 'frequency must be daily or weekly' });
    }

    if (updates.day_of_week !== undefined && updates.day_of_week !== null) {
      if (updates.day_of_week < 0 || updates.day_of_week > 6) {
        return res.status(400).json({ error: 'day_of_week must be 0-6' });
      }
    }

    if (updates.recipient_phone) {
      updates.recipient_phone = updates.recipient_phone.trim();
      if (!updates.recipient_phone.startsWith('+')) {
        updates.recipient_phone = '+' + updates.recipient_phone.replace(/\D/g, '');
      }
    }

    // Verificar pertenencia
    const { data: schedule, error: fetchErr } = await supabaseAdmin
      .from('notification_schedules')
      .select('company_id')
      .eq('id', id)
      .maybeSingle();

    if (fetchErr || !schedule) {
      return res.status(404).json({ error: 'Not found' });
    }

    if (schedule.company_id !== companyId) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    // Actualizar
    const { data, error } = await supabaseAdmin
      .from('notification_schedules')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('[settings/notification-schedules] PATCH error:', error.message);
      return res.status(500).json({ error: error.message });
    }

    console.log(`[settings/notification-schedules] updated schedule ${id}`);
    return res.status(200).json(data);
  } catch (err) {
    console.error('[settings/notification-schedules] PATCH fatal:', err.message);
    return res.status(500).json({ error: err.message });
  }
}

async function handleNotificationSchedulesDelete(req, res, user, impersonateId, isAdmin) {
  try {
    let companyId = null;
    
    if (impersonateId && isAdmin) {
      // Super admin impersonating another company
      companyId = impersonateId;
    } else {
      // Regular user - get their own company
      const company = await getCompany(user.id);
      if (!company) return res.status(401).json({ error: 'Unauthorized' });
      companyId = company.id;
    }

    const { id } = req.query;
    if (!id) return res.status(400).json({ error: 'id is required' });

    // Verificar pertenencia
    const { data: schedule, error: fetchErr } = await supabaseAdmin
      .from('notification_schedules')
      .select('company_id')
      .eq('id', id)
      .maybeSingle();

    if (fetchErr || !schedule) {
      return res.status(404).json({ error: 'Not found' });
    }

    if (schedule.company_id !== companyId) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    // Eliminar
    const { error } = await supabaseAdmin
      .from('notification_schedules')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('[settings/notification-schedules] DELETE error:', error.message);
      return res.status(500).json({ error: error.message });
    }

    console.log(`[settings/notification-schedules] deleted schedule ${id}`);
    return res.status(204).end();
  } catch (err) {
    console.error('[settings/notification-schedules] DELETE fatal:', err.message);
    return res.status(500).json({ error: err.message });
  }
}

// ─── Notification Logs Handler (Diagnostics) ───────────────────────────────

async function handleNotificationLogsGet(req, res, user, impersonateId, isAdmin) {
  try {
    let companyId = null;

    if (impersonateId && isAdmin) {
      companyId = impersonateId;
    } else {
      const company = await getCompany(user.id);
      if (!company) return res.status(401).json({ error: 'Unauthorized' });
      companyId = company.id;
    }

    // Obtener notificaciones programadas habilitadas
    const { data: schedules, error: schedulesErr } = await supabaseAdmin
      .from('notification_schedules')
      .select('*')
      .eq('company_id', companyId)
      .eq('enabled', true);

    if (schedulesErr) {
      console.error('[settings/notification-logs] schedules error:', schedulesErr.message);
      return res.status(500).json({ error: schedulesErr.message });
    }

    // Obtener últimos 50 logs de notificaciones programadas (últimas 7 días)
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const { data: logs, error: logsErr } = await supabaseAdmin
      .from('whatsapp_logs')
      .select('*')
      .eq('company_id', companyId)
      .eq('message_type', 'scheduled_notification')
      .gte('sent_at', sevenDaysAgo)
      .order('sent_at', { ascending: false })
      .limit(50);

    if (logsErr) {
      console.error('[settings/notification-logs] logs error:', logsErr.message);
      return res.status(500).json({ error: logsErr.message });
    }

    // Resumir: cuántos enviados, cuántos fallidos, últimas horas
    const summary = {
      total_scheduled: schedules.length,
      total_logs: logs.length,
      sent_count: logs.filter(l => l.status === 'sent').length,
      failed_count: logs.filter(l => l.status === 'failed').length,
      last_log: logs[0] ? {
        sent_at: logs[0].sent_at,
        recipient: logs[0].recipient,
        status: logs[0].status,
        error_message: logs[0].error_message
      } : null
    };

    return res.status(200).json({
      summary,
      schedules: schedules.map(s => ({
        id: s.id,
        recipient_phone: s.recipient_phone,
        frequency: s.frequency,
        time_of_day: s.time_of_day,
        timezone: s.timezone,
        enabled: s.enabled,
        last_sent_at: s.last_sent_at,
        include_all_locations: s.include_all_locations
      })),
      recent_logs: logs.slice(0, 20)
    });
  } catch (err) {
    console.error('[settings/notification-logs] GET fatal:', err.message);
    return res.status(500).json({ error: err.message });
  }
}

// ─── Send Test Notification Handler ────────────────────────────────────────

async function handleSendTestNotification(req, res, user, impersonateId, isAdmin) {
  try {
    if (req.method !== 'POST') {
      return res.status(405).json({ error: 'Method not allowed' });
    }

    let companyId = null;

    if (impersonateId && isAdmin) {
      companyId = impersonateId;
    } else {
      const company = await getCompany(user.id);
      if (!company) return res.status(401).json({ error: 'Unauthorized' });
      companyId = company.id;
    }

    // Obtener la notificación (desde body o usar la primera activa)
    const { scheduleId } = req.body;

    let schedule = null;
    if (scheduleId) {
      const { data, error } = await supabaseAdmin
        .from('notification_schedules')
        .select('*')
        .eq('id', scheduleId)
        .eq('company_id', companyId)
        .single();

      if (error) {
        console.error('[settings/send-test-notification] schedule not found:', error.message);
        return res.status(404).json({ error: 'Notification not found' });
      }
      schedule = data;
    } else {
      // Usar la primera habilitada
      const { data, error } = await supabaseAdmin
        .from('notification_schedules')
        .select('*')
        .eq('company_id', companyId)
        .eq('enabled', true)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (error) {
        console.error('[settings/send-test-notification] no active schedules:', error.message);
        return res.status(404).json({ error: 'No active notification schedules found' });
      }
      schedule = data;
    }

    // Obtener ingresos pendientes
    console.log(`[send-test-notification] Getting pending transactions for company ${companyId}`);
    const transactions = await getPendingTransactions(companyId);

    // Formatear mensaje
    const message = formatNotificationMessage(transactions);

    // Enviar por WhatsApp
    console.log(`[send-test-notification] Sending test notification to ${schedule.recipient_phone}`);
    const result = await sendMessage(
      schedule.recipient_phone,
      message,
      {
        companyId: companyId,
        messageType: 'scheduled_notification'
      }
    );

    console.log(`[send-test-notification] Message sent: ${JSON.stringify(result)}`);

    return res.status(200).json({
      success: true,
      message: `Reporte enviado a ${schedule.recipient_phone}`,
      schedule: {
        id: schedule.id,
        recipient_phone: schedule.recipient_phone,
        frequency: schedule.frequency
      },
      locationStats: locationStats,
      messagePreview: message
    });
  } catch (err) {
    console.error('[settings/send-test-notification] fatal error:', err.message);
    return res.status(500).json({ error: err.message });
  }
}

// ─── Main Handler ──────────────────────────────────────────────────────────

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(204).end();

  // ¡IMPORTANTE! Validar usuario PRIMERO antes de cualquier query
  const user = await requireUser(req, res);
  if (!user) return;

  // Soporte de impersonación para super admin
  const impersonateId = req.headers['x-impersonate-company'];
  const isAdmin = ADMIN_EMAILS.includes((user.email || '').toLowerCase());
  const impersonating = impersonateId && isAdmin;

  // Route to locations if resource param is set
  if (req.query.resource === 'locations') {
    if (req.method === 'GET') {
      return handleLocationsGet(req, res, user, impersonateId, isAdmin);
    }
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Route to notification-logs if resource param is set (diagnostics)
  if (req.query.resource === 'notification-logs') {
    if (req.method === 'GET') {
      return handleNotificationLogsGet(req, res, user, impersonateId, isAdmin);
    }
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Route to send-test-notification if resource param is set
  if (req.query.resource === 'send-test-notification') {
    return handleSendTestNotification(req, res, user, impersonateId, isAdmin);
  }

  // Route to notification-schedules if resource param is set
  if (req.query.resource === 'notification-schedules') {
    switch (req.method) {
      case 'GET':
        return handleNotificationSchedulesGet(req, res, user, impersonateId, isAdmin);
      case 'POST':
        return handleNotificationSchedulesPost(req, res, user, impersonateId, isAdmin);
      case 'PATCH':
        return handleNotificationSchedulesPatch(req, res, user, impersonateId, isAdmin);
      case 'DELETE':
        return handleNotificationSchedulesDelete(req, res, user, impersonateId, isAdmin);
      default:
        return res.status(405).json({ error: 'Method not allowed' });
    }
  }
  const canManageBankHealth = isAdmin;

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
    const PLAN_MAX_GET = { free: 1, basico: 1, estandar: 1, pro: 2, empresarial: 2, enterprise: 2, business: 1 };
    const maxActive = PLAN_MAX_GET[data.plan] ?? 1;
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

    if (canManageBankHealth) {
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

    const PLAN_MAX = { free: 1, basico: 1, estandar: 1, pro: 2, empresarial: 2, enterprise: 2, business: 1 };
    const maxNums = PLAN_MAX[plan] ?? 1;
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
    if (canManageBankHealth && bank_health && typeof bank_health === 'object') {
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

    if (canManageBankHealth) {
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
