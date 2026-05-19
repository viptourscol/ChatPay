import { requireUser } from '../../lib/auth.js';
import { supabaseAdmin } from '../../lib/supabase.js';

export default async function handler(req, res) {
  const user = await requireUser(req, res);
  if (!user) return;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const monthAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const [todayQ, weekQ, fakeQ, empQ, recentQ, recentVerifQ, pendingQ, amountQ] = await Promise.all([
    supabaseAdmin
      .from('verifications')
      .select('id', { count: 'exact', head: true })
      .gte('created_at', today.toISOString()),
    supabaseAdmin
      .from('verifications')
      .select('id', { count: 'exact', head: true })
      .gte('created_at', weekAgo.toISOString()),
    supabaseAdmin
      .from('verifications')
      .select('id', { count: 'exact', head: true })
      .in('status', ['fake', 'duplicate'])
      .gte('created_at', weekAgo.toISOString()),
    supabaseAdmin
      .from('employees')
      .select('id', { count: 'exact', head: true })
      .eq('is_active', true),
    supabaseAdmin
      .from('verifications')
      .select('created_at,status')
      .gte('created_at', weekAgo.toISOString()),
    // Últimas 8 verificaciones con detalle para actividad reciente
    supabaseAdmin
      .from('verifications')
      .select('id,created_at,status,extracted_amount,extracted_sender,whatsapp_from,employees(name)')
      .order('created_at', { ascending: false })
      .limit(8),
    // Transacciones pendientes sin verificar
    supabaseAdmin
      .from('transactions')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'pending'),
    // Monto total verificado (real) en el mes
    supabaseAdmin
      .from('verifications')
      .select('extracted_amount')
      .eq('status', 'real')
      .gte('created_at', monthAgo.toISOString()),
  ]);

  // Agrupar por día (últimos 7 días)
  const byDay = {};
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() - i);
    byDay[d.toISOString().slice(0, 10)] = { real: 0, fake: 0, duplicate: 0, other: 0 };
  }
  (recentQ.data || []).forEach((v) => {
    const k = v.created_at.slice(0, 10);
    if (!byDay[k]) return;
    if (v.status === 'real') byDay[k].real++;
    else if (v.status === 'fake') byDay[k].fake++;
    else if (v.status === 'duplicate') byDay[k].duplicate++;
    else byDay[k].other++;
  });

  const totalAmountMonth = (amountQ.data || [])
    .reduce((s, r) => s + Number(r.extracted_amount || 0), 0);

  const weekTotal = weekQ.count || 0;
  const weekReal = (recentQ.data || []).filter(v => v.status === 'real').length;
  const accuracy = weekTotal > 0 ? Math.round((weekReal / weekTotal) * 100) : 0;

  res.json({
    today: todayQ.count || 0,
    week: weekTotal,
    fakes: fakeQ.count || 0,
    activeEmployees: empQ.count || 0,
    pendingTransactions: pendingQ.count || 0,
    totalAmountMonth,
    accuracy,
    daily: Object.entries(byDay).map(([date, v]) => ({ date, ...v })),
    recent: recentVerifQ.data || [],
  });
}
