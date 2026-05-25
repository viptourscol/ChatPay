/**
 * lib/smsParser.js
 *
 * Parser de SMS bancarios de Bancolombia.
 * Los SMS son más cortos que los emails y tienen formatos distintos.
 *
 * Devuelve: { bank, amount, reference, senderName, transactionType, date }
 * o null si el texto no parece un SMS bancario válido.
 */

// Formatos conocidos de SMS de Bancolombia (Colombia)
// "Bancolombia le informa: Recibió $250.000,00 de JUAN GARCIA. Ref 123456. ..."
// "Bancolombia: Recibiste transferencia de $100.000 de PEDRO RAMIREZ. Comprobante 789012"
// "Bc: Recibio $50,000. MARIA LOPEZ. Ref:654321"
// "Bancolombia: pago recibido $500.000 Ref No 111222 de EMPRESA ABC"

const BANCOLOMBIA_PATTERNS = [
  // Patrón 1: "Recibió / Recibiste $XXX de NOMBRE. Ref XXXXXX"
  {
    re: /recib(?:i[oó]|iste|e)\s+(?:transferencia\s+de\s+)?(?:\$|COP\s*\$?)\s*([\d.,]+)(?:[^d]{0,40}de\s+([A-ZÁÉÍÓÚÑ][^.$\n]+?))?(?:[.\s]+(?:ref(?:erencia)?|comprobante|n[oú]mero)[^\d]*([A-Z0-9\-]+))?/i,
    type: 'credit'
  },
  // Patrón 2: "pago recibido $XXX Ref No XXXXXX de NOMBRE"
  {
    re: /pago\s+recibido\s+(?:\$|COP\s*\$?)\s*([\d.,]+)[^R]*(?:ref(?:erencia)?\s+no\.?\s*([A-Z0-9\-]+))[^d]*(?:de\s+([A-ZÁÉÍÓÚÑ][^.$\n]+?))?(?:\.|$)/i,
    type: 'credit',
    swapRefSender: true
  },
  // Patrón 3: genérico — captura monto y referencia sin importar orden
  {
    re: /(?:\$|COP\s*\$?)\s*([\d.,]+)/i,
    type: 'credit'
  }
];

function parseAmount(raw) {
  if (!raw) return null;
  const str = raw.trim();
  const dotIdx = str.lastIndexOf('.');
  const commaIdx = str.lastIndexOf(',');
  let n;
  if (dotIdx > commaIdx) {
    // 250,000.00 → US format
    n = parseFloat(str.replace(/,/g, ''));
  } else if (commaIdx > dotIdx) {
    // 250.000,00 → Colombian format
    n = parseFloat(str.replace(/\./g, '').replace(',', '.'));
  } else {
    n = parseFloat(str.replace(/[.,]/g, ''));
  }
  return isNaN(n) ? null : n;
}

function extractReference(text) {
  const m =
    text.match(/(?:ref(?:erencia)?|comprobante|n[uú]mero|no\.?)[^\d]*([A-Z0-9]{4,})/i) ||
    text.match(/\bref\s*:?\s*([A-Z0-9]{4,})/i);
  return m ? m[1].trim() : null;
}

function extractSender(text) {
  const m =
    text.match(/de\s+([A-ZÁÉÍÓÚÑ][A-ZÁÉÍÓÚÑa-záéíóúñ\s]{3,40}?)(?:\s*\.|$|\s+ref|\s+comp|\s+en\s)/i);
  return m ? m[1].trim() : null;
}

/**
 * Parsea un SMS bancario de Bancolombia.
 * @param {string} text  — texto crudo del SMS
 * @param {string} [receivedAt] — ISO timestamp de cuando llegó el SMS
 * @returns {{ bank, amount, reference, senderName, transactionType, date } | null}
 */
export function parseBancolombiaSmS(text, receivedAt) {
  if (!text) return null;
  const t = text.trim();

  // Verificar que sea de Bancolombia
  const isBancolombia = /bancolombia|bc:/i.test(t);
  if (!isBancolombia) return null;

  // Detectar débito (ignorar — no es un pago recibido)
  const isDebit = /transferiste|enviaste|pagaste|d[eé]bito|realizaste|retiro/i.test(t);
  if (isDebit) return null;

  const amount = (() => {
    const m = t.match(/(?:\$|COP\s*\$?)\s*([\d.,]+)/i);
    return m ? parseAmount(m[1]) : null;
  })();

  if (!amount) return null;

  const reference = extractReference(t);
  const senderName = extractSender(t);

  return {
    bank: 'Bancolombia',
    amount,
    reference,
    senderName,
    transactionType: 'credit',
    date: receivedAt ? new Date(receivedAt).toISOString() : new Date().toISOString()
  };
}

/**
 * Parsea cualquier SMS bancario (entry point principal).
 * Actualmente solo Bancolombia; preparado para agregar más bancos.
 */
export function parseBankSms(text, receivedAt) {
  return parseBancolombiaSmS(text, receivedAt);
}
