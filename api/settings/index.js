import { supabaseAdmin } from '../../lib/supabase.js';
import { requireUser } from '../../lib/auth.js';

const ADMIN_EMAILS = (process.env.ADMIN_EMAILS || '').split(',').map(e => e.trim().toLowerCase());

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(204).end();

  const user = await requireUser(req, res);
  if (!user) return;

  // Soporte de impersonación para super admin (solo lectura vía GET)
  const impersonateId = req.headers['x-impersonate-company'];
  const isAdmin = ADMIN_EMAILS.includes((user.email || '').toLowerCase());
  const impersonating = impersonateId && isAdmin;

  // GET — obtener settings de la empresa
  if (req.method === 'GET') {
    let query = supabaseAdmin.from('companies').select('*');
    if (impersonating) {
      query = query.eq('id', impersonateId);
    } else {
      query = query.eq('user_id', user.id);
    }
    const { data, error } = await query.single();

    // Si no existe, devolver vacío (se creará al guardar)
    if (error && error.code === 'PGRST116') {
      return res.json({ id: null, name: '', nit: '', tax_regime: '', address: '', phone: '' });
    }
    if (error) return res.status(500).json({ error: error.message });

    // Auto-deshabilitar números activos que excedan el límite del plan actual
    const PLAN_MAX_GET = { free: 1, basico: 0, estandar: 1, pro: 2, empresarial: 2, enterprise: 2, business: 1 };
    const maxActive = PLAN_MAX_GET[data.plan] ?? 0;
    const contacts = Array.isArray(data.notification_whatsapp) ? data.notification_whatsapp : [];
    let activeCount = 0;
    let needsUpdate = false;
    const adjusted = contacts.map(c => {
      if (c.active) {
        if (activeCount < maxActive) { activeCount++; return c; }
        needsUpdate = true;
        return { ...c, active: false };
      }
      return c;
    });
    if (needsUpdate) {
      await supabaseAdmin.from('companies').update({ notification_whatsapp: adjusted }).eq('user_id', user.id);
      data.notification_whatsapp = adjusted;
    }

    return res.json(data);
  }

  // PUT — crear o actualizar settings
  if (req.method === 'PUT') {
    const { name, nit, tax_regime, address, phone, bancolombia_email, notification_whatsapp } = req.body || {};
    // notification_whatsapp es un array jsonb; guardar [] si viene vacío/nulo
    const rawContacts = Array.isArray(notification_whatsapp) ? notification_whatsapp : [];

    // Resolver qué empresa actualizar (impersonación o propia)
    let targetId = null;
    if (impersonating) {
      // Super admin editando empresa impersonada → actualizar por ID directamente
      targetId = impersonateId;
    }

    // Obtener el plan de la empresa objetivo para calcular límite de WhatsApp
    const planQuery = targetId
      ? supabaseAdmin.from('companies').select('id, plan').eq('id', targetId).maybeSingle()
      : supabaseAdmin.from('companies').select('id, plan').eq('user_id', user.id).maybeSingle();
    const { data: planData } = await planQuery;
    const plan = planData?.plan || 'basico';
    if (!targetId) targetId = planData?.id || null;

    const PLAN_MAX = { free: 1, basico: 0, estandar: 1, pro: 2, empresarial: 2, enterprise: 2, business: 1 };
    const maxNums = PLAN_MAX[plan] ?? 0;
    const sliced = rawContacts.slice(0, Math.max(maxNums, rawContacts.length));
    let activeAllowed = maxNums;
    const notifContacts = sliced.map(c => {
      if (c.active && activeAllowed > 0) { activeAllowed--; return c; }
      if (c.active && activeAllowed <= 0) return { ...c, active: false };
      return c;
    });

    let result, error;
    if (targetId) {
      ({ data: result, error } = await supabaseAdmin
        .from('companies')
        .update({ name, nit, tax_regime, address, phone, bancolombia_email: bancolombia_email || null, notification_whatsapp: notifContacts })
        .eq('id', targetId)
        .select()
        .single());
    } else {
      ({ data: result, error } = await supabaseAdmin
        .from('companies')
        .insert({ user_id: user.id, name, nit, tax_regime, address, phone, bancolombia_email: bancolombia_email || null, notification_whatsapp: notifContacts })
        .select()
        .single());
    }

    if (error) return res.status(500).json({ error: error.message });
    return res.json(result);
  }

  res.status(405).json({ error: 'Método no permitido' });
}
