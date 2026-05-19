import { requireUser } from '../../lib/auth.js';
import { supabaseAdmin } from '../../lib/supabase.js';
import { requireCompany } from '../../lib/getCompany.js';

export default async function handler(req, res) {
  const user = await requireUser(req, res);
  if (!user) return;

  const company = await requireCompany(user.id, res);
  if (!company) return;
  const companyId = company.id;

  if (req.method === 'GET') {
    const { data, error } = await supabaseAdmin
      .from('employees')
      .select('*')
      .eq('company_id', companyId)
      .order('created_at', { ascending: false });
    if (error) return res.status(500).json({ error: error.message });
    return res.json({ items: data });
  }

  if (req.method === 'POST') {
    const { name, whatsapp_number } = req.body || {};
    if (!name || !whatsapp_number) return res.status(400).json({ error: 'name y whatsapp_number requeridos' });

    // Verificar límite del plan
    const { count } = await supabaseAdmin
      .from('employees')
      .select('id', { count: 'exact', head: true })
      .eq('company_id', companyId)
      .eq('is_active', true);
    if (count >= company.max_employees) {
      return res.status(403).json({
        error: `Tu plan permite máximo ${company.max_employees} empleados activos. Actualiza tu plan para agregar más.`
      });
    }

    const number = String(whatsapp_number).trim().startsWith('+')
      ? String(whatsapp_number).trim()
      : `+${String(whatsapp_number).trim()}`;
    const { data, error } = await supabaseAdmin
      .from('employees')
      .insert({ name, whatsapp_number: number, company_id: companyId })
      .select()
      .single();
    if (error) return res.status(400).json({ error: error.message });
    return res.json(data);
  }

  if (req.method === 'PATCH') {
    const { id, ...updates } = req.body || {};
    if (!id) return res.status(400).json({ error: 'id required' });
    const allowed = ['name', 'whatsapp_number', 'is_active'];
    const patch = Object.fromEntries(Object.entries(updates).filter(([k]) => allowed.includes(k)));
    const { data, error } = await supabaseAdmin
      .from('employees')
      .update(patch)
      .eq('id', id)
      .eq('company_id', companyId)   // evitar modificar empleados de otra empresa
      .select()
      .single();
    if (error) return res.status(400).json({ error: error.message });
    return res.json(data);
  }

  if (req.method === 'DELETE') {
    const { id } = req.query;
    if (!id) return res.status(400).json({ error: 'id required' });
    const { error } = await supabaseAdmin
      .from('employees')
      .delete()
      .eq('id', id)
      .eq('company_id', companyId);  // evitar borrar empleados de otra empresa
    if (error) return res.status(400).json({ error: error.message });
    return res.json({ ok: true });
  }

  return res.status(405).end();
}
