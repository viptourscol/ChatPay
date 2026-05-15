import Groq from 'groq-sdk';

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

const SYSTEM_PROMPT = `Eres un asistente que extrae datos de comprobantes bancarios colombianos
(Bancolombia, Nequi, Daviplata, etc.). Devuelve SOLO un JSON válido con esta forma exacta:
{
  "amount": number | null,            // monto en pesos (sin separadores ni símbolos)
  "reference": string | null,         // número de referencia/aprobación/CUS
  "date": string | null,              // fecha y hora ISO 8601 si es posible (YYYY-MM-DDTHH:mm:ss)
  "sender_name": string | null,       // nombre de quien envía
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
  const completion = await groq.chat.completions.create({
    model: 'meta-llama/llama-4-scout-17b-16e-instruct',
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

  const raw = completion.choices?.[0]?.message?.content ?? '{}';
  try {
    return JSON.parse(raw);
  } catch {
    const match = raw.match(/\{[\s\S]*\}/);
    return match ? JSON.parse(match[0]) : {};
  }
}
