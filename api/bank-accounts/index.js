import { supabaseAdmin } from '../../lib/supabase.js';
import { requireUser } from '../../lib/auth.js';
import { requireCompany } from '../../lib/getCompany.js';
import { checkBankAccountLimit } from '../../lib/subscription.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(204).end();

  const user = await requireUser(req, res);
  if (!user) return;

  const company = await requireCompany(user.id, res);
  if (!company) return;
  const companyId = company.id;

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

  // POST — agregar cuenta
  if (req.method === 'POST') {
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

  // DELETE — eliminar cuenta
  if (req.method === 'DELETE') {
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
