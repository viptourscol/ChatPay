import { supabaseAdmin } from '../../lib/supabase.js';
import { requireUser } from '../../lib/auth.js';
import { resolveCompany } from '../../lib/getCompany.js';
import { checkBankAccountLimit } from '../../lib/subscription.js';

const ADMIN_EMAILS = (process.env.ADMIN_EMAILS || '').split(',').map(e => e.trim().toLowerCase()).filter(Boolean);

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Impersonate-Company');
  if (req.method === 'OPTIONS') return res.status(204).end();

  const user = await requireUser(req, res);
  if (!user) return;

  req._impersonateUserEmail = user.email;
  const company = await resolveCompany(user.id, req, res);
  if (!company) return;
  const companyId = company.id;
  const isImpersonating = ADMIN_EMAILS.includes(user.email?.toLowerCase()) && req.headers['x-impersonate-company'];

  // GET — listar cuentas
  if (req.method === 'GET') {
    const { data, error } = await supabaseAdmin
      .from('company_bank_accounts')
      .select('*')
      .eq('company_id', companyId)
      .order('created_at', { ascending: true });
    if (error) return res.status(500).json({ error: error.message });
    return res.json(data || []);
  }

  // POST — agregar cuenta (bloqueado en modo impersonación)
  if (req.method === 'POST') {
    if (isImpersonating) return res.status(403).json({ error: 'No puedes modificar cuentas en modo impersonación' });
    const { label, bank_name, bancolombia_email } = req.body || {};
    if (!bancolombia_email) return res.status(400).json({ error: 'El email es requerido' });

    const limitCheck = await checkBankAccountLimit(companyId);
    if (!limitCheck.ok) return res.status(403).json({ error: limitCheck.reason, limitReached: limitCheck.limitReached });

    const { data, error } = await supabaseAdmin
      .from('company_bank_accounts')
      .insert({ company_id: companyId, label: label || 'Cuenta', bank_name: bank_name || 'Bancolombia', bancolombia_email: bancolombia_email.toLowerCase().trim() })
      .select()
      .single();
    if (error) return res.status(500).json({ error: error.message });
    return res.status(201).json(data);
  }

  // DELETE — eliminar cuenta (bloqueado en modo impersonación)
  if (req.method === 'DELETE') {
    if (isImpersonating) return res.status(403).json({ error: 'No puedes modificar cuentas en modo impersonación' });
    const { id } = req.query;
    if (!id) return res.status(400).json({ error: 'ID requerido' });

    const { error } = await supabaseAdmin
      .from('company_bank_accounts')
      .delete()
      .eq('id', id)
      .eq('company_id', companyId); // garantizar que pertenece a esta empresa
    if (error) return res.status(500).json({ error: error.message });
    return res.status(204).end();
  }

  res.status(405).json({ error: 'Método no permitido' });
}
