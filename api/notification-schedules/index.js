/**
 * api/notification-schedules/index.js
 *
 * CRUD endpoints para notificaciones programadas.
 * Solo accesibles por admin de la empresa.
 *
 * GET  /api/notification-schedules — Listar notificaciones de la empresa
 * POST /api/notification-schedules — Crear nueva notificación programada
 * PATCH /api/notification-schedules/:id — Actualizar
 * DELETE /api/notification-schedules/:id — Eliminar
 */

import { supabaseAdmin } from '../../lib/supabase.js';
import { resolveCompanyFromHeaders } from '../../lib/getCompany.js';

export const config = { api: { bodyParser: true } };

// ─── Listar ───────────────────────────────────────────────────────────────
async function handleGet(req, res) {
  try {
    const companyId = await resolveCompanyFromHeaders(req);
    if (!companyId) return res.status(401).json({ error: 'Unauthorized' });

    const { data, error } = await supabaseAdmin
      .from('notification_schedules')
      .select('*')
      .eq('company_id', companyId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[notification-schedules] GET error:', error.message);
      return res.status(500).json({ error: error.message });
    }

    return res.status(200).json(data || []);
  } catch (err) {
    console.error('[notification-schedules] GET fatal:', err.message);
    return res.status(500).json({ error: err.message });
  }
}

// ─── Crear ────────────────────────────────────────────────────────────────
async function handlePost(req, res) {
  try {
    const companyId = await resolveCompanyFromHeaders(req);
    if (!companyId) return res.status(401).json({ error: 'Unauthorized' });

    const {
      frequency = 'daily',
      day_of_week = null,
      time_of_day = '09:00:00',
      timezone = 'America/Bogota',
      recipient_phone,
      channel = 'whatsapp',
      include_all_locations = true,
      location_ids = [],
      enabled = true
    } = req.body;

    // Validaciones
    if (!recipient_phone || recipient_phone.trim() === '') {
      return res.status(400).json({ error: 'recipient_phone is required' });
    }

    if (!['daily', 'weekly'].includes(frequency)) {
      return res.status(400).json({ error: 'frequency must be daily or weekly' });
    }

    if (frequency === 'weekly' && (day_of_week === null || day_of_week === undefined)) {
      return res.status(400).json({ error: 'day_of_week is required for weekly frequency' });
    }

    if (day_of_week !== null && (day_of_week < 0 || day_of_week > 6)) {
      return res.status(400).json({ error: 'day_of_week must be 0-6' });
    }

    // Normalizar número WhatsApp
    let normalizedPhone = recipient_phone.trim();
    if (!normalizedPhone.startsWith('+')) {
      normalizedPhone = '+' + normalizedPhone.replace(/\D/g, '');
    }

    // Crear
    const { data, error } = await supabaseAdmin
      .from('notification_schedules')
      .insert({
        company_id: companyId,
        frequency,
        day_of_week,
        time_of_day,
        timezone,
        recipient_phone: normalizedPhone,
        channel,
        include_all_locations,
        location_ids: include_all_locations ? [] : location_ids,
        enabled
      })
      .select()
      .single();

    if (error) {
      console.error('[notification-schedules] POST error:', error.message);
      return res.status(500).json({ error: error.message });
    }

    console.log(`[notification-schedules] created schedule ${data.id} for company ${companyId}`);
    return res.status(201).json(data);
  } catch (err) {
    console.error('[notification-schedules] POST fatal:', err.message);
    return res.status(500).json({ error: err.message });
  }
}

// ─── Actualizar ───────────────────────────────────────────────────────────
async function handlePatch(req, res) {
  try {
    const companyId = await resolveCompanyFromHeaders(req);
    if (!companyId) return res.status(401).json({ error: 'Unauthorized' });

    const { id } = req.query;
    if (!id) return res.status(400).json({ error: 'id is required' });

    const updates = req.body;

    // Validaciones de updates
    if (updates.frequency && !['daily', 'weekly'].includes(updates.frequency)) {
      return res.status(400).json({ error: 'frequency must be daily or weekly' });
    }

    if (updates.day_of_week !== undefined && updates.day_of_week !== null) {
      if (updates.day_of_week < 0 || updates.day_of_week > 6) {
        return res.status(400).json({ error: 'day_of_week must be 0-6' });
      }
    }

    if (updates.recipient_phone) {
      updates.recipient_phone = updates.recipient_phone.trim();
      if (!updates.recipient_phone.startsWith('+')) {
        updates.recipient_phone = '+' + updates.recipient_phone.replace(/\D/g, '');
      }
    }

    // Verificar pertenencia
    const { data: schedule, error: fetchErr } = await supabaseAdmin
      .from('notification_schedules')
      .select('company_id')
      .eq('id', id)
      .maybeSingle();

    if (fetchErr || !schedule) {
      return res.status(404).json({ error: 'Not found' });
    }

    if (schedule.company_id !== companyId) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    // Actualizar
    const { data, error } = await supabaseAdmin
      .from('notification_schedules')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('[notification-schedules] PATCH error:', error.message);
      return res.status(500).json({ error: error.message });
    }

    console.log(`[notification-schedules] updated schedule ${id}`);
    return res.status(200).json(data);
  } catch (err) {
    console.error('[notification-schedules] PATCH fatal:', err.message);
    return res.status(500).json({ error: err.message });
  }
}

// ─── Eliminar ──────────────────────────────────────────────────────────────
async function handleDelete(req, res) {
  try {
    const companyId = await resolveCompanyFromHeaders(req);
    if (!companyId) return res.status(401).json({ error: 'Unauthorized' });

    const { id } = req.query;
    if (!id) return res.status(400).json({ error: 'id is required' });

    // Verificar pertenencia
    const { data: schedule, error: fetchErr } = await supabaseAdmin
      .from('notification_schedules')
      .select('company_id')
      .eq('id', id)
      .maybeSingle();

    if (fetchErr || !schedule) {
      return res.status(404).json({ error: 'Not found' });
    }

    if (schedule.company_id !== companyId) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    // Eliminar
    const { error } = await supabaseAdmin
      .from('notification_schedules')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('[notification-schedules] DELETE error:', error.message);
      return res.status(500).json({ error: error.message });
    }

    console.log(`[notification-schedules] deleted schedule ${id}`);
    return res.status(204).end();
  } catch (err) {
    console.error('[notification-schedules] DELETE fatal:', err.message);
    return res.status(500).json({ error: err.message });
  }
}

// ─── Router ────────────────────────────────────────────────────────────────
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') return res.status(204).end();

  switch (req.method) {
    case 'GET':
      return handleGet(req, res);
    case 'POST':
      return handlePost(req, res);
    case 'PATCH':
      return handlePatch(req, res);
    case 'DELETE':
      return handleDelete(req, res);
    default:
      return res.status(405).json({ error: 'Method not allowed' });
  }
}
