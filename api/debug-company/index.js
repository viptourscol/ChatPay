import { supabaseAdmin } from '../lib/supabase.js';
import { requireUser } from '../lib/auth.js';
import { getCompany } from '../lib/getCompany.js';

const ADMIN_EMAILS = (process.env.ADMIN_EMAILS || '').split(',').map(e => e.trim().toLowerCase());

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(204).end();

  const user = await requireUser(req, res);
  if (!user) return;

  const impersonateId = req.headers['x-impersonate-company'];
  const isAdmin = ADMIN_EMAILS.includes((user.email || '').toLowerCase());

  try {
    let companyId = null;
    let companyData = null;

    if (impersonateId && isAdmin) {
      companyId = impersonateId;
      const { data, error } = await supabaseAdmin
        .from('companies')
        .select('*')
        .eq('id', companyId)
        .single();
      companyData = data;
      if (error) console.error('[debug] fetch impersonated company error:', error.message);
    } else {
      const company = await getCompany(user.id);
      if (!company) return res.status(401).json({ error: 'Unauthorized' });
      companyId = company.id;
      companyData = company;
    }

    // Obtener sedes
    const { data: locations, error: locError } = await supabaseAdmin
      .from('company_locations')
      .select('*')
      .eq('company_id', companyId);

    // Obtener notificaciones programadas
    const { data: schedules, error: schedError } = await supabaseAdmin
      .from('notification_schedules')
      .select('*')
      .eq('company_id', companyId);

    return res.status(200).json({
      user: {
        id: user.id,
        email: user.email,
        isAdmin
      },
      impersonating: impersonateId ? { id: impersonateId, isAdmin } : null,
      company: {
        id: companyData?.id,
        name: companyData?.name,
        plan: companyData?.plan,
        notification_whatsapp: companyData?.notification_whatsapp || []
      },
      locations: {
        count: locations?.length || 0,
        data: locations || [],
        error: locError ? locError.message : null
      },
      schedules: {
        count: schedules?.length || 0,
        data: schedules || [],
        error: schedError ? schedError.message : null
      }
    });
  } catch (err) {
    console.error('[debug-company] fatal:', err.message);
    return res.status(500).json({ error: err.message });
  }
}
