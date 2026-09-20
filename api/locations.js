import { supabaseAdmin } from '../lib/supabase.js';
import { requireUser } from '../lib/auth.js';
import { getCompany } from '../lib/getCompany.js';

const ADMIN_EMAILS = (process.env.ADMIN_EMAILS || '').split(',').map(e => e.trim().toLowerCase());

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(204).end();

  // Validar usuario
  const user = await requireUser(req, res);
  if (!user) return;

  // Soporte de impersonación para super admin
  const impersonateId = req.headers['x-impersonate-company'];
  const isAdmin = ADMIN_EMAILS.includes((user.email || '').toLowerCase());

  try {
    let companyId = null;

    if (impersonateId && isAdmin) {
      // Super admin impersonating another company
      companyId = impersonateId;
    } else {
      // Regular user - get their own company
      const company = await getCompany(user.id);
      if (!company) return res.status(401).json({ error: 'Unauthorized' });
      companyId = company.id;
    }

    // Obtener todas las locations de la compañía (activas e inactivas para debugging)
    const { data, error } = await supabaseAdmin
      .from('company_locations')
      .select('id, name, city, address, is_active, created_at')
      .eq('company_id', companyId)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('[locations] error:', error.message);
      return res.status(500).json({ error: error.message });
    }

    return res.status(200).json(data || []);
  } catch (err) {
    console.error('[locations] fatal:', err.message);
    return res.status(500).json({ error: err.message });
  }
}
