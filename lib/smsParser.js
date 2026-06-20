/**
 * lib/smsParser.js
 *
 * Parser de SMS bancarios de Bancolombia.
 * Devuelve: { bank, amount, reference, senderName, transactionType, date }
 * o null si el texto no parece un SMS bancario válido de crédito.
 */

function parseAmount(raw) {
  if (!raw) return null;
  const str = raw.trim();
  const dotIdx  = str.lastIndexOf('.');
  const commaIdx = str.lastIndexOf(',');
  let n;
  if (dotIdx > commaIdx) {
    n = parseFloat(str.replace(/,/g, ''));
  } else if (commaIdx > dotIdx) {
    n = parseFloat(str.replace(/\./g, '').replace(',', '.'));
  } else {
    n = parseFloat(str.replace(/[.,]/g, ''));
  }
  return isNaN(n) ? null : n;
}

function parseDate(text, receivedAt) {
  // "el 25/05/2026 a las 17:13"
  const m = text.match(/el\s+(\d{1,2})\/(\d{1,2})\/(\d{4})\s+a\s+las\s+(\d{1,2}):(\d{2})/i);
  if (m) {
    const [, d, mo, y, h, min] = m;
    return new Date(`${y}-${mo.padStart(2,'0')}-${d.padStart(2,'0')}T${h.padStart(2,'0')}:${min}:00-05:00`).toISOString();
  }
  return receivedAt || new Date().toISOString();
}

/**
 * Parsea un SMS bancario de Bancolombia.
 * Formato principal (Llaves):
 *   "Bancolombia: EMPRESA, recibiste un pago de NOMBRE por $X.XX en tu cuenta *XXXX ..."
 * Formato transferencia:
 *   "Bancolombia le informa: Recibió $X de NOMBRE. Ref XXXXX"
 */
export function parseBancolombiaSmS(text, receivedAt) {
  if (!text) return null;
  const t = text.trim();
  if (!/bancolombia/i.test(t)) return null;

  // ── Ignorar SMS de salida (débitos, transferencias realizadas por el usuario) ──
  // "transferiste", "realizaste", "desde tu cuenta X a la cuenta", "pago a ", etc.
  if (/transferiste|realizaste|retir[oó]|debito|d[eé]bito|compra|pago\s+a\s+/i.test(t)) return null;
  // "desde tu cuenta XXXX a la cuenta" → transferencia saliente
  if (/desde\s+tu\s+cuenta\s+\d+\s+a\s+la\s+cuenta/i.test(t)) return null;
  // "a la llave @..." → pago a llave Bancolombia (salida)
  if (/a\s+la\s+llave\s+@/i.test(t)) return null;
  // Confirmaciones de operaciones propias: "¡Listo!", "salió bien", "Pago exitoso"
  if (/listo[!,.]|sali[oó]\s+bien|pago\s+exitoso/i.test(t)) return null;

  let amount = null, senderName = null, reference = null;

  // ── Formato Llaves: "recibiste un pago de NOMBRE por $X.XX" ──────────────
  const llavesM = t.match(/recibiste\s+un\s+pago\s+de\s+([^p]+?)\s+por\s+\$\s*([\d.,]+)/i);
  if (llavesM) {
    senderName = llavesM[1].trim();
    amount     = parseAmount(llavesM[2]);
  }

  // ── Formato clásico: "Recibió/Recibiste $X de NOMBRE" ────────────────────
  if (!amount) {
    const clasicM = t.match(/recib(?:i[oó]|iste|e)\s+(?:transferencia\s+de\s+)?(?:\$|COP\s*\$?)\s*([\d.,]+)(?:[^d]{0,40}de\s+([A-ZÁÉÍÓÚÑ][^.$\n]{3,50?}))?/i);
    if (clasicM) {
      amount     = parseAmount(clasicM[1]);
      senderName = clasicM[2]?.trim() || null;
    }
  }

  // ── Monto genérico como último recurso ────────────────────────────────────
  if (!amount) {
    const montoM = t.match(/\$\s*([\d.,]+)/);
    if (montoM) amount = parseAmount(montoM[1]);
  }

  if (!amount) return null;

  // Referencia / comprobante
  const refM = t.match(/(?:ref(?:erencia)?|comprobante|n[uú]mero|no\.?)[^\d]*([A-Z0-9]{4,})/i)
             || t.match(/\bref\s*:?\s*([A-Z0-9]{4,})/i);
  if (refM) reference = refM[1].trim();

  return {
    bank: 'Bancolombia',
    amount,
    reference,
    senderName,
    transactionType: 'credit',
    date: parseDate(t, receivedAt),
  };
}

/** Punto de entrada genérico — por ahora solo Bancolombia */
export function parseBankSms(text, receivedAt) {
  return parseBancolombiaSmS(text, receivedAt);
}
