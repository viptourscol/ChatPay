import { supabaseAdmin } from './supabase.js';
import { buildResponseMessage, matchTransaction } from './matcher.js';
import { sendVerificationNotification, sendMessage } from './whatsapp.js';

function appendReconciliationNote(existing, source, status) {
  const stamp = new Date().toISOString();
  const line = `[reconciled:${source}] status=${status} at ${stamp}`;
  return existing ? `${existing}\n${line}` : line;
}

export async function reconcilePendingVerifications({ companyId, source = 'system', lookbackMinutes = 30, limit = 25 } = {}) {
  if (!companyId) return { checked: 0, updated: 0 };

  const cutoff = new Date(Date.now() - lookbackMinutes * 60 * 1000).toISOString();
  console.log(`[reconcile] starting for companyId=${companyId} source=${source} cutoff=${cutoff}`);
  
  const { data: pendingRows, error } = await supabaseAdmin
    .from('verifications')
    .select('id, company_id, transaction_id, status, extracted_amount, extracted_reference, extracted_date, extracted_sender, response_text, notes, whatsapp_from, employee_id')
    .eq('company_id', companyId)
    .eq('status', 'pending')
    .gte('created_at', cutoff)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    console.error(`[reconcile] query error: ${error.message}`);
    throw error;
  }
  
  console.log(`[reconcile] found ${(pendingRows || []).length} pending verifications`);

  let updated = 0;
  for (const row of pendingRows || []) {
    const ageMs = Date.now() - new Date(row.created_at).getTime();
    const ageMin = Math.round(ageMs / 60000);
    console.log(`[reconcile] attempting row ${row.id} age=${ageMin}min amount=${row.extracted_amount} ref=${row.extracted_reference}`);
    
    const { transaction, status } = await matchTransaction({
      amount: row.extracted_amount,
      reference: row.extracted_reference,
      date: row.extracted_date,
      senderName: row.extracted_sender,
      companyId,
    });

    console.log(`[reconcile] match result: status=${status} transaction_id=${transaction?.id || 'none'}`);
    
    if (status === 'pending' || status === 'ambiguous') {
      console.log(`[reconcile] skipping unresolved status: ${status}`);
      continue;
    }

    let employeeName = 'Empleado';
    if (row.employee_id) {
      const { data: emp } = await supabaseAdmin
        .from('employees')
        .select('name')
        .eq('id', row.employee_id)
        .maybeSingle();
      if (emp?.name) employeeName = emp.name;
    }

    const responseText = buildResponseMessage({
      status,
      employeeName,
      amount: row.extracted_amount,
      reference: row.extracted_reference,
      senderName: transaction?.sender_name || row.extracted_sender,
      transactionDate: transaction?.transaction_date,
      transactionId: transaction?.id,
    });

    const patch = {
      status,
      transaction_id: transaction?.id || row.transaction_id || null,
      response_text: responseText,
      notes: appendReconciliationNote(row.notes, source, status),
    };

    const { error: updateError } = await supabaseAdmin
      .from('verifications')
      .update(patch)
      .eq('id', row.id)
      .eq('status', 'pending');

    if (!updateError) {
      updated += 1;
      console.log(`[reconcile] updated verification ${row.id} from pending to ${status}`);

      if (row.whatsapp_from) {
        console.log(`[reconcile] sending template notification to ${row.whatsapp_from}`);
        try {
          // Validar que los parámetros críticos no sean null/undefined
          const montoFormato = row.extracted_amount ? `$${Number(row.extracted_amount).toLocaleString('es-CO')}` : '$0';
          const fechaTransaccion = transaction?.transaction_date?.split('T')[0] || '';
          const referencia = row.extracted_reference || 'N/A';
          
          // Determinar razón de rechazo
          let razonRechazo = 'No se pudo verificar';
          if (status === 'duplicate') razonRechazo = 'Comprobante duplicado';
          else if (status === 'fake') razonRechazo = 'No encontramos coincidencia';
          
          await sendVerificationNotification(
            row.whatsapp_from,
            {
              status,
              nombreEmpleado: employeeName,
              montoFormato,
              nombreBanco: transaction?.banco || 'Banco',
              fechaTransaccion,
              referencia,
              razonRechazo
            },
            { companyId, verificationId: row.id, messageType: `verification_${status}` }
          );
          console.log(`[reconcile] template notification sent OK to ${row.whatsapp_from}`);
        } catch (notifErr) {
          // Si la plantilla falla, enviar fallback de texto plano
          console.error('[reconcile] template notification failed:', notifErr.message);
          try {
            const fallbackMsg = `✅ Pago Verificado\n\nHola ${employeeName},\n\nTu comprobante ha sido verificado exitosamente.\n\nMonto: $${Number(row.extracted_amount || 0).toLocaleString('es-CO')}\nReferencia: ${row.extracted_reference || 'N/A'}\nEstado: ${status === 'real' ? 'Verificado' : status === 'duplicate' ? 'Duplicado' : status === 'fake' ? 'Rechazado' : 'Verificado'}\n\nGracias por tu pago.`;
            const { sendMessage } = await import('./whatsapp.js');
            await sendMessage(row.whatsapp_from, fallbackMsg, { companyId, verificationId: row.id, messageType: `verification_${status}_fallback` });
            console.log(`[reconcile] fallback text sent OK to ${row.whatsapp_from}`);
          } catch (fallbackErr) {
            console.error('[reconcile] fallback notification also failed:', fallbackErr.message, fallbackErr.stack || '');
          }
        }
      } else {
        console.warn(`[reconcile] no whatsapp_from for verification ${row.id} - cannot notify employee`);
      }
    } else {
      console.error(`[reconcile] update failed for verification ${row.id}: ${updateError.message}`);
    }
  }

  console.log(`[reconcile] completed: checked=${(pendingRows || []).length} updated=${updated}`);
  return { checked: (pendingRows || []).length, updated };
}