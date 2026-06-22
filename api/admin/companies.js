import { supabaseAdmin } from '../../lib/supabase.js';
import { requireUser } from '../../lib/auth.js';

const ADMIN_EMAILS = (process.env.ADMIN_EMAILS || '').split(',').map(e => e.trim().toLowerCase());

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(204).end();

  const user = await requireUser(req, res);
  if (!user) return;

  // Verificar que el usuario es admin
  if (!ADMIN_EMAILS.includes(user.email?.toLowerCase())) {
    return res.status(403).json({ error: 'Acceso restringido.' });
  }

  // Subrutas: ?action=user-info&companyId=...
  if (req.query.action === 'user-info') {
    return userInfoHandler(req, res, user);
  }

  // Subrutas: ?action=message-logs
  if (req.query.action === 'message-logs') {
    const { companyId, status, type, page = '1' } = req.query;
    const pageSize = 50;
    const offset = (parseInt(page) - 1) * pageSize;
    const cutoff = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();

    let q = supabaseAdmin
      .from('whatsapp_logs')
      .select('*, companies(name)', { count: 'exact' })
      .gte('sent_at', cutoff)
      .order('sent_at', { ascending: false })
      .range(offset, offset + pageSize - 1);

    if (companyId) q = q.eq('company_id', companyId);
    if (status)    q = q.eq('status', status);
    if (type)      q = q.eq('message_type', type);

    const { data, error, count } = await q;
    if (error) return res.status(500).json({ error: error.message });
    return res.json({ data: data || [], total: count || 0, page: parseInt(page), pageSize });
  }

  // GET /api/admin/companies — listar todas las empresas con stats básicas
  if (req.method === 'GET') {
    const { data, error } = await supabaseAdmin
      .from('companies')
      .select(`
        id, name, email_alias, plan, subscription_status, trial_ends_at, subscription_expires_at,
        max_employees, max_verifications_month, max_bank_accounts, is_active, created_at, user_id
      `)
      .order('created_at', { ascending: false });
    if (error) return res.status(500).json({ error: error.message });

    // Enriquecer con emails de auth
    const userIds = data.map(c => c.user_id);
    const { data: authUsers } = await supabaseAdmin.auth.admin.listUsers();
    const emailMap = Object.fromEntries(
      (authUsers?.users || []).map(u => [u.id, u.email])
    );

    return res.json(data.map(c => ({ ...c, user_email: emailMap[c.user_id] || null })));
  }

  // PATCH /api/admin/companies — actualizar plan / is_active de una empresa
  if (req.method === 'PATCH') {
    const { id, plan, max_employees, max_verifications_month, max_bank_accounts, subscription_status, trial_ends_at, subscription_expires_at, is_active } = req.body || {};
    if (!id) return res.status(400).json({ error: 'id requerido' });
    const allowed = {};
    if (plan !== undefined) allowed.plan = plan;
    if (max_employees !== undefined) allowed.max_employees = max_employees;
    if (max_verifications_month !== undefined) allowed.max_verifications_month = max_verifications_month;
    if (max_bank_accounts !== undefined) allowed.max_bank_accounts = max_bank_accounts;
    if (subscription_status !== undefined) allowed.subscription_status = subscription_status;
    if (trial_ends_at !== undefined) allowed.trial_ends_at = trial_ends_at;
    if (subscription_expires_at !== undefined) allowed.subscription_expires_at = subscription_expires_at;
    if (is_active !== undefined) allowed.is_active = is_active;

    // Si el plan cambia, auto-deshabilitar números de notificación que excedan el nuevo límite
    if (plan !== undefined) {
      const newMax = plan === 'enterprise' ? 5 : plan === 'business' ? 2 : 0;
      const { data: curr } = await supabaseAdmin.from('companies').select('notification_whatsapp').eq('id', id).maybeSingle();
      const contacts = Array.isArray(curr?.notification_whatsapp) ? curr.notification_whatsapp : [];
      let activeSlots = newMax;
      const adjusted = contacts.map(c => {
        if (c.active && activeSlots > 0) { activeSlots--; return c; }
        if (c.active) return { ...c, active: false };
        return c;
      });
      allowed.notification_whatsapp = adjusted;
    }

    const { data, error } = await supabaseAdmin
      .from('companies')
      .update(allowed)
      .eq('id', id)
      .select()
      .single();
    if (error) return res.status(400).json({ error: error.message });
    return res.json(data);
  }

  return res.status(405).end();
}

// Handler para info de usuario de una empresa (llamado internamente)
export async function userInfoHandler(req, res, user) {
  if (!user) {
    // Llamado directo (desde server.js)
    const { requireUser: ru } = await import('../../lib/auth.js');
    user = await ru(req, res);
    if (!user) return;
    if (!ADMIN_EMAILS.includes(user.email?.toLowerCase())) {
      return res.status(403).json({ error: 'Solo el super admin puede usar este endpoint' });
    }
  }

  const { companyId } = req.query;
  if (!companyId) return res.status(400).json({ error: 'companyId requerido' });

  const { data: company, error: compErr } = await supabaseAdmin
    .from('companies').select('user_id').eq('id', companyId).maybeSingle();
  if (compErr || !company) return res.status(404).json({ error: 'Empresa no encontrada' });

  if (req.method === 'GET') {
    const { data: { user: targetUser }, error } = await supabaseAdmin.auth.admin.getUserById(company.user_id);
    if (error || !targetUser) return res.status(404).json({ error: 'Usuario no encontrado' });
    return res.json({ id: targetUser.id, email: targetUser.email, created_at: targetUser.created_at });
  }

  if (req.method === 'PATCH') {
    const { password } = req.body || {};
    if (!password || password.length < 6) return res.status(400).json({ error: 'La contraseña debe tener al menos 6 caracteres' });
    const { error } = await supabaseAdmin.auth.admin.updateUserById(company.user_id, { password });
    if (error) return res.status(500).json({ error: error.message });
    return res.json({ ok: true });
  }

  res.status(405).json({ error: 'Método no permitido' });
}
