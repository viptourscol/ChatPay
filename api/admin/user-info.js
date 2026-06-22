import { supabaseAdmin } from '../../lib/supabase.js';
import { requireUser } from '../../lib/auth.js';

const ADMIN_EMAILS = (process.env.ADMIN_EMAILS || '').split(',').map(e => e.trim().toLowerCase()).filter(Boolean);

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(204).end();

  const user = await requireUser(req, res);
  if (!user) return;

  if (!ADMIN_EMAILS.includes(user.email?.toLowerCase())) {
    return res.status(403).json({ error: 'Solo el super admin puede usar este endpoint' });
  }

  const { companyId } = req.query;
  if (!companyId) return res.status(400).json({ error: 'companyId requerido' });

  // Obtener el user_id de la empresa
  const { data: company, error: compErr } = await supabaseAdmin
    .from('companies')
    .select('user_id')
    .eq('id', companyId)
    .maybeSingle();
  if (compErr || !company) return res.status(404).json({ error: 'Empresa no encontrada' });

  // GET — obtener info del usuario
  if (req.method === 'GET') {
    const { data: { user: targetUser }, error } = await supabaseAdmin.auth.admin.getUserById(company.user_id);
    if (error || !targetUser) return res.status(404).json({ error: 'Usuario no encontrado' });
    return res.json({
      id: targetUser.id,
      email: targetUser.email,
      created_at: targetUser.created_at,
    });
  }

  // PATCH — cambiar contraseña del usuario
  if (req.method === 'PATCH') {
    const { password } = req.body || {};
    if (!password || password.length < 6) return res.status(400).json({ error: 'La contraseña debe tener al menos 6 caracteres' });

    const { error } = await supabaseAdmin.auth.admin.updateUserById(company.user_id, { password });
    if (error) return res.status(500).json({ error: error.message });
    return res.json({ ok: true });
  }

  res.status(405).json({ error: 'Método no permitido' });
}
