import { supabaseAdmin } from '../../lib/supabase.js';
import { requireUser } from '../../lib/auth.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(204).end();

  const user = await requireUser(req, res);
  if (!user) return;

  try {

  const { from, to, min_amount, max_amount, status, sender, page = '1', limit = '50' } = req.query;
  const pageNum = Math.max(1, parseInt(page));
  const pageSize = Math.min(100, Math.max(1, parseInt(limit)));
  const offset = (pageNum - 1) * pageSize;

  let query = supabaseAdmin
    .from('transactions')
    .select('*', { count: 'exact' })
    .order('transaction_date', { ascending: false })
    .range(offset, offset + pageSize - 1);

  if (from) query = query.gte('transaction_date', from);
  if (to) query = query.lte('transaction_date', to + 'T23:59:59');
  if (min_amount) query = query.gte('amount', parseFloat(min_amount));
  if (max_amount) query = query.lte('amount', parseFloat(max_amount));
  if (status) query = query.eq('status', status);
  if (sender) query = query.ilike('sender_name', `%${sender}%`);

  const { data: items, count, error } = await query;
  if (error) return res.status(500).json({ error: error.message });

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

  // Queries de stats en paralelo — cada una con manejo de error independiente
  const [allRows, monthRows, pendingRes] = await Promise.all([
    supabaseAdmin.from('transactions').select('amount'),
    supabaseAdmin.from('transactions').select('amount').gte('transaction_date', monthStart),
    supabaseAdmin.from('transactions').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
  ]);

  const allData = allRows.data || [];
  const allTimeTotal = allData.reduce((s, t) => s + Number(t.amount || 0), 0);
  const allTimeCount = allData.length;
  const allTimeAvg   = allTimeCount ? allTimeTotal / allTimeCount : 0;

  const monthData  = monthRows.data || [];
  const monthTotal = monthData.reduce((s, t) => s + Number(t.amount || 0), 0);

  return res.json({
    items: items || [],
    total: count || 0,
    page: pageNum,
    pageSize,
    stats: {
      allTimeTotal,
      allTimeAvg,
      allTimeCount,
      monthTotal,
      monthCount: monthData.length,
      pendingCount: pendingRes.error ? 0 : (pendingRes.count || 0),
    }
  });
  } catch (err) {
    console.error('[ingresos] unhandled error:', err);
    return res.status(500).json({ error: err.message });
  }
}

