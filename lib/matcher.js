import { supabaseAdmin } from './supabase.js';

// Colombia es UTC-5 -> los comprobantes muestran hora local
const COLOMBIA_OFFSET_MS = 5 * 60 * 60 * 1000;
const UPSTREAM_WAIT_WINDOW_MS = 5 * 60 * 1000;

function normalize(s) {
  return s?.toLowerCase().replace(/\s+/g, ' ').trim() || '';
}

function scoreName(ocrName, emailName) {
  if (!ocrName || !emailName) return 0;
  const words = normalize(ocrName).split(' ');
  return words.filter(w => w.length > 2 && normalize(emailName).includes(w)).length;
}

function roundMoney(value) {
  return Math.round(Number(value) * 100) / 100;
}

function inferAmountWithoutFourPerThousand(grossAmount) {
  const gross = Number(grossAmount);
  if (!Number.isFinite(gross) || gross <= 0) return null;

  const net = roundMoney(gross / 1.004);
  const tax = roundMoney(gross - net);
  const ratio = net > 0 ? tax / net : 0;

  if (tax < 50 || ratio < 0.0035 || ratio > 0.0045) return null;
  return net;
}

function getAmountCandidates(amount) {
  const normalized = roundMoney(amount);
  if (!Number.isFinite(normalized) || normalized <= 0) return [];

  const candidates = [normalized];
  const net = inferAmountWithoutFourPerThousand(normalized);
  if (net !== null && Math.abs(net - normalized) >= 0.01) {
    candidates.push(net);
  }

  return [...new Set(candidates.map(roundMoney))];
}

function amountMatches(candidates, value) {
  const numericValue = roundMoney(value);
  return candidates.some(candidate => Math.abs(candidate - numericValue) < 0.01);
}

function getReceiptUtc(date) {
  if (!date) return new Date();
  const parsed = new Date(date);
  if (Number.isNaN(parsed.getTime())) return new Date();
  return new Date(parsed.getTime() + COLOMBIA_OFFSET_MS);
}

function shouldWaitForUpstream({ amountCandidates, date, reference }) {
  if (!amountCandidates.length) return false;
  if (!reference && !date) return true;
  const receiptUtc = getReceiptUtc(date);
  return Math.abs(Date.now() - receiptUtc.getTime()) <= UPSTREAM_WAIT_WINDOW_MS;
}

/**
 * Busca una transaccion que coincida con los datos del comprobante.
 *
 * Estados:
 * - real: encontro y confirmo una transaccion pendiente
 * - duplicate: encontro una transaccion ya confirmada
 * - ambiguous: hay multiples candidatas y se requiere desambiguacion
 * - pending: el comprobante parece valido, pero aun esperamos email/SMS
 * - fake: no hay evidencia suficiente incluso tras esperar upstream
 */
export async function matchTransaction({ amount, reference, date, senderName, companyId }) {
  let tx = null;
  const amountCandidates = getAmountCandidates(amount);
  const shouldWait = shouldWaitForUpstream({ amountCandidates, date, reference });

  if (reference) {
    let qConfirmed = supabaseAdmin
      .from('transactions')
      .select('*')
      .eq('reference_number', reference)
      .eq('status', 'confirmed');
    if (companyId) qConfirmed = qConfirmed.eq('company_id', companyId);
    const { data: alreadyConfirmed } = await qConfirmed.maybeSingle();
    if (alreadyConfirmed) {
      if (amountCandidates.length && !amountMatches(amountCandidates, alreadyConfirmed.amount)) {
        if (shouldWait) return { transaction: alreadyConfirmed, status: 'pending' };
        return { transaction: alreadyConfirmed, status: 'fake' };
      }
      return { transaction: alreadyConfirmed, status: 'duplicate' };
    }
  }

  if (reference) {
    let qPending = supabaseAdmin
      .from('transactions')
      .select('*')
      .eq('reference_number', reference)
      .eq('status', 'pending');
    if (companyId) qPending = qPending.eq('company_id', companyId);
    const { data } = await qPending.maybeSingle();
    if (data) tx = data;
  }

  if (!tx && amountCandidates.length) {
    let qByAmount = supabaseAdmin
      .from('transactions')
      .select('*')
      .in('amount', amountCandidates)
      .eq('status', 'pending')
      .order('transaction_date', { ascending: false });
    if (companyId) qByAmount = qByAmount.eq('company_id', companyId);
    const { data: byAmount } = await qByAmount;

    if (byAmount?.length === 1) {
      tx = byAmount[0];
    } else if (byAmount?.length > 1) {
      const receiptUtc = getReceiptUtc(date);
      let candidates = null;

      for (const mins of [10, 30, 90]) {
        const lo = new Date(receiptUtc.getTime() - mins * 60 * 1000).toISOString();
        const hi = new Date(receiptUtc.getTime() + mins * 60 * 1000).toISOString();
        const inWindow = byAmount.filter(row => row.transaction_date >= lo && row.transaction_date <= hi);
        if (inWindow.length === 1) {
          tx = inWindow[0];
          break;
        }
        if (inWindow.length > 0 && candidates === null) candidates = inWindow;
      }

      if (!tx) candidates = candidates ?? byAmount;

      if (!tx && candidates.length === 1) {
        tx = candidates[0];
      } else if (!tx) {
        const scored = candidates.map(row => ({ row, score: scoreName(senderName, row.sender_name) }));
        scored.sort((a, b) => b.score - a.score);

        const best = scored[0];
        const second = scored[1];
        if (best.score > 0 && best.score > (second?.score ?? 0)) {
          tx = best.row;
        } else {
          const smsTx = candidates.find(row => row.source === 'sms');
          if (smsTx) {
            tx = smsTx;
          } else {
            const lo24 = new Date(receiptUtc.getTime() - 24 * 60 * 60 * 1000).toISOString();
            const hi24 = new Date(receiptUtc.getTime() + 24 * 60 * 60 * 1000).toISOString();
            let qDup = supabaseAdmin
              .from('transactions')
              .select('*')
              .in('amount', amountCandidates)
              .eq('status', 'confirmed')
              .gte('transaction_date', lo24)
              .lte('transaction_date', hi24)
              .order('transaction_date', { ascending: false })
              .limit(1);
            if (companyId) qDup = qDup.eq('company_id', companyId);
            const { data: recentConfirmed } = await qDup;
            if (recentConfirmed?.length) {
              return { transaction: recentConfirmed[0], status: 'duplicate' };
            }

            return shouldWait
              ? { transaction: null, status: 'pending' }
              : { transaction: null, status: 'ambiguous', candidates };
          }
        }
      }
    }
  }

  if (tx) {
    const updateFields = { status: 'confirmed' };
    if (reference && !tx.reference_number) updateFields.reference_number = reference;
    await supabaseAdmin.from('transactions').update(updateFields).eq('id', tx.id);
    return { transaction: tx, status: 'real' };
  }

  if (reference) {
    let qConfirmedByRef = supabaseAdmin
      .from('transactions')
      .select('*')
      .eq('reference_number', reference)
      .eq('status', 'confirmed');
    if (companyId) qConfirmedByRef = qConfirmedByRef.eq('company_id', companyId);
    const { data: confirmed } = await qConfirmedByRef.maybeSingle();
    if (confirmed) {
      if (amountCandidates.length && !amountMatches(amountCandidates, confirmed.amount)) {
        if (shouldWait) return { transaction: confirmed, status: 'pending' };
        return { transaction: confirmed, status: 'fake' };
      }
      return { transaction: confirmed, status: 'duplicate' };
    }
  }

  if (amountCandidates.length) {
    const center = date ? new Date(date) : new Date();
    const lo = new Date(center.getTime() - 72 * 60 * 60 * 1000).toISOString();
    const hi = new Date(center.getTime() + 72 * 60 * 60 * 1000).toISOString();
    let qConfirmedByAmount = supabaseAdmin
      .from('transactions')
      .select('*')
      .in('amount', amountCandidates)
      .eq('status', 'confirmed')
      .gte('transaction_date', lo)
      .lte('transaction_date', hi)
      .order('transaction_date', { ascending: false })
      .limit(5);
    if (companyId) qConfirmedByAmount = qConfirmedByAmount.eq('company_id', companyId);
    const { data: confirmed } = await qConfirmedByAmount;
    if (confirmed?.length) {
      if (reference) {
        const exact = confirmed.find(c => c.reference_number === reference);
        if (exact) return { transaction: exact, status: 'duplicate' };
      } else {
        const sameDay = confirmed.find(c => Math.abs(new Date(c.transaction_date) - center) < 3 * 60 * 60 * 1000);
        if (sameDay) return { transaction: sameDay, status: 'duplicate' };
      }
    }
  }

  if (amountCandidates.length) {
    const center = getReceiptUtc(date);
    const lo = new Date(center.getTime() - 90 * 60 * 1000).toISOString();
    const hi = new Date(center.getTime() + 90 * 60 * 1000).toISOString();
    let qSms = supabaseAdmin
      .from('transaction_sms')
      .select('*')
      .in('amount', amountCandidates)
      .gte('received_at', lo)
      .lte('received_at', hi)
      .order('received_at', { ascending: false })
      .limit(1);
    if (companyId) qSms = qSms.eq('company_id', companyId);
    const { data: smsRows } = await qSms;
    if (smsRows?.length) {
      const sms = smsRows[0];
      const { data: newTx } = await supabaseAdmin
        .from('transactions')
        .insert({
          company_id: companyId,
          amount: sms.amount,
          reference_number: sms.reference || null,
          sender_name: sms.sender_name || senderName || null,
          transaction_date: sms.received_at,
          raw_subject: `SMS ${sms.bank || 'Bancolombia'}`,
          raw_snippet: sms.raw_text?.slice(0, 200),
          status: 'confirmed',
          source: 'sms'
        })
        .select('*')
        .single();
      if (newTx) {
        await supabaseAdmin.from('transaction_sms').update({ transaction_id: newTx.id, status: 'linked' }).eq('id', sms.id);
        return { transaction: newTx, status: 'real' };
      }
    }
  }

  if (shouldWait) {
    return { transaction: null, status: 'pending' };
  }

  return { transaction: null, status: 'fake' };
}

export function buildResponseMessage({ status, employeeName, amount, reference, senderName, transactionDate, transactionId, verifiedAt, verifiedByName }) {
  const fmt = amount ? `$${Number(amount).toLocaleString('es-CO')}` : '';
  const hi = employeeName ? `Hola ${employeeName}, ` : '';
  const shortId = transactionId ? transactionId.slice(-12) : null;
  const dateStr = transactionDate
    ? new Date(transactionDate).toLocaleString('es-CO', { timeZone: 'America/Bogota', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
    : null;

  switch (status) {
    case 'real': {
      const lines = [
        `${hi}✅ Pago VERIFICADO`,
        `💰 Monto: ${fmt}`,
        senderName ? `👤 De: ${senderName}` : null,
        dateStr ? `📅 Fecha: ${dateStr}` : null,
        shortId ? `🔖 ID: ...${shortId}` : null,
        '',
        'Puedes entregar el producto.'
      ].filter(l => l !== null);
      return lines.join('\n');
    }
    case 'duplicate': {
      const verifiedDateStr = verifiedAt
        ? new Date(verifiedAt).toLocaleString('es-CO', { timeZone: 'America/Bogota', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
        : null;
      const lines = [
        `${hi}⚠️ Comprobante DUPLICADO`,
        '',
        'Este comprobante *ya fue verificado anteriormente*.',
        '',
        `💰 Monto: ${fmt}`,
        senderName ? `👤 Remitente: ${senderName}` : null,
        reference ? `🔢 Referencia: ${reference}` : null,
        dateStr ? `📅 Fecha del pago: ${dateStr}` : null,
        verifiedDateStr ? `✅ Verificado el: ${verifiedDateStr}` : null,
        verifiedByName ? `👨‍💼 Verificado por: ${verifiedByName}` : null,
        shortId ? `🔖 ID interno: ...${shortId}` : null,
        '',
        '🚫 NO entregues el producto nuevamente.\nContacta al administrador si tienes dudas.'
      ].filter(l => l !== null);
      return lines.join('\n');
    }
    case 'pending':
      return `${hi}⏳ Estamos esperando la confirmacion bancaria.\nTu comprobante se ve valido, pero la notificacion del banco todavia no llega a ChatPay.\n\nReintenta en unos segundos o espera la confirmacion automatica.`;
    case 'fake':
      return `${hi}❌ Pago NO VERIFICADO\nNo encontramos una transferencia real que coincida con este comprobante.\n\nNO entregues el producto. Pide otra forma de pago o contacta al administrador.`;
    default:
      return `${hi}No pudimos procesar tu comprobante. Intenta enviar la imagen de nuevo mas clara.`;
  }
}
