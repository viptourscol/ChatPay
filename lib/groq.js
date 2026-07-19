import Groq from 'groq-sdk';

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
const OCR_MODELS = [
  process.env.GROQ_OCR_MODEL || 'qwen/qwen3.6-27b',
  process.env.GROQ_OCR_MODEL_FALLBACK
].filter((model, index, models) => model && models.indexOf(model) === index);

const SYSTEM_PROMPT = `Eres un asistente que extrae datos de comprobantes bancarios colombianos
(Bancolombia, Nequi, Daviplata, etc.). Devuelve SOLO un JSON válido con esta forma exacta:
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
        response_format: { type: 'json_object' },
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

      return parseGroqJson(completion.choices?.[0]?.message?.content ?? '{}');
    } catch (error) {
      if (isJsonValidateFailed(error)) {
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

          return parseGroqJson(completion.choices?.[0]?.message?.content ?? '{}');
        } catch (retryError) {
          lastError = retryError;
          console.warn(`[groq] OCR reintento sin JSON mode falló con ${model}:`, retryError?.message || retryError);
          continue;
        }
      }

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
    return match ? JSON.parse(match[0]) : {};
  }
}

function isJsonValidateFailed(error) {
  const code =
    error?.code ||
    error?.error?.code ||
    error?.error?.error?.code;

  return code === 'json_validate_failed';
}
