import Groq from 'groq-sdk';

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
const OCR_PROVIDER = (process.env.OCR_PROVIDER || 'groq').toLowerCase();
const OCR_MODELS = buildOcrModels();

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
      const rawContent = await runOcrCompletion(model, imageUrl);
      console.log('[groq] raw OCR response:', rawContent);
      let parsed = parseGroqJson(rawContent);
      if (!hasUsefulFields(parsed)) {
        parsed = await coerceToReceiptJson(model, rawContent);
      }
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
  if (!raw || typeof raw !== 'string') return {};

  const withoutThinkTags = raw.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();

  try {
    return JSON.parse(withoutThinkTags);
  } catch {
    const blocks = extractJsonObjectCandidates(withoutThinkTags);
    for (let i = blocks.length - 1; i >= 0; i -= 1) {
      try {
        return JSON.parse(blocks[i]);
      } catch {
        // Try next candidate block.
      }
    }

    return {};
  }
}

function extractJsonObjectCandidates(text) {
  const candidates = [];
  let depth = 0;
  let start = -1;

  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    if (ch === '{') {
      if (depth === 0) start = i;
      depth += 1;
    } else if (ch === '}') {
      if (depth > 0) depth -= 1;
      if (depth === 0 && start >= 0) {
        candidates.push(text.slice(start, i + 1));
        start = -1;
      }
    }
  }

  return candidates;
}

function hasUsefulFields(data) {
  if (!data || typeof data !== 'object') return false;
  return [
    data.amount,
    data.reference,
    data.date,
    data.sender_name,
    data.receiver_name,
    data.bank,
    data.is_receipt
  ].some((value) => value !== null && value !== undefined && value !== '');
}

async function coerceToReceiptJson(model, rawContent) {
  try {
    const repairedRaw = await runJsonRepairCompletion(model, rawContent);
    console.log('[groq] repaired OCR response:', repairedRaw);
    return parseGroqJson(repairedRaw);
  } catch (error) {
    console.warn('[groq] JSON repair failed:', error?.message || error);
    return {};
  }
}

function buildOcrModels() {
  if (OCR_PROVIDER === 'openrouter') {
    return [
      process.env.OPENROUTER_OCR_MODEL ||
      process.env.OCR_MODEL ||
      'meta-llama/llama-4-scout-17b-16e-instruct'
    ].filter(Boolean);
  }

  return [
    process.env.GROQ_OCR_MODEL || 'qwen/qwen3.6-27b',
    process.env.GROQ_OCR_MODEL_FALLBACK
  ].filter((model, index, models) => model && models.indexOf(model) === index);
}

async function runOcrCompletion(model, imageUrl) {
  if (OCR_PROVIDER === 'openrouter') {
    const data = await runOpenRouterChatCompletion({
      model,
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
    return data?.choices?.[0]?.message?.content ?? '{}';
  }

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

  return completion.choices?.[0]?.message?.content ?? '{}';
}

async function runJsonRepairCompletion(model, rawContent) {
  const repairMessages = [
    {
      role: 'system',
      content: 'Convierte el texto dado a un JSON valido con EXACTAMENTE estas llaves: amount, reference, date, sender_name, receiver_name, bank, is_receipt. Sin explicaciones.'
    },
    {
      role: 'user',
      content: `Texto OCR:\n${rawContent}`
    }
  ];

  if (OCR_PROVIDER === 'openrouter') {
    const data = await runOpenRouterChatCompletion({
      model,
      messages: repairMessages
    });
    return data?.choices?.[0]?.message?.content ?? '{}';
  }

  const repair = await groq.chat.completions.create({
    model,
    temperature: 0,
    messages: repairMessages
  });

  return repair.choices?.[0]?.message?.content ?? '{}';
}

async function runOpenRouterChatCompletion({ model, messages }) {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    throw new Error('OPENROUTER_API_KEY is required when OCR_PROVIDER=openrouter');
  }

  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': process.env.OPENROUTER_HTTP_REFERER || 'https://chatpay.app',
      'X-Title': process.env.OPENROUTER_APP_NAME || 'ChatPay OCR'
    },
    body: JSON.stringify({
      model,
      temperature: 0,
      messages
    })
  });

  const data = await response.json();
  if (!response.ok) {
    const message = data?.error?.message || `OpenRouter HTTP ${response.status}`;
    throw new Error(message);
  }

  return data;
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
