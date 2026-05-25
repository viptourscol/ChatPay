import { requireUser } from '../../lib/auth.js';
import { supabaseAdmin } from '../../lib/supabase.js';
import { requireCompany } from '../../lib/getCompany.js';
import { randomUUID } from 'crypto';

export default async function handler(req, res) {
  const user = await requireUser(req, res);
  if (!user) return;

  const company = await requireCompany(user.id, res);
  if (!company) return;
  const companyId = company.id;

  // ── Sub-recurso: token SMS ─────────────────────────────────────────────────
  if (req.query.resource === 'sms-token') {
    if (req.method === 'GET') {
      const { data } = await supabaseAdmin
        .from('companies')
        .select('sms_webhook_token, sms_phone_number')
        .eq('id', companyId)
        .maybeSingle();
      // Si la columna no existe aún (migración pendiente), devolver null sin error
      if (!data) return res.json({ sms_webhook_token: null, sms_phone_number: null });
      return res.json(data);
    }
    if (req.method === 'POST') {
      const { phone, rotate } = req.body || {};
      const patch = {};
      if (phone !== undefined) patch.sms_phone_number = phone || null;
      if (rotate) patch.sms_webhook_token = randomUUID();
      if (!Object.keys(patch).length) return res.status(400).json({ error: 'Nada que actualizar' });
      const { data, error } = await supabaseAdmin
        .from('companies')
        .update(patch)
        .eq('id', companyId)
        .select('sms_webhook_token, sms_phone_number')
        .maybeSingle();
      if (error) return res.status(400).json({ error: error.message });
      return res.json(data);
    }
    return res.status(405).end();
  }

  // ── Sub-recurso: SMS admin (solo superadmin) ───────────────────────────────
  if (req.query.resource === 'sms-admin') {
    const ADMIN_EMAILS = (process.env.ADMIN_EMAILS || '').split(',').map(e => e.trim().toLowerCase());
    if (!ADMIN_EMAILS.includes(user.email?.toLowerCase())) {
      return res.status(403).json({ error: 'Acceso denegado' });
    }
    if (req.method !== 'GET') return res.status(405).end();

    const { status, bank, company_id: filterCompany } = req.query;
    let q = supabaseAdmin
      .from('transaction_sms')
      .select('id, company_id, transaction_id, bank, amount, reference, sender_name, received_at, source, status, raw_text, created_at, companies(name)')
      .order('received_at', { ascending: false })
      .limit(100);

    if (status)        q = q.eq('status', status);
    if (bank)          q = q.eq('bank', bank);
    if (filterCompany) q = q.eq('company_id', filterCompany);

    const { data, error } = await q;
    if (error) return res.status(500).json({ error: error.message });
    return res.json(data || []);
  }
  // ──────────────────────────────────────────────────────────────────────────
  const { location_id } = req.query;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const monthAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  // Helper para aplicar filtro de sede opcional
  const withLocation = (q) => location_id ? q.eq('location_id', location_id) : q;

  const [todayQ, weekQ, fakeQ, empQ, recentQ, recentVerifQ, pendingQ, amountQ] = await Promise.all([
    withLocation(supabaseAdmin
      .from('verifications')
      .select('id', { count: 'exact', head: true })
      .eq('company_id', companyId)
      .gte('created_at', today.toISOString())),
    withLocation(supabaseAdmin
      .from('verifications')
      .select('id', { count: 'exact', head: true })
      .eq('company_id', companyId)
      .gte('created_at', weekAgo.toISOString())),
    withLocation(supabaseAdmin
      .from('verifications')
      .select('id', { count: 'exact', head: true })
      .eq('company_id', companyId)
      .in('status', ['fake', 'duplicate'])
      .gte('created_at', weekAgo.toISOString())),
    supabaseAdmin
      .from('employees')
      .select('id', { count: 'exact', head: true })
      .eq('company_id', companyId)
      .eq('is_active', true),
    withLocation(supabaseAdmin
      .from('verifications')
      .select('created_at,status')
      .eq('company_id', companyId)
      .gte('created_at', weekAgo.toISOString())),
    // Últimas 8 verificaciones con detalle para actividad reciente
    withLocation(supabaseAdmin
      .from('verifications')
      .select('id,created_at,status,extracted_amount,extracted_sender,whatsapp_from,employees(name)')
      .eq('company_id', companyId)
      .order('created_at', { ascending: false })
      .limit(8)),
    // Transacciones pendientes sin verificar
    supabaseAdmin
      .from('transactions')
      .select('id', { count: 'exact', head: true })
      .eq('company_id', companyId)
      .eq('status', 'pending'),
    // Monto total verificado (real) en el mes
    withLocation(supabaseAdmin
      .from('verifications')
      .select('extracted_amount')
      .eq('company_id', companyId)
      .eq('status', 'real')
      .gte('created_at', monthAgo.toISOString())),
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
