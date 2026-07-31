import { supabaseAdmin } from './supabase.js';
import { buildResponseMessage, matchTransaction } from './matcher.js';
import { sendVerificationNotification } from './whatsapp.js';

function appendReconciliationNote(existing, source, status) {
  const stamp = new Date().toISOString();
  const line = `[reconciled:${source}] status=${status} at ${stamp}`;
  return existing ? `${existing}\n${line}` : line;
}

export async function reconcilePendingVerifications({ companyId, source = 'system', lookbackMinutes = 10, limit = 25 } = {}) {
  if (!companyId) return { checked: 0, updated: 0 };

  const cutoff = new Date(Date.now() - lookbackMinutes * 60 * 1000).toISOString();
  const { data: pendingRows, error } = await supabaseAdmin
    .from('verifications')
    .select('id, company_id, transaction_id, status, extracted_amount, extracted_reference, extracted_date, extracted_sender, response_text, notes, whatsapp_from, employee_id')
    .eq('company_id', companyId)
    .eq('status', 'pending')
    .gte('created_at', cutoff)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) throw error;

  let updated = 0;
  for (const row of pendingRows || []) {
    const { transaction, status } = await matchTransaction({
      amount: row.extracted_amount,
      reference: row.extracted_reference,
      date: row.extracted_date,
      senderName: row.extracted_sender,
      companyId,
    });

    if (status === 'pending' || status === 'ambiguous') continue;

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

      if (row.whatsapp_from) {
        try {
          await sendVerificationNotification(
            row.whatsapp_from,
            {
              status,
              nombreEmpleado: employeeName,
              montoFormato: `$${row.extracted_amount?.toLocaleString('es-CO') || '0'}`,
              nombreBanco: transaction?.banco || 'Banco',
              fechaTransaccion: transaction?.transaction_date?.split('T')[0] || '',
              referencia: row.extracted_reference || 'N/A',
              razonRechazo: status === 'duplicate' ? 'Comprobante duplicado' : 
                           status === 'fake' ? 'No encontramos coincidencia' : 
                           'No se pudo verificar'
            },
            { companyId, messageType: `verification_${status}` }
          );
          console.log(`[reconcile] notificacion de template enviada al empleado ${row.whatsapp_from}`);
        } catch (notifErr) {
          console.error('[reconcile] error enviando notificacion WhatsApp:', notifErr.message);
        }
      }
    }
  }

  return { checked: (pendingRows || []).length, updated };
}