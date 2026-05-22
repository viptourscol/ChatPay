import { requireUser } from '../../lib/auth.js';
import { supabaseAdmin } from '../../lib/supabase.js';
import { requireCompany } from '../../lib/getCompany.js';
import { sendAdminAlert } from '../../lib/whatsapp.js';
import { checkAndIncrementAlertLimit } from '../../lib/subscription.js';

export default async function handler(req, res) {
  const user = await requireUser(req, res);
  if (!user) return;

  const company = await requireCompany(user.id, res);
  if (!company) return;
  const companyId = company.id;

  if (req.method === 'GET') {
    const { from, to, status, employee_id, limit = 10000, page = 1, pageSize = 25 } = req.query;
    const ps = Number(pageSize);
    const pg = Math.max(1, Number(page));
    const usePaging = Number(limit) <= 100; // exportadores usan limit alto → sin paginar
    const offset = (pg - 1) * ps;

    // Construir queries con los mismos filtros
    const applyFilters = (q, isCount = false) => {
      q = q.eq('company_id', companyId);
      if (status) q = q.eq('status', status);
      if (employee_id) q = q.eq('employee_id', employee_id);
      if (from) q = q.gte('created_at', from);
      if (to) q = q.lte('created_at', to);
      return q;
    };

    let q = supabaseAdmin
      .from('verifications')
      .select('*, employees(name, whatsapp_number), transactions(*)')
      .order('created_at', { ascending: false });
    q = applyFilters(q);

    if (usePaging) {
      q = q.range(offset, offset + ps - 1);
    } else {
      q = q.limit(Number(limit));
    }

    let countQ = supabaseAdmin.from('verifications').select('id', { count: 'exact', head: true });
    countQ = applyFilters(countQ);

    const [{ data, error }, { count }] = await Promise.all([q, countQ]);
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
    return res.json({ items: withUrls, total: count || 0, pageSize: ps, page: pg });
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

    // Alerta al admin si el pago fue marcado como falso o duplicado
    if ((updates.status === 'fake' || updates.status === 'duplicate') && data) {
      try {
        const { data: companyData } = await supabaseAdmin
          .from('companies')
          .select('admin_whatsapp')
          .eq('id', companyId)
          .maybeSingle();
        if (companyData?.admin_whatsapp) {
          // Verificar límite de alertas del plan
          const alertCheck = await checkAndIncrementAlertLimit(companyId);
          if (!alertCheck.ok) {
            console.log(`[verifications/alert] Límite de alertas alcanzado para empresa ${companyId}: ${alertCheck.reason}`);
          } else {
            const fmtMoney = (n) => n != null
              ? new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(n)
              : '—';
            await sendAdminAlert(companyData.admin_whatsapp, {
              empleado: data.employees?.name || data.whatsapp_from || '—',
              monto: fmtMoney(data.extracted_amount),
              estado: updates.status,
              referencia: data.extracted_reference || '—',
              fecha: data.created_at
                ? new Date(data.created_at).toLocaleString('es-CO', { timeZone: 'America/Bogota' })
                : '—',
            });
          }
        }
      } catch (alertErr) {
        console.warn('[verifications/alert] Error enviando alerta WA:', alertErr.message);
      }
    }

    return res.json(data);
  }

  return res.status(405).end();
}
