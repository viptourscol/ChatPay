/**
 * api/webhook/wompi.js
 *
 * POST /api/webhook/wompi — recibe eventos de Wompi y activa suscripciones
 *
 * Wompi envía un evento "transaction.updated" cuando un pago se confirma.
 * El campo transaction.reference contiene "companyId|plan|months"
 * codificado al crear el link de pago.
 *
 * Configurar en Wompi Dashboard → Desarrolladores → Webhooks:
 *   URL: https://chat-pay-six.vercel.app/api/webhook/wompi
 *   Evento: transaction.updated
 */
import { createHmac } from 'crypto';
import { supabaseAdmin } from '../../lib/supabase.js';

const PLAN_LIMITS = {
  starter:    { max_employees: 1,         max_verifications_month: 200,     max_bank_accounts: 1 },
  business:   { max_employees: 20,        max_verifications_month: 1000,    max_bank_accounts: 3 },
  enterprise: { max_employees: 999999,    max_verifications_month: 999999,  max_bank_accounts: 999999 },
};

function verifyWompiSignature(payload, receivedChecksum, properties, eventsSecret) {
  if (!eventsSecret) return true; // Si no hay secreto configurado, omitir verificación
  const chain = properties.map(p => {
    // Navegar el payload para obtener el valor del campo
    return p.split('.').reduce((obj, key) => obj?.[key], payload);
  }).join('') + eventsSecret;
  const computed = createHmac('sha256', eventsSecret).update(chain).digest('hex');
  return computed === receivedChecksum;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const event = req.body;
  const { event: eventType, data, signature } = event || {};

  // Solo procesar transacciones aprobadas
  if (eventType !== 'transaction.updated') return res.status(200).json({ ok: true });

  const tx = data?.transaction;
  if (!tx || tx.status !== 'APPROVED') return res.status(200).json({ ok: true });

  // Verificar firma si está configurado WOMPI_EVENTS_SECRET
  const eventsSecret = process.env.WOMPI_EVENTS_SECRET;
  if (eventsSecret && signature) {
    const valid = verifyWompiSignature(
      event,
      signature.checksum,
      signature.properties,
      eventsSecret
    );
    if (!valid) {
      console.error('[wompi-webhook] Firma inválida');
      return res.status(401).json({ error: 'Firma inválida' });
    }
  }

  // Decodificar reference: "companyId|plan|months"
  const ref = tx.reference || '';
  const parts = ref.split('|');
  if (parts.length < 2) {
    console.log('[wompi-webhook] reference sin formato esperado:', ref);
    return res.status(200).json({ ok: true });
  }

  const [companyId, plan, monthsStr] = parts;
  const months = parseInt(monthsStr) || 1;
  const limits = PLAN_LIMITS[plan] || PLAN_LIMITS.starter;

  // Calcular fecha de vencimiento
  const expiresAt = new Date();
  expiresAt.setMonth(expiresAt.getMonth() + months);

  // Activar suscripción en la DB
  const { error } = await supabaseAdmin
    .from('companies')
    .update({
      plan,
      subscription_status:     'active',
      is_active:               true,
      trial_ends_at:           null,
      subscription_expires_at: expiresAt.toISOString(),
      max_employees:           limits.max_employees,
      max_verifications_month: limits.max_verifications_month,
      max_bank_accounts:       limits.max_bank_accounts,
    })
    .eq('id', companyId);

  if (error) {
    console.error('[wompi-webhook] Error actualizando empresa:', error.message);
    return res.status(500).json({ error: error.message });
  }

  console.log(`[wompi-webhook] Suscripción activada: empresa=${companyId} plan=${plan} meses=${months} vence=${expiresAt.toISOString()}`);
  return res.status(200).json({ ok: true });
}
