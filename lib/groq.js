import Groq from 'groq-sdk';

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
const OCR_MODELS = [
  process.env.GROQ_OCR_MODEL || 'qwen/qwen3.6-27b',
  process.env.GROQ_OCR_MODEL_FALLBACK
].filter((model, index, models) => model && models.indexOf(model) === index);

const SYSTEM_PROMPT = `Eres un asistente experto en OCR que extrae datos de comprobantes bancarios colombianos
(Bancolombia, Nequi, Daviplata, Davivienda, BBVA, etc.).

IMPORTANTE: Si la imagen muestra un comprobante, recibo de transferencia, captura de pantalla bancaria o cualquier 
documento que evidencie un pago o transferencia, marca is_receipt como true.

Busca especialmente:
- Montos con símbolos $ o palabras como "Monto", "Valor", "Total", "Pagado"
- Referencias con etiquetas como "Referencia", "Aprobación", "CUS", "Transacción", "No.", "#"
- Fechas y horas del pago
- Nombres de personas o empresas en campos como "De:", "Para:", "Origen:", "Destino:", "Remitente:", "Beneficiario:"
- Bancos o medios de pago mencionados

Devuelve SOLO un JSON válido con esta forma exacta:
{
  "amount": number | null,            // monto en pesos colombianos como número decimal. REGLAS: elimina puntos de miles, convierte coma decimal a punto. Ejemplos: "$5,00" → 5, "$130.000,00" → 130000, "$1.450.000" → 1450000, "$5.00" → 5, "$130,000.00" → 130000
  "reference": string | null,         // número de referencia/aprobación/CUS/transacción
  "date": string | null,              // fecha y hora ISO 8601 si es posible (YYYY-MM-DDTHH:mm:ss)
  "sender_name": string | null,       // nombre completo de quien envía (si aparece número de teléfono en vez de nombre, usa null)
  "receiver_name": string | null,     // nombre de quien recibe
  "bank": string | null,              // banco origen si aparece
  "is_receipt": boolean               // true si la imagen es realmente un comprobante de pago
}
No incluyas texto fuera del JSON. No uses bloques markdown.`;

/**
 * Extrae datos de un comprobante a partir de una imagen.
 * @param {string} imageUrl URL pública o data URL (base64) de la imagen
 * @returns {Promise<object>} datos extraídos
 */
export async function extractComprobanteData(imageUrl) {
  let lastError = null;

  for (const model of OCR_MODELS) {
    try {
      const completion = await groq.chat.completions.create({
        model,
        temperature: 0,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          {
            role: 'user',
            content: [
              { type: 'text', text: 'Extrae los datos del siguiente comprobante:' },
              { type: 'image_url', image_url: { url: imageUrl } }
            ]
          }
        ]
      });

      const rawContent = completion.choices?.[0]?.message?.content ?? '{}';
      console.log('[groq] raw OCR response:', rawContent);
      const parsed = parseGroqJson(rawContent);
      console.log('[groq] parsed:', JSON.stringify(parsed));
      const normalized = normalizeExtraction(parsed);
      console.log('[groq] normalized:', JSON.stringify(normalized));
      return normalized;
    } catch (error) {
      lastError = error;
      console.warn(`[groq] OCR falló con ${model}:`, error?.message || error);
    }
  }

  throw lastError ?? new Error('No OCR models available');
}

function parseGroqJson(raw) {
  try {
    return JSON.parse(raw);
  } catch {
    const match = raw.match(/\{[\s\S]*\}/);
    if (!match) return {};
    try {
      return JSON.parse(match[0]);
    } catch {
      return {};
    }
  }
}

function normalizeExtraction(data) {
  const extracted = data && typeof data === 'object' ? { ...data } : {};

  const hasAmount = Number.isFinite(Number(extracted.amount));
  const hasReference = typeof extracted.reference === 'string' && extracted.reference.trim().length >= 4;
  const hasBank = typeof extracted.bank === 'string' && extracted.bank.trim().length >= 3;
  const hasDate = typeof extracted.date === 'string' && extracted.date.trim().length >= 6;

  const strongReceiptSignals = hasAmount || hasReference || (hasBank && hasDate);
  extracted.is_receipt = extracted.is_receipt === true || strongReceiptSignals;

  if (!hasAmount) extracted.amount = null;
  if (!hasReference) extracted.reference = null;
  if (!hasBank) extracted.bank = null;
  if (!hasDate) extracted.date = null;

  return extracted;
}
