import { supabaseAdmin } from '../../lib/supabase.js';
import { requireUser } from '../../lib/auth.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(204).end();

  const user = await requireUser(req, res);
  if (!user) return;

  // GET — listar egresos con filtros y stats
  if (req.method === 'GET') {
    const { from, to, category, page = '1', limit = '50' } = req.query;
    const pageNum = Math.max(1, parseInt(page));
    const pageSize = Math.min(100, Math.max(1, parseInt(limit)));
    const offset = (pageNum - 1) * pageSize;

    let q = supabaseAdmin
      .from('egresos')
      .select('*', { count: 'exact' })
      .eq('user_id', user.id)
      .order('payment_date', { ascending: false })
      .range(offset, offset + pageSize - 1);

    if (from) q = q.gte('payment_date', from);
    if (to) q = q.lte('payment_date', to);
    if (category) q = q.eq('category', category);

    const { data: items, count, error } = await q;
    if (error) return res.status(500).json({ error: error.message });

    // Stats mes actual
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
      .toISOString()
      .slice(0, 10);
    const { data: monthRows } = await supabaseAdmin
      .from('egresos')
      .select('amount')
      .eq('user_id', user.id)
      .gte('payment_date', monthStart);
    const monthTotal = (monthRows || []).reduce((acc, e) => acc + Number(e.amount), 0);

    // Total general
    const { data: allRows } = await supabaseAdmin
      .from('egresos')
      .select('amount')
      .eq('user_id', user.id);
    const allTotal = (allRows || []).reduce((acc, e) => acc + Number(e.amount), 0);

    return res.json({
      items: items || [],
      total: count || 0,
      page: pageNum,
      pageSize,
      stats: { monthTotal, monthCount: monthRows?.length || 0, allTotal }
    });
  }

  // POST — crear egreso
  if (req.method === 'POST') {
    const { description, amount, recipient, payment_date, method, category, notes } = req.body || {};
    if (!description || !amount) {
      return res.status(400).json({ error: 'description y amount son requeridos' });
    }
    const { data, error } = await supabaseAdmin
      .from('egresos')
      .insert({ user_id: user.id, description, amount, recipient, payment_date, method, category, notes })
      .select()
      .single();
    if (error) return res.status(500).json({ error: error.message });
    return res.status(201).json(data);
  }

  // PATCH — actualizar egreso
  if (req.method === 'PATCH') {
    const { id, ...fields } = req.body || {};
    if (!id) return res.status(400).json({ error: 'id requerido' });
    delete fields.user_id; // no permitir cambiar el owner
    const { data, error } = await supabaseAdmin
      .from('egresos')
      .update(fields)
      .eq('id', id)
      .eq('user_id', user.id)
      .select()
      .single();
    if (error) return res.status(500).json({ error: error.message });
    return res.json(data);
  }

  // DELETE — eliminar egreso
  if (req.method === 'DELETE') {
    const { id } = req.query;
    if (!id) return res.status(400).json({ error: 'id requerido' });
    const { error } = await supabaseAdmin
      .from('egresos')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id);
    if (error) return res.status(500).json({ error: error.message });
    return res.status(204).end();
  }

  res.status(405).json({ error: 'Método no permitido' });
}
