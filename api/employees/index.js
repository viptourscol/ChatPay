import { requireUser } from '../../lib/auth.js';
import { supabaseAdmin } from '../../lib/supabase.js';

export default async function handler(req, res) {
  const user = await requireUser(req, res);
  if (!user) return;

  if (req.method === 'GET') {
    const { data, error } = await supabaseAdmin
      .from('employees')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) return res.status(500).json({ error: error.message });
    return res.json({ items: data });
  }

  if (req.method === 'POST') {
    const { name, whatsapp_number } = req.body || {};
    if (!name || !whatsapp_number) return res.status(400).json({ error: 'name y whatsapp_number requeridos' });
    const number = String(whatsapp_number).trim().startsWith('+')
      ? String(whatsapp_number).trim()
      : `+${String(whatsapp_number).trim()}`;
    const { data, error } = await supabaseAdmin
      .from('employees')
      .insert({ name, whatsapp_number: number })
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
      .select()
      .single();
    if (error) return res.status(400).json({ error: error.message });
    return res.json(data);
  }

  if (req.method === 'DELETE') {
    const { id } = req.query;
    if (!id) return res.status(400).json({ error: 'id required' });
    const { error } = await supabaseAdmin.from('employees').delete().eq('id', id);
    if (error) return res.status(400).json({ error: error.message });
    return res.json({ ok: true });
  }

  return res.status(405).end();
}
