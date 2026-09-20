/**
 * lib/verificationExpiration.js
 *
 * Procesa tareas de expiración de comprobantes.
 * Reemplaza el cron job que ejecutaba cada minuto.
 * 
 * Lógica:
 * 1. Encuentra tareas con expiration_time <= NOW() y status='pending'
 * 2. Para cada tarea:
 *    - Re-ejecuta matchTransaction() (última oportunidad de conciliar)
 *    - Si verification.status sigue siendo 'pending' → marca como 'fake'
 *    - Envía plantilla WhatsApp 'comprobante_rechazado'
 *    - Marca tarea como 'processed'
 */

import { supabaseAdmin } from './supabase.js';
import { matchTransaction } from './matcher.js';
import { sendVerificationNotification } from './whatsapp.js';

/**
 * Obtiene todas las tareas pendientes cuya expiración ya pasó
 */
export async function getExpiredTasks() {
  const { data, error } = await supabaseAdmin
    .from('verification_expiration_tasks')
    .select(`
      id,
      verification_id,
      company_id,
      expiration_time,
      verifications:verification_id(
        id,
        company_id,
        employee_id,
        status,
        whatsapp_from,
        extracted_amount,
        extracted_reference,
        extracted_sender,
        notes,
        employees:employee_id(
          name,
          whatsapp_number
        )
      )
    `)
    .eq('status', 'pending')
    .lte('expiration_time', new Date().toISOString())
    .order('expiration_time', { ascending: true })
    .limit(100);

  if (error) {
    console.error('[verification-expiration] query error:', error.message);
    throw error;
  }

  return data || [];
}

/**
 * Procesa una sola tarea de expiración
 * Retorna { success, verification_id, task_id, status, message }
 */
export async function processExpiredTask(task) {
  const verificationId = task.verification_id;
  const taskId = task.id;
  const verification = task.verifications;

  try {
    console.log(`[verification-expiration] Processing task ${taskId} for verification ${verificationId}`);

    if (!verification) {
      console.error(`[verification-expiration] Verification ${verificationId} not found`);
      await markTaskProcessed(taskId, 'processed', 'Verification deleted');
      return { success: false, verification_id: verificationId, task_id: taskId, reason: 'verification_not_found' };
    }

    // Si verification NO está en 'pending', no hacer nada (fue conciliada por webhook)
    if (verification.status !== 'pending') {
      console.log(`[verification-expiration] Task ${taskId} skipped (verification already ${verification.status})`);
      await markTaskProcessed(taskId, 'skipped', `Verification was reconciled to ${verification.status}`);
      return { success: true, verification_id: verificationId, task_id: taskId, reason: 'already_reconciled', status: verification.status };
    }

    // ====== LÓGICA DE EXPIRACIÓN ======
    // Re-ejecutar matchTransaction UNA ÚLTIMA VEZ
    // Por si llega email/SMS en el último segundo
    console.log(`[verification-expiration] Re-matching verification ${verificationId}`);

    const matchResult = await matchTransaction({
      companyId: verification.company_id,
      amount: verification.extracted_amount,
      reference: verification.extracted_reference,
      senderName: verification.extracted_sender,
      excludeVerificationId: verificationId
    });

    // Si encontró coincidencia en el último segundo
    if (matchResult.status !== 'pending' && matchResult.status !== 'ambiguous') {
      console.log(`[verification-expiration] Found match in last second: ${matchResult.status}`);

      // Actualizar verification
      const { error: updateErr } = await supabaseAdmin
        .from('verifications')
        .update({
          status: matchResult.status,
          transaction_id: matchResult.transaction_id || null,
          response_text: matchResult.response_text || null,
          notes: `${verification.notes || ''}\n[expired:found-match-at-last-second]`
        })
        .eq('id', verificationId);

      if (updateErr) {
        console.error(`[verification-expiration] Error updating verification: ${updateErr.message}`);
        await markTaskProcessed(taskId, 'processed', `Update error: ${updateErr.message}`);
        return { success: false, verification_id: verificationId, task_id: taskId, reason: 'update_error', error: updateErr.message };
      }

      // Marcar tarea como processed
      await markTaskProcessed(taskId, 'processed', `Reconciled to ${matchResult.status}`);
      return { success: true, verification_id: verificationId, task_id: taskId, reason: 'found_match', status: matchResult.status };
    }

    // ====== NO ENCONTRÓ COINCIDENCIA → MARCAR COMO FAKE ======
    console.log(`[verification-expiration] No match found, marking as fake`);

    const { error: fakeErr } = await supabaseAdmin
      .from('verifications')
      .update({
        status: 'fake',
        notes: `${verification.notes || ''}\n[expired:2min-timeout-no-match]`
      })
      .eq('id', verificationId);

    if (fakeErr) {
      console.error(`[verification-expiration] Error marking as fake: ${fakeErr.message}`);
      await markTaskProcessed(taskId, 'processed', `Fake update error: ${fakeErr.message}`);
      return { success: false, verification_id: verificationId, task_id: taskId, reason: 'mark_fake_error' };
    }

    // ====== ENVIAR NOTIFICACIÓN AL EMPLEADO ======
    try {
      if (verification.whatsapp_from) {
        console.log(`[verification-expiration] Sending rejection notification to ${verification.whatsapp_from}`);

        const montoFormato = verification.extracted_amount
          ? `$${Number(verification.extracted_amount).toLocaleString('es-CO')}`
          : 'monto desconocido';

        await sendVerificationNotification({
          phoneNumber: verification.whatsapp_from,
          status: 'fake',
          empleado: verification.employees?.name || 'Empleado',
          montoFormato,
          referencia: verification.extracted_reference || 'N/A',
          razonRechazo: 'No se pudo confirmar con el banco después de 2 minutos'
        });

        console.log(`[verification-expiration] Notification sent for task ${taskId}`);
      }
    } catch (notifErr) {
      console.error(`[verification-expiration] Error sending notification: ${notifErr.message}`);
      // NO detener el flujo si falla la notificación, solo loguear
    }

    // Marcar tarea como processed
    await markTaskProcessed(taskId, 'processed', 'Marked as fake and notified');

    return {
      success: true,
      verification_id: verificationId,
      task_id: taskId,
      reason: 'expired_as_fake',
      status: 'fake'
    };
  } catch (error) {
    console.error(`[verification-expiration] Unexpected error processing task ${taskId}:`, error.message);

    // Intentar marcar como processed incluso si falló
    try {
      await markTaskProcessed(taskId, 'processed', `Fatal error: ${error.message}`);
    } catch (markErr) {
      console.error(`[verification-expiration] Error marking task as processed:`, markErr.message);
    }

    return {
      success: false,
      verification_id: verificationId,
      task_id: taskId,
      reason: 'unexpected_error',
      error: error.message
    };
  }
}

/**
 * Marca una tarea como procesada
 */
async function markTaskProcessed(taskId, status, message = null) {
  const update = {
    status,
    processed_at: new Date().toISOString()
  };

  if (message && status === 'processed') {
    update.error_message = message; // Usa este campo para almacenar notas/razones
  }

  const { error } = await supabaseAdmin
    .from('verification_expiration_tasks')
    .update(update)
    .eq('id', taskId);

  if (error) {
    console.error(`[verification-expiration] Error marking task ${taskId}: ${error.message}`);
    throw error;
  }
}

/**
 * Procesa TODAS las tareas expiradas
 * Llamada por el cron job diario/horario
 * 
 * Retorna: { processed: number, expired: number, skipped: number, errors: number }
 */
export async function processAllExpiredVerifications() {
  console.log('[verification-expiration] Starting batch processing');

  try {
    const tasks = await getExpiredTasks();
    console.log(`[verification-expiration] Found ${tasks.length} expired tasks to process`);

    let results = {
      processed: 0,
      expired: 0,
      skipped: 0,
      errors: 0
    };

    for (const task of tasks) {
      const result = await processExpiredTask(task);

      if (result.success) {
        if (result.reason === 'expired_as_fake') {
          results.expired += 1;
        } else if (result.reason === 'already_reconciled' || result.reason === 'found_match') {
          results.skipped += 1;
        } else {
          results.processed += 1;
        }
      } else {
        results.errors += 1;
      }
    }

    console.log(`[verification-expiration] Batch complete:`, results);
    return results;
  } catch (error) {
    console.error('[verification-expiration] Fatal error in batch processing:', error.message);
    return {
      processed: 0,
      expired: 0,
      skipped: 0,
      errors: 1
    };
  }
}
