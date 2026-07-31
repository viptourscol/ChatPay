import { supabaseAdmin } from './supabase.js';
import { buildResponseMessage, matchTransaction } from './matcher.js';

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
    .select('id, company_id, transaction_id, status, extracted_amount, extracted_reference, extracted_date, extracted_sender, response_text, notes')
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

    const responseText = buildResponseMessage({
      status,
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

    if (!updateError) updated += 1;
  }

  return { checked: (pendingRows || []).length, updated };
}