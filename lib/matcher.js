import { supabaseAdmin } from './supabase.js';

/**
 * Busca una transacción PENDIENTE que coincida con los datos del comprobante.
 * Si la encuentra y es real → la confirma (status = 'confirmed').
 * Si no está en pending pero sí en confirmed → es duplicado.
 *
 * Estrategia:
 *   1) Match exacto por reference_number (solo pending)
 *   2) Fallback: amount exacto + sender_name similar + transaction_date ±3h (solo pending)
 *   3) Fallback: amount exacto + transaction_date ±3h (solo pending, sin nombre)
 *   4) Si no hay pending pero hay confirmed con misma referencia → duplicado
 */
export async function matchTransaction({ amount, reference, date, senderName }) {
  let tx = null;

  // ── Buscar en transacciones PENDIENTES ──────────────────────────────────
  if (reference) {
    const { data } = await supabaseAdmin
      .from('transactions')
      .select('*')
      .eq('reference_number', reference)
      .eq('status', 'pending')
      .maybeSingle();
    if (data) tx = data;
  }

  if (!tx && amount) {
    // Primero buscar SOLO por monto (sin filtro de fecha para evitar desfase UTC/local)
    const { data: byAmount } = await supabaseAdmin
      .from('transactions')
      .select('*')
      .eq('amount', amount)
      .eq('status', 'pending')
      .order('transaction_date', { ascending: false });

    if (byAmount?.length === 1) {
      // Solo una opción → usarla directamente
      tx = byAmount[0];
    } else if (byAmount?.length > 1) {
      // Varias con el mismo monto → afinar por fecha ±8h (cubre desfase UTC vs local)
      const center = date ? new Date(date) : new Date();
      const lo = new Date(center.getTime() - 8 * 60 * 60 * 1000).toISOString();
      const hi = new Date(center.getTime() + 8 * 60 * 60 * 1000).toISOString();
      const inWindow = byAmount.filter(row =>
        row.transaction_date >= lo && row.transaction_date <= hi
      );
      const candidates = inWindow.length > 0 ? inWindow : byAmount;

      if (candidates.length === 1) {
        tx = candidates[0];
      } else if (senderName) {
        // Intentar afinar por nombre del remitente
        const normalize = (s) => s?.toLowerCase().replace(/\s+/g, ' ').trim() || '';
        const ocr = normalize(senderName);
        const scored = candidates.map(row => {
          const emailName = normalize(row.sender_name);
          const ocrWords = ocr.split(' ');
          const matches = ocrWords.filter(w => w.length > 2 && emailName.includes(w)).length;
          return { row, matches };
        });
        scored.sort((a, b) => b.matches - a.matches);
        tx = scored[0].row; // el más reciente si hay empate
      } else {
        tx = candidates[0]; // múltiples sin nombre → el más reciente
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
    const { data: confirmed } = await supabaseAdmin
      .from('transactions')
      .select('*')
      .eq('reference_number', reference)
      .eq('status', 'confirmed')
      .maybeSingle();
    if (confirmed) return { transaction: confirmed, status: 'duplicate' };
  }

  if (amount) {
    const center = date ? new Date(date) : new Date();
    const lo = new Date(center.getTime() - 3 * 60 * 60 * 1000).toISOString();
    const hi = new Date(center.getTime() + 3 * 60 * 60 * 1000).toISOString();
    const { data: confirmed } = await supabaseAdmin
      .from('transactions')
      .select('*')
      .eq('amount', amount)
      .eq('status', 'confirmed')
      .gte('transaction_date', lo)
      .lte('transaction_date', hi)
      .order('transaction_date', { ascending: false })
      .limit(1);
    if (confirmed?.length) return { transaction: confirmed[0], status: 'duplicate' };
  }

  // ── Sin match en ningún estado → falso ───────────────────────────────────
  return { transaction: null, status: 'fake' };
}

export function buildResponseMessage({ status, employeeName, amount, reference }) {
  const fmt = amount ? `$${Number(amount).toLocaleString('es-CO')}` : '';
  const hi = employeeName ? `Hola ${employeeName}, ` : '';
  switch (status) {
    case 'real':
      return `${hi}✅ Pago VERIFICADO\nMonto: ${fmt}\nReferencia: ${reference || 'N/A'}\n\nPuedes entregar el producto.`;
    case 'duplicate':
      return `${hi}⚠️ Pago DUPLICADO\nEste comprobante (${reference || fmt}) ya fue usado antes.\n\nNO entregues el producto. Avisa al administrador.`;
    case 'fake':
      return `${hi}❌ Pago NO VERIFICADO\nNo encontramos una transferencia real que coincida con este comprobante.\n\nNO entregues el producto. Pide otra forma de pago o contacta al administrador.`;
    default:
      return `${hi}No pudimos procesar tu comprobante. Intenta enviar la imagen de nuevo más clara.`;
  }
}
