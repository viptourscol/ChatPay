import { supabaseAdmin } from '../../lib/supabase.js';
import { requireUser } from '../../lib/auth.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(204).end();

  const user = await requireUser(req, res);
  if (!user) return;

  // GET — obtener settings de la empresa
  if (req.method === 'GET') {
    const { data, error } = await supabaseAdmin
      .from('companies')
      .select('*')
      .eq('user_id', user.id)
      .single();

    // Si no existe, devolver vacío (se creará al guardar)
    if (error && error.code === 'PGRST116') {
      return res.json({ id: null, name: '', nit: '', tax_regime: '', address: '', phone: '' });
    }
    if (error) return res.status(500).json({ error: error.message });
    return res.json(data);
  }

  // PUT — crear o actualizar settings
  if (req.method === 'PUT') {
    const { name, nit, tax_regime, address, phone, bancolombia_email } = req.body || {};

    const { data: existing } = await supabaseAdmin
      .from('companies')
      .select('id')
      .eq('user_id', user.id)
      .single();

    let result, error;
    if (existing?.id) {
      ({ data: result, error } = await supabaseAdmin
        .from('companies')
        .update({ name, nit, tax_regime, address, phone, bancolombia_email: bancolombia_email || null })
        .eq('user_id', user.id)
        .select()
        .single());
    } else {
      ({ data: result, error } = await supabaseAdmin
        .from('companies')
        .insert({ user_id: user.id, name, nit, tax_regime, address, phone, bancolombia_email: bancolombia_email || null })
        .select()
        .single());
    }

    if (error) return res.status(500).json({ error: error.message });
    return res.json(result);
  }

  res.status(405).json({ error: 'Método no permitido' });
}
