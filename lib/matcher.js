import { supabaseAdmin } from './supabase.js';

// Colombia es UTC-5 → los comprobantes muestran hora local
const COLOMBIA_OFFSET_MS = 5 * 60 * 60 * 1000;

function normalize(s) {
  return s?.toLowerCase().replace(/\s+/g, ' ').trim() || '';
}

function scoreName(ocrName, emailName) {
  if (!ocrName || !emailName) return 0;
  const words = normalize(ocrName).split(' ');
  return words.filter(w => w.length > 2 && normalize(emailName).includes(w)).length;
}

/**
 * Busca una transacción PENDIENTE que coincida con los datos del comprobante.
 *
 * Estrategia:
 *   1) Match exacto por reference_number
 *   2) Fallback: amount + ventana ±1.5h (corrigiendo UTC-5 del OCR) + score por sender_name
 *   3) Si quedan múltiples sin diferencia de nombre → retorna status 'ambiguous' con candidatos
 *   4) Si no hay pending → buscar duplicado en confirmed
 */
export async function matchTransaction({ amount, reference, date, senderName, companyId }) {
  let tx = null;

  // ── 1. Match por referencia ───────────────────────────────────────────────
  if (reference) {
    let q = supabaseAdmin
      .from('transactions')
      .select('*')
      .eq('reference_number', reference)
      .eq('status', 'pending');
    if (companyId) q = q.eq('company_id', companyId);
    const { data } = await q.maybeSingle();
    if (data) tx = data;
  }

  // ── 2. Fallback por monto ─────────────────────────────────────────────────
  if (!tx && amount) {
    let q = supabaseAdmin
      .from('transactions')
      .select('*')
      .eq('amount', amount)
      .eq('status', 'pending')
      .order('transaction_date', { ascending: false });
    if (companyId) q = q.eq('company_id', companyId);
    const { data: byAmount } = await q;

    if (byAmount?.length === 1) {
      tx = byAmount[0];
    } else if (byAmount?.length > 1) {
      // Corregir timezone: OCR da hora Colombia (UTC-5) → convertir a UTC sumando 5h
      const ocrUtc = date
        ? new Date(new Date(date).getTime() + COLOMBIA_OFFSET_MS)
        : new Date();
      const lo = new Date(ocrUtc.getTime() - 90 * 60 * 1000).toISOString(); // ±1.5h
      const hi = new Date(ocrUtc.getTime() + 90 * 60 * 1000).toISOString();

      const inWindow = byAmount.filter(row =>
        row.transaction_date >= lo && row.transaction_date <= hi
      );
      const candidates = inWindow.length > 0 ? inWindow : byAmount;

      if (candidates.length === 1) {
        tx = candidates[0];
      } else {
        // Puntuar por nombre del remitente
        const scored = candidates.map(row => ({
          row,
          score: scoreName(senderName, row.sender_name)
        }));
        scored.sort((a, b) => b.score - a.score);

        const best = scored[0];
        const second = scored[1];

        if (best.score > 0 && best.score > (second?.score ?? 0)) {
          // Ganador claro por nombre
          tx = best.row;
        } else {
          // Ambigüedad real: no podemos decidir
          return { transaction: null, status: 'ambiguous', candidates };
        }
      }
    }
  } // cierre if (!tx && amount)

  // ── Si hay match pendiente → confirmar ───────────────────────────────────
  if (tx) {
    await supabaseAdmin
      .from('transactions')
      .update({ status: 'confirmed' })
      .eq('id', tx.id);
    return { transaction: tx, status: 'real' };
  }

  // ── Sin match en pending → revisar si ya fue confirmado (duplicado) ───────
  if (reference) {
    let q = supabaseAdmin
      .from('transactions')
      .select('*')
      .eq('reference_number', reference)
      .eq('status', 'confirmed');
    if (companyId) q = q.eq('company_id', companyId);
    const { data: confirmed } = await q.maybeSingle();
    if (confirmed) return { transaction: confirmed, status: 'duplicate' };
  }

  if (amount) {
    const center = date ? new Date(date) : new Date();
    const lo = new Date(center.getTime() - 3 * 60 * 60 * 1000).toISOString();
    const hi = new Date(center.getTime() + 3 * 60 * 60 * 1000).toISOString();
    let q = supabaseAdmin
      .from('transactions')
      .select('*')
      .eq('amount', amount)
      .eq('status', 'confirmed')
      .gte('transaction_date', lo)
      .lte('transaction_date', hi)
      .order('transaction_date', { ascending: false })
      .limit(1);
    if (companyId) q = q.eq('company_id', companyId);
    const { data: confirmed } = await q;
    if (confirmed?.length) return { transaction: confirmed[0], status: 'duplicate' };
  }

  // ── Sin match en ningún estado → falso ───────────────────────────────────
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
        dateStr   ? `📅 Fecha: ${dateStr}` : null,
        shortId   ? `🔖 ID: ...${shortId}` : null,
        ``,
        `Puedes entregar el producto.`
      ].filter(l => l !== null);
      return lines.join('\n');
    }
    case 'duplicate': {
      const verifiedDateStr = verifiedAt
        ? new Date(verifiedAt).toLocaleString('es-CO', { timeZone: 'America/Bogota', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
        : null;
      const lines = [
        `${hi}⚠️ Comprobante DUPLICADO`,
        ``,
        `Este comprobante *ya fue verificado anteriormente*.`,
        ``,
        `💰 Monto: ${fmt}`,
        senderName  ? `👤 Remitente: ${senderName}` : null,
        reference   ? `🔢 Referencia: ${reference}` : null,
        dateStr     ? `📅 Fecha del pago: ${dateStr}` : null,
        verifiedDateStr ? `✅ Verificado el: ${verifiedDateStr}` : null,
        verifiedByName  ? `👨‍💼 Verificado por: ${verifiedByName}` : null,
        shortId     ? `🔖 ID interno: ...${shortId}` : null,
        ``,
        `🚫 NO entregues el producto nuevamente.\nContacta al administrador si tienes dudas.`
      ].filter(l => l !== null);
      return lines.join('\n');
    }
    case 'fake':
      return `${hi}❌ Pago NO VERIFICADO\nNo encontramos una transferencia real que coincida con este comprobante.\n\nNO entregues el producto. Pide otra forma de pago o contacta al administrador.`;
    default:
      return `${hi}No pudimos procesar tu comprobante. Intenta enviar la imagen de nuevo más clara.`;
  }
}
