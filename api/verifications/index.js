import { requireUser } from '../../lib/auth.js';
import { supabaseAdmin } from '../../lib/supabase.js';

export default async function handler(req, res) {
  const user = await requireUser(req, res);
  if (!user) return;

  if (req.method === 'GET') {
    const { from, to, status, employee_id, limit = 100 } = req.query;
    let q = supabaseAdmin
      .from('verifications')
      .select('*, employees(name, whatsapp_number), transactions(*)')
      .order('created_at', { ascending: false })
      .limit(Number(limit));
    if (status) q = q.eq('status', status);
    if (employee_id) q = q.eq('employee_id', employee_id);
    if (from) q = q.gte('created_at', from);
    if (to) q = q.lte('created_at', to);

    const { data, error } = await q;
    if (error) return res.status(500).json({ error: error.message });

    // Firmar URLs de comprobantes
    const withUrls = await Promise.all(
      (data || []).map(async (v) => {
        if (!v.comprobante_image_url) return v;
        const { data: s } = await supabaseAdmin.storage
          .from('comprobantes')
          .createSignedUrl(v.comprobante_image_url, 3600);
        return { ...v, comprobante_signed_url: s?.signedUrl || null };
      })
    );
    return res.json({ items: withUrls });
  }

  if (req.method === 'PATCH') {
    const { id, ...updates } = req.body || {};
    if (!id) return res.status(400).json({ error: 'id required' });
    const allowed = ['status', 'notes', 'extracted_amount', 'extracted_reference', 'extracted_sender'];
    const patch = Object.fromEntries(Object.entries(updates).filter(([k]) => allowed.includes(k)));
    const { data, error } = await supabaseAdmin
      .from('verifications')
      .update(patch)
      .eq('id', id)
      .select()
      .single();
    if (error) return res.status(500).json({ error: error.message });
    return res.json(data);
  }

  return res.status(405).end();
}
