import { supabaseAdmin } from '../../lib/supabase.js';
import { requireUser } from '../../lib/auth.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(204).end();

  const user = await requireUser(req, res);
  if (!user) return;

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

  // Stats globales y del mes
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

  const [allRows, monthRows, pendingRows] = await Promise.all([
    supabaseAdmin.from('transactions').select('amount'),
    supabaseAdmin.from('transactions').select('amount').gte('transaction_date', monthStart),
    supabaseAdmin.from('transactions').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
  ]);

  const allTimeTotal = (allRows.data || []).reduce((acc, t) => acc + Number(t.amount), 0);
  const allTimeAvg = allRows.data?.length ? allTimeTotal / allRows.data.length : 0;
  const monthTotal = (monthRows.data || []).reduce((acc, t) => acc + Number(t.amount), 0);
  const maxTx = (allRows.data || []).reduce((mx, t) => Math.max(mx, Number(t.amount)), 0);

  return res.json({
    items: items || [],
    total: count || 0,
    page: pageNum,
    pageSize,
    stats: {
      allTimeTotal,
      allTimeAvg,
      allTimeCount: allRows.data?.length || 0,
      monthTotal,
      monthCount: monthRows.data?.length || 0,
      pendingCount: pendingRows.count || 0,
      maxTx,
    }
  });
}

