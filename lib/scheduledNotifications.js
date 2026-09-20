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
 * - last_sent_at (evita envíos duplicados)
 * 
 * NOTA: El cron se ejecuta UNA SOLA VEZ AL DÍA a las 9 AM (14:00 UTC).
 * Por eso no importa el time_of_day; todas las notificaciones se envían a las 9 AM.
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
  const timezone = schedule.timezone || 'America/Bogota';
  
  // Obtener día de la semana en el timezone correcto
  const dayFormatter = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    weekday: 'short',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });
  const dayName = dayFormatter.format(now);
  const dayMap = { 'Mon': 0, 'Tue': 1, 'Wed': 2, 'Thu': 3, 'Fri': 4, 'Sat': 5, 'Sun': 6 };
  const currentDayOfWeek = dayMap[dayName.split(',')[0]] || 0;

  // Validar frequency
  if (schedule.frequency === 'daily') {
    // Verificar que no se envió hoy
    if (schedule.last_sent_at) {
      const lastSentDate = new Date(schedule.last_sent_at);
      
      // Comparar fechas en el timezone correcto
      const lastFormatter = new Intl.DateTimeFormat('en-US', {
        timeZone: timezone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
      });
      const lastDateStr = lastFormatter.format(lastSentDate);
      const nowDateStr = lastFormatter.format(now);
      
      if (lastDateStr === nowDateStr) {
        console.log(`[shouldExecuteNow] ${schedule.id}: DAILY - ALREADY SENT TODAY (${nowDateStr})`);
        return false;
      }
    }
    
    console.log(`[shouldExecuteNow] ${schedule.id}: DAILY - ✅ Time to send`);
    return true;
  }

  if (schedule.frequency === 'weekly') {
    // schedule.day_of_week: 0=Monday, 1=Tuesday, ..., 6=Sunday
    
    if (currentDayOfWeek !== schedule.day_of_week) {
      console.log(`[shouldExecuteNow] ${schedule.id}: WEEKLY - WRONG DAY (today=${currentDayOfWeek}, scheduled=${schedule.day_of_week})`);
      return false;
    }

    // Verificar que no se envió esta semana
    if (schedule.last_sent_at) {
      const lastSentDate = new Date(schedule.last_sent_at);
      
      // Calcular semana usando ISO week
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

      if (thisWeek === lastWeek) {
        console.log(`[shouldExecuteNow] ${schedule.id}: WEEKLY - ALREADY SENT THIS WEEK (${thisWeek})`);
        return false;
      }
    }

    console.log(`[shouldExecuteNow] ${schedule.id}: WEEKLY - ✅ Time to send (day ${currentDayOfWeek})`);
    return true;
  }

  return false;
}

/**
 * Obtiene ingresos pendientes de transacciones bancarias.
 * 
 * Retorna: [{id, amount, sender_name, transaction_date}, ...]
 * Ordenados por transaction_date (más recientes primero)
 * 
 * @param {string} companyId - UUID de la empresa
 * @returns {Promise<Array>} Array de transacciones pendientes
 */
export async function getPendingTransactions(companyId) {
  const query = supabaseAdmin
    .from('transactions')
    .select('id, amount, sender_name, transaction_date')
    .eq('company_id', companyId)
    .eq('status', 'pending')
    .gte('transaction_date', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
    .order('transaction_date', { ascending: false }); // Más recientes primero

  const { data: transactions, error } = await query;

  if (error) {
    console.error('[scheduled-notifications] query error:', error.message);
    throw error;
  }

  return transactions || [];
}

/**
 * Formatea un mensaje WhatsApp con ingresos pendientes.
 * 
 * @param {Array} transactions - Array de { id, amount, sender_name, transaction_date }
 * @returns {string} Mensaje WhatsApp formateado
 */
export function formatNotificationMessage(transactions) {
  const now = new Date();
  const dateStr = now.toLocaleDateString('es-CO', {
    timeZone: 'America/Bogota',
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  const timeStr = now.toLocaleTimeString('es-CO', {
    timeZone: 'America/Bogota',
    hour: '2-digit',
    minute: '2-digit'
  });

  let message = `💰 *Ingresos Pendientes - Resumen Diario*\n`;
  message += `📅 ${dateStr} | ${timeStr}\n\n`;

  if (transactions.length === 0) {
    message += `✅ No hay ingresos pendientes\n\n`;
    message += `⏱️ *Próxima notificación:* Mañana a las 9:00 AM\n`;
    return message;
  }

  let totalAmount = 0;

  // Mostrar cada ingreso individualmente
  for (let i = 0; i < transactions.length; i++) {
    const t = transactions[i];
    const txTime = new Date(t.transaction_date);
    const timeFormatted = txTime.toLocaleTimeString('es-CO', {
      timeZone: 'America/Bogota',
      hour: '2-digit',
      minute: '2-digit'
    });
    const dateFormatted = txTime.toLocaleDateString('es-CO', {
      timeZone: 'America/Bogota',
      month: '2-digit',
      day: '2-digit'
    });

    const amount = Number(t.amount || 0);
    totalAmount += amount;
    const sender = t.sender_name || 'Remitente desconocido';

    message += `${i + 1}. $${amount.toLocaleString('es-CO')} - ${sender}\n`;
    message += `   ⏰ ${timeFormatted} (${dateFormatted})\n\n`;
  }

  // Resumen total
  message += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
  message += `🔴 *TOTAL: ${transactions.length} ingreso${transactions.length !== 1 ? 's' : ''} pendiente${transactions.length !== 1 ? 's' : ''}*\n`;
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

    // Obtener ingresos pendientes
    const transactions = await getPendingTransactions(schedule.company_id);

    // Si no hay ingresos pendientes, aún así enviar (indicando 0)
    if (transactions.length === 0) {
      console.log(`[scheduled-notifications] no pending transactions for company ${schedule.company_id}`);
      // Opción 1: No enviar si no hay nada
      // return { sent: false, reason: 'no_pending_transactions' };
      
      // Opción 2: Enviar igual diciendo que todo está ok (continuamos...)
    }

    // Formatear mensaje
    const message = formatNotificationMessage(transactions);

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
