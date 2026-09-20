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
  if (!schedule.enabled) {
    console.log(`[shouldExecuteNow] ${schedule.id}: DISABLED`);
    return false;
  }

  const now = new Date();
  
  // Usar el timezone del schedule (por defecto America/Bogota si no está seteado)
  const timezone = schedule.timezone || 'America/Bogota';
  
  // Crear fecha en el timezone correcto usando Intl
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    weekday: 'short'
  });
  
  const parts = formatter.formatToParts(now);
  const currentHour = parseInt(parts.find(p => p.type === 'hour')?.value || '0');
  const currentMinute = parseInt(parts.find(p => p.type === 'minute')?.value || '0');
  
  // Para day of week: usar formatter separado
  const dayFormatter = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    weekday: 'short'
  });
  const dayName = dayFormatter.format(now);
  const dayMap = { 'Mon': 0, 'Tue': 1, 'Wed': 2, 'Thu': 3, 'Fri': 4, 'Sat': 5, 'Sun': 6 };
  const currentDayOfWeek = dayMap[dayName] || 0;

  // Parsear time_of_day (ej: "09:00:00")
  const [scheduleHour, scheduleMinute] = schedule.time_of_day.split(':').map(Number);

  // Tolerancia: ±59 minutos (cron se ejecuta cada hora en :00)
  // Así soporta cualquier minuto dentro de la hora (17:00, 17:01, ... 17:59)
  const hourMatch = currentHour === scheduleHour;
  const minuteInRange = Math.abs(currentMinute - scheduleMinute) <= 59;

  console.log(`[shouldExecuteNow] ${schedule.id}: now=${currentHour}:${String(currentMinute).padStart(2, '0')} (tz:${timezone}), scheduled=${scheduleHour}:${String(scheduleMinute).padStart(2, '0')}, hourMatch=${hourMatch}, minuteInRange=${minuteInRange}`);

  if (!hourMatch || !minuteInRange) {
    console.log(`[shouldExecuteNow] ${schedule.id}: TIME MISMATCH - returning false`);
    return false;
  }

  // Validar frequency
  if (schedule.frequency === 'daily') {
    // Verificar que no se envió hoy
    if (schedule.last_sent_at) {
      const lastSentDate = new Date(schedule.last_sent_at);
      
      // Convertir última fecha de envío al timezone correcto
      const lastFormatter = new Intl.DateTimeFormat('en-US', {
        timeZone: timezone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
      });
      const lastParts = lastFormatter.formatToParts(lastSentDate);
      const lastYear = parseInt(lastParts.find(p => p.type === 'year')?.value || '0');
      const lastMonth = parseInt(lastParts.find(p => p.type === 'month')?.value || '0');
      const lastDay = parseInt(lastParts.find(p => p.type === 'day')?.value || '0');
      
      // Obtener hoy en el timezone correcto
      const nowFormatter = new Intl.DateTimeFormat('en-US', {
        timeZone: timezone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
      });
      const nowParts = nowFormatter.formatToParts(now);
      const nowYear = parseInt(nowParts.find(p => p.type === 'year')?.value || '0');
      const nowMonth = parseInt(nowParts.find(p => p.type === 'month')?.value || '0');
      const nowDay = parseInt(nowParts.find(p => p.type === 'day')?.value || '0');
      
      const sameDay = lastYear === nowYear && lastMonth === nowMonth && lastDay === nowDay;
      
      console.log(`[shouldExecuteNow] ${schedule.id}: DAILY - lastSent=${lastDay}/${lastMonth}/${lastYear}, today=${nowDay}/${nowMonth}/${nowYear}, sameDay=${sameDay}`);
      
      if (sameDay) {
        console.log(`[shouldExecuteNow] ${schedule.id}: ALREADY SENT TODAY - returning false`);
        return false;
      }
    }
    console.log(`[shouldExecuteNow] ${schedule.id}: DAILY - returning TRUE (time to send)`);
    return true;
  }

  if (schedule.frequency === 'weekly') {
    // schedule.day_of_week: 0=Monday, 1=Tuesday, ..., 6=Sunday
    // currentDayOfWeek ya está en formato correcto (0=Monday)
    
    console.log(`[shouldExecuteNow] ${schedule.id}: WEEKLY - today=${currentDayOfWeek} (${dayName}), scheduled=${schedule.day_of_week}`);
    
    if (currentDayOfWeek !== schedule.day_of_week) {
      console.log(`[shouldExecuteNow] ${schedule.id}: WRONG DAY - returning false`);
      return false;
    }

    // Verificar que no se envió esta semana
    if (schedule.last_sent_at) {
      const lastSentDate = new Date(schedule.last_sent_at);
      
      // Calcular semana de last_sent vs ahora usando ISO week
      const getISOWeek = (date) => {
        const d = new Date(date);
        d.setHours(0, 0, 0, 0);
        d.setDate(d.getDate() + 4 - (d.getDay() || 7));
        const yearStart = new Date(d.getFullYear(), 0, 1);
        const weekNum = Math.ceil(((d - yearStart) / 86400000 + 1) / 7);
        return `${d.getFullYear()}-W${String(weekNum).padStart(2, '0')}`;
      };

      const thisWeek = getISOWeek(now);
      const lastWeek = getISOWeek(lastSentDate);

      console.log(`[shouldExecuteNow] ${schedule.id}: WEEKLY - thisWeek=${thisWeek}, lastSentWeek=${lastWeek}`);

      if (thisWeek === lastWeek) {
        console.log(`[shouldExecuteNow] ${schedule.id}: ALREADY SENT THIS WEEK - returning false`);
        return false;
      }
    }

    console.log(`[shouldExecuteNow] ${schedule.id}: WEEKLY - returning TRUE (time to send)`);
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
  const batchStart = new Date().toISOString();
  console.log(`[scheduled-notifications] ⏰ BATCH STARTED at ${batchStart}`);

  const schedules = await getEnabledSchedules();
  console.log(`[scheduled-notifications] Found ${schedules.length} enabled schedules`);

  let sent = 0;
  let failed = 0;
  const skipped = [];

  for (const schedule of schedules) {
    const shouldRun = shouldExecuteNow(schedule);
    
    if (!shouldRun) {
      const { time_of_day, timezone, frequency, day_of_week } = schedule;
      skipped.push({
        id: schedule.id,
        phone: schedule.recipient_phone,
        config: `${frequency.toUpperCase()} @ ${time_of_day} ${timezone}${frequency === 'weekly' ? ` (day ${day_of_week})` : ''}`,
        reason: 'Not time to execute'
      });
      console.log(`[scheduled-notifications] ⏭️  SKIP schedule ${schedule.id}: Not time yet (${frequency} @ ${time_of_day} ${timezone})`);
      continue;
    }

    console.log(`[scheduled-notifications] 🚀 EXECUTING schedule ${schedule.id} for company ${schedule.company_id}`);
    
    // Ejecutar notificación
    const result = await executeScheduledNotification(schedule);
    if (result.sent) {
      sent += 1;
      console.log(`[scheduled-notifications] ✅ SUCCESS: Message ${result.message_id} sent to ${schedule.recipient_phone}`);
    } else {
      failed += 1;
      console.log(`[scheduled-notifications] ❌ FAILED: ${result.error}`);
    }
  }

  const summary = {
    processed: schedules.length,
    sent,
    failed,
    skipped: skipped.length,
    timestamp: batchStart
  };

  console.log(`[scheduled-notifications] ✨ BATCH COMPLETE:`, JSON.stringify(summary));
  if (skipped.length > 0 && skipped.length <= 5) {
    console.log(`[scheduled-notifications] Skipped schedules:`, skipped);
  }

  return summary;
}
