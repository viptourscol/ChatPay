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
    const planLimits = { enterprise: 5, business: 2 };
    const maxActive = planLimits[data.plan] ?? 0;
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

    // Límite de números de notificación según plan
    const { data: planData } = await supabaseAdmin.from('companies').select('plan').eq('user_id', user.id).maybeSingle();
    const plan = planData?.plan || 'starter';
    const maxNums = plan === 'enterprise' ? 5 : plan === 'business' ? 2 : 0;
    // Respetar todos los números (incluso deshabilitados) pero limitar los activos al máximo del plan
    const sliced = rawContacts.slice(0, Math.max(maxNums, rawContacts.length)); // conservar todos los números
    let activeAllowed = maxNums;
    const notifContacts = sliced.map(c => {
      if (c.active && activeAllowed > 0) { activeAllowed--; return c; }
      if (c.active && activeAllowed <= 0) return { ...c, active: false };
      return c;
    });

    const { data: existing } = await supabaseAdmin
      .from('companies')
      .select('id')
      .eq('user_id', user.id)
      .single();

    let result, error;
    if (existing?.id) {
      ({ data: result, error } = await supabaseAdmin
        .from('companies')
        .update({ name, nit, tax_regime, address, phone, bancolombia_email: bancolombia_email || null, notification_whatsapp: notifContacts })
        .eq('user_id', user.id)
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
