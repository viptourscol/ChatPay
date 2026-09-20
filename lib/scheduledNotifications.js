/**
 * lib/scheduledNotifications.js
 *
 * Lógica para notificaciones programadas de comprobantes pendientes.
 * Incluye: queries de datos, formateo de mensajes, validación de timing.
 */

import { supabaseAdmin } from './supabase.js';
import { sendMessage } from './whatsapp.js';

/**
 * Obtiene todas las notificaciones programadas habilitadas.
 */
export async function getEnabledSchedules() {
  const { data, error } = await supabaseAdmin
    .from('notification_schedules')
    .select('*')
    .eq('enabled', true);

  if (error) {
    console.error('[scheduled-notifications] query error:', error.message);
    throw error;
  }

  return data || [];
}

/**
 * Calcula si es tiempo de ejecutar la notificación basado en:
 * - frequency (daily | weekly)
 * - time_of_day (hora en timezone de la empresa)
 * - last_sent_at (evita envíos duplicados)
 * 
 * @param {object} schedule - row de notification_schedules
 * @returns {boolean} true si toca ejecutar ahora
 */
export function shouldExecuteNow(schedule) {
  if (!schedule.enabled) return false;

  const now = new Date();
  const colombiaOffset = -5 * 60; // UTC-5
  const nowColombia = new Date(now.getTime() + colombiaOffset * 60 * 1000);

  const currentHour = nowColombia.getHours();
  const currentMinute = nowColombia.getMinutes();
  const currentDayOfWeek = nowColombia.getDay(); // 0=Sunday, 1=Monday, ...6=Saturday

  // Parsear time_of_day (ej: "09:00:00")
  const [scheduleHour, scheduleMinute] = schedule.time_of_day.split(':').map(Number);

  // Tolerancia: ±5 minutos
  const hourMatch = currentHour === scheduleHour;
  const minuteInRange = Math.abs(currentMinute - scheduleMinute) <= 5;

  if (!hourMatch || !minuteInRange) return false;

  // Validar frequency
  if (schedule.frequency === 'daily') {
    // Verificar que no se envió hoy
    if (schedule.last_sent_at) {
      const lastSentDate = new Date(schedule.last_sent_at);
      const lastSentColombia = new Date(lastSentDate.getTime() + colombiaOffset * 60 * 1000);
      const sameDay = 
        lastSentColombia.getFullYear() === nowColombia.getFullYear() &&
        lastSentColombia.getMonth() === nowColombia.getMonth() &&
        lastSentColombia.getDate() === nowColombia.getDate();
      
      if (sameDay) return false; // Ya se envió hoy
    }
    return true;
  }

  if (schedule.frequency === 'weekly') {
    // schedule.day_of_week: 0=Monday, 1=Tuesday, ..., 6=Sunday
    // currentDayOfWeek: 0=Sunday, 1=Monday, ..., 6=Saturday
    // Convertir para que coincidan
    const adjustedDayOfWeek = currentDayOfWeek === 0 ? 6 : currentDayOfWeek - 1;

    if (adjustedDayOfWeek !== schedule.day_of_week) return false;

    // Verificar que no se envió esta semana
    if (schedule.last_sent_at) {
      const lastSentDate = new Date(schedule.last_sent_at);
      const lastSentColombia = new Date(lastSentDate.getTime() + colombiaOffset * 60 * 1000);
      
      // Calcular semana de last_sent vs ahora
      const getWeekNumber = (date) => {
        const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
        const dayNum = d.getUTCDay() || 7;
        d.setUTCDate(d.getUTCDate() + 4 - dayNum);
        const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
        return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
      };

      const thisWeek = getWeekNumber(nowColombia);
      const lastWeek = getWeekNumber(lastSentColombia);

      if (thisWeek === lastWeek) return false; // Ya se envió esta semana
    }

    return true;
  }

  return false;
}

/**
 * Obtiene comprobantes pendientes agrupados por sede.
 * 
 * @param {string} companyId - UUID de la empresa
 * @param {UUID[]} locationIds - IDs de sedes a incluir (null = todas)
 * @returns {Promise<Array>} Array de { location_id, location_name, pending_count, total_amount, employee_names }
 */
export async function getLocationPendingVerifications(companyId, locationIds = null) {
  let query = supabaseAdmin
    .from('verifications')
    .select(`
      id,
      extracted_amount,
      employee_id,
      employees:employee_id(
        name,
        location_id,
        company_locations:location_id(
          id,
          name
        )
      )
    `)
    .eq('company_id', companyId)
    .eq('status', 'pending')
    .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());

  const { data: verifications, error } = await query;

  if (error) {
    console.error('[scheduled-notifications] query error:', error.message);
    throw error;
  }

  // Agrupar por sede
  const locationMap = {};

  for (const v of verifications || []) {
    if (!v.employees) continue;

    const locationId = v.employees.location_id || 'sin-sede';
    const locationName = v.employees.company_locations?.name || 'Sin Sede';

    if (!locationMap[locationId]) {
      locationMap[locationId] = {
        location_id: locationId,
        location_name: locationName,
        pending_count: 0,
        total_amount: 0,
        employees: new Set()
      };
    }

    locationMap[locationId].pending_count += 1;
    locationMap[locationId].total_amount += v.extracted_amount || 0;
    if (v.employees.name) {
      locationMap[locationId].employees.add(v.employees.name);
    }
  }

  // Filtrar por locationIds si se especificaron
  let result = Object.values(locationMap);
  if (locationIds && locationIds.length > 0) {
    result = result.filter(loc => locationIds.includes(loc.location_id));
  }

  // Convertir Set a string
  result = result.map(loc => ({
    ...loc,
    employee_names: Array.from(loc.employees).join(', ')
  }));

  // Ordenar por cantidad de pendientes (descendente)
  result.sort((a, b) => b.pending_count - a.pending_count);

  return result;
}

/**
 * Formatea un mensaje WhatsApp con el resumen de comprobantes pendientes.
 * 
 * @param {Array} locationStats - Array de { location_name, pending_count, total_amount, employee_names }
 * @returns {string} Mensaje WhatsApp formateado
 */
export function formatNotificationMessage(locationStats) {
  const now = new Date();
  const dateStr = now.toLocaleDateString('es-CO', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  const timeStr = now.toLocaleTimeString('es-CO', {
    hour: '2-digit',
    minute: '2-digit'
  });

  let message = `📋 *Resumen Diario - Comprobantes Pendientes*\n`;
  message += `📅 ${dateStr} | ${timeStr}\n\n`;

  let totalPending = 0;
  let totalAmount = 0;

  for (const stat of locationStats) {
    totalPending += stat.pending_count;
    totalAmount += stat.total_amount;

    const pendingEmoji = stat.pending_count > 0 ? '⚠️' : '✅';
    message += `${pendingEmoji} *${stat.location_name}*\n`;
    message += `  ✍️ Pendientes: ${stat.pending_count}\n`;
    message += `  💰 Monto Total: $${Number(stat.total_amount).toLocaleString('es-CO')}\n`;

    if (stat.employee_names) {
      message += `  👥 Empleados: ${stat.employee_names}\n`;
    }

    message += `\n`;
  }

  // Resumen total
  message += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
  message += `📊 *TOTAL EMPRESA: ${totalPending} pendientes*\n`;
  message += `💵 Monto Total: $${Number(totalAmount).toLocaleString('es-CO')}\n\n`;

  message += `⏱️ *Próxima notificación:* Mañana a las 9:00 AM\n`;
  message += `🔗 Ir al Dashboard: https://chat-pay.app/admin`;

  return message;
}

/**
 * Procesa una notificación programada: obtiene datos, formatea y envía.
 * 
 * @param {object} schedule - row de notification_schedules
 * @returns {Promise<object>} { sent: true/false, message_id?: string, error?: string }
 */
export async function executeScheduledNotification(schedule) {
  try {
    console.log(`[scheduled-notifications] executing schedule ${schedule.id} for company ${schedule.company_id}`);

    // Obtener comprobantes pendientes por sede
    const locationStats = await getLocationPendingVerifications(
      schedule.company_id,
      schedule.include_all_locations ? null : schedule.location_ids
    );

    // Si no hay comprobantes pendientes, aún así enviar (indicando 0)
    // Cambiar esto si preferimos no enviar cuando no hay nada
    if (locationStats.length === 0) {
      console.log(`[scheduled-notifications] no pending verifications for company ${schedule.company_id}`);
      // Opción 1: No enviar si no hay nada
      // return { sent: false, reason: 'no_pending_verifications' };
      
      // Opción 2: Enviar igual diciendo que todo está ok
      // Continuamos...
    }

    // Formatear mensaje
    const message = formatNotificationMessage(locationStats);

    // Enviar por WhatsApp
    console.log(`[scheduled-notifications] sending to ${schedule.recipient_phone}`);
    const result = await sendMessage(
      schedule.recipient_phone,
      message,
      {
        companyId: schedule.company_id,
        messageType: 'scheduled_notification'
      }
    );

    // Actualizar last_sent_at
    const { error: updateErr } = await supabaseAdmin
      .from('notification_schedules')
      .update({ last_sent_at: new Date().toISOString() })
      .eq('id', schedule.id);

    if (updateErr) {
      console.error(`[scheduled-notifications] error updating last_sent_at:`, updateErr.message);
    }

    console.log(`[scheduled-notifications] notification sent OK for company ${schedule.company_id}`);
    return {
      sent: true,
      schedule_id: schedule.id,
      message_id: result?.messages?.[0]?.id
    };
  } catch (error) {
    console.error(`[scheduled-notifications] error executing schedule ${schedule.id}:`, error.message);
    return {
      sent: false,
      schedule_id: schedule.id,
      error: error.message
    };
  }
}

/**
 * Ejecuta el batch completo de notificaciones programadas.
 * Llamada por el cron job cada hora.
 * 
 * @returns {Promise<object>} { processed: number, sent: number, failed: number }
 */
export async function processScheduledNotifications() {
  console.log('[scheduled-notifications] processing batch');

  const schedules = await getEnabledSchedules();
  console.log(`[scheduled-notifications] found ${schedules.length} enabled schedules`);

  let sent = 0;
  let failed = 0;

  for (const schedule of schedules) {
    // Validar timing
    if (!shouldExecuteNow(schedule)) {
      console.log(`[scheduled-notifications] skipping schedule ${schedule.id} (not time yet)`);
      continue;
    }

    // Ejecutar notificación
    const result = await executeScheduledNotification(schedule);
    if (result.sent) {
      sent += 1;
    } else {
      failed += 1;
    }
  }

  console.log(`[scheduled-notifications] batch complete: sent=${sent}, failed=${failed}`);
  return {
    processed: schedules.length,
    sent,
    failed
  };
}
