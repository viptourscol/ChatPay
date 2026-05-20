import { supabaseAdmin } from '../../lib/supabase.js';
import { requireUser } from '../../lib/auth.js';

const ADMIN_EMAILS = (process.env.ADMIN_EMAILS || '').split(',').map(e => e.trim().toLowerCase());

export default async function handler(req, res) {
  const user = await requireUser(req, res);
  if (!user) return;

  // Verificar que el usuario es admin
  if (!ADMIN_EMAILS.includes(user.email?.toLowerCase())) {
    return res.status(403).json({ error: 'Acceso restringido.' });
  }

  // GET /api/admin/companies — listar todas las empresas con stats básicas
  if (req.method === 'GET') {
    const { data, error } = await supabaseAdmin
      .from('companies')
      .select(`
        id, name, email_alias, plan, subscription_status, trial_ends_at,
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
    const { id, plan, max_employees, max_verifications_month, max_bank_accounts, subscription_status, trial_ends_at, is_active } = req.body || {};
    if (!id) return res.status(400).json({ error: 'id requerido' });
    const allowed = {};
    if (plan !== undefined) allowed.plan = plan;
    if (max_employees !== undefined) allowed.max_employees = max_employees;
    if (max_verifications_month !== undefined) allowed.max_verifications_month = max_verifications_month;
    if (max_bank_accounts !== undefined) allowed.max_bank_accounts = max_bank_accounts;
    if (subscription_status !== undefined) allowed.subscription_status = subscription_status;
    if (trial_ends_at !== undefined) allowed.trial_ends_at = trial_ends_at;
    if (is_active !== undefined) allowed.is_active = is_active;
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
