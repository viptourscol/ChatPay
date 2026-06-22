import { supabaseAdmin } from '../../lib/supabase.js';
import { requireUser } from '../../lib/auth.js';

const ADMIN_EMAILS = (process.env.ADMIN_EMAILS || '').split(',').map(e => e.trim().toLowerCase());

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(204).end();

  const user = await requireUser(req, res);
  if (!user) return;

  const impersonateId = req.headers['x-impersonate-company'];
  const isAdmin = ADMIN_EMAILS.includes((user.email || '').toLowerCase());
  const impersonating = impersonateId && isAdmin;

  const applyOwnerFilter = (q) => impersonating
    ? q.eq('company_id', impersonateId)
    : q.eq('user_id', user.id);

  if (req.method === 'GET') {
    const { from, to, category, page = '1', limit = '50' } = req.query;
    const pageNum = Math.max(1, parseInt(page));
    const pageSize = Math.min(100, Math.max(1, parseInt(limit)));
    const offset = (pageNum - 1) * pageSize;

    let q = applyOwnerFilter(
      supabaseAdmin.from('egresos').select('*', { count: 'exact' })
    ).order('payment_date', { ascending: false }).range(offset, offset + pageSize - 1);

    if (from) q = q.gte('payment_date', from);
    if (to) q = q.lte('payment_date', to);
    if (category) q = q.eq('category', category);

    const { data: items, count, error } = await q;
    if (error) {
      console.error('[egresos GET]', error.message, error.details);
      return res.status(500).json({ error: error.message, details: error.details });
    }

    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
    const { data: monthRows } = await applyOwnerFilter(
      supabaseAdmin.from('egresos').select('amount')
    ).gte('payment_date', monthStart);
    const monthTotal = (monthRows || []).reduce((acc, e) => acc + Number(e.amount), 0);

    const { data: allRows } = await applyOwnerFilter(
      supabaseAdmin.from('egresos').select('amount')
    );
    const allTotal = (allRows || []).reduce((acc, e) => acc + Number(e.amount), 0);

    return res.json({
      items: items || [],
      total: count || 0,
      page: pageNum,
      pageSize,
      stats: { monthTotal, monthCount: monthRows?.length || 0, allTotal }
    });
  }

  if (req.method === 'POST') {
    if (impersonating) return res.status(403).json({ error: 'No permitido en modo impersonacion' });
    const { description, amount, recipient, payment_date, method, category, notes } = req.body || {};
    if (!description || !amount) return res.status(400).json({ error: 'description y amount son requeridos' });
    const { data, error } = await supabaseAdmin
      .from('egresos')
      .insert({ user_id: user.id, description, amount, recipient, payment_date, method, category, notes })
      .select().single();
    if (error) return res.status(500).json({ error: error.message });
    return res.status(201).json(data);
  }

  if (req.method === 'PATCH') {
    if (impersonating) return res.status(403).json({ error: 'No permitido en modo impersonacion' });
    const { id, ...fields } = req.body || {};
    if (!id) return res.status(400).json({ error: 'id requerido' });
    delete fields.user_id;
    const { data, error } = await supabaseAdmin
      .from('egresos').update(fields).eq('id', id).eq('user_id', user.id).select().single();
    if (error) return res.status(500).json({ error: error.message });
    return res.json(data);
  }

  if (req.method === 'DELETE') {
    if (impersonating) return res.status(403).json({ error: 'No permitido en modo impersonacion' });
    const { id } = req.query;
    if (!id) return res.status(400).json({ error: 'id requerido' });
    const { error } = await supabaseAdmin
      .from('egresos').delete().eq('id', id).eq('user_id', user.id);
    if (error) return res.status(500).json({ error: error.message });
    return res.status(204).end();
  }

  res.status(405).json({ error: 'Metodo no permitido' });
}
