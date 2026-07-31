import { requireUser } from '../../lib/auth.js';
import { supabaseAdmin } from '../../lib/supabase.js';
import { resolveCompany } from '../../lib/getCompany.js';
import { sendAdminAlert } from '../../lib/whatsapp.js';
import { checkAndIncrementAlertLimit } from '../../lib/subscription.js';

function safeFileName(name = 'comprobante') {
  return String(name)
    .trim()
    .replace(/\s+/g, '_')
    .replace(/[^a-zA-Z0-9._-]/g, '')
    .slice(0, 80) || 'comprobante';
}

function parseDateInput(value) {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

async function uploadManualReceipt({ companyId, transactionId, base64, filename }) {
  if (!base64) return null;

  const raw = String(base64).trim();
  const match = raw.match(/^data:([^;]+);base64,(.+)$/i);
  const mimeType = match?.[1] || 'image/jpeg';
  const payload = match?.[2] || raw;
  const buffer = Buffer.from(payload, 'base64');
  const ext = (filename && filename.includes('.'))
    ? safeFileName(filename).split('.').pop()
    : (mimeType.split('/')[1] || 'jpg');
  const path = `manual/${companyId}/${transactionId}/${Date.now()}-${safeFileName(filename || 'comprobante')}.${ext}`;

  const { error } = await supabaseAdmin.storage
    .from('comprobantes')
    .upload(path, buffer, { contentType: mimeType, upsert: false });

  if (error) throw error;
  return path;
}

export default async function handler(req, res) {
  const user = await requireUser(req, res);
  if (!user) return;

  req._impersonateUserEmail = user.email;
  const company = await resolveCompany(user.id, req, res);
  if (!company) return;
  const companyId = company.id;

  if (req.method === 'GET') {
    const { from, to, status, employee_id, location_id, limit = 10000, page = 1, pageSize = 25 } = req.query;
    const ps = Number(pageSize);
    const pg = Math.max(1, Number(page));
    const usePaging = Number(limit) <= 100; // exportadores usan limit alto → sin paginar
    const offset = (pg - 1) * ps;

    // Construir queries con los mismos filtros
    const applyFilters = (q, isCount = false) => {
      q = q.eq('company_id', companyId);
      if (status) q = q.eq('status', status);
      if (employee_id) q = q.eq('employee_id', employee_id);
      if (location_id) q = q.eq('location_id', location_id);
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

  if (req.method === 'POST') {
    const {
      transaction_id,
      extracted_amount,
      extracted_reference,
      extracted_sender,
      extracted_date,
      location_id,
      notes,
      comprobante_base64,
      comprobante_filename,
      employee_id,
    } = req.body || {};

    if (!transaction_id) return res.status(400).json({ error: 'transaction_id required' });

    const { data: transaction, error: txErr } = await supabaseAdmin
      .from('transactions')
      .select('id, amount, reference_number, sender_name, transaction_date, status, company_id')
      .eq('id', transaction_id)
      .eq('company_id', companyId)
      .maybeSingle();

    if (txErr) return res.status(500).json({ error: txErr.message });
    if (!transaction) return res.status(404).json({ error: 'Transacción no encontrada' });

    let resolvedLocationId = location_id || null;
    if (employee_id) {
      const { data: employee, error: employeeErr } = await supabaseAdmin
        .from('employees')
        .select('id, location_id')
        .eq('id', employee_id)
        .eq('company_id', companyId)
        .maybeSingle();
      if (employeeErr) return res.status(500).json({ error: employeeErr.message });
      if (!employee) return res.status(400).json({ error: 'Empleado inválido' });
      if (!resolvedLocationId) resolvedLocationId = employee.location_id || null;
    }

    if (resolvedLocationId) {
      const { data: location, error: locationErr } = await supabaseAdmin
        .from('company_locations')
        .select('id')
        .eq('id', resolvedLocationId)
        .eq('company_id', companyId)
        .maybeSingle();
      if (locationErr) return res.status(500).json({ error: locationErr.message });
      if (!location) return res.status(400).json({ error: 'Sede inválida' });
      resolvedLocationId = location.id;
    }

    const verificationPayload = {
      company_id: companyId,
      employee_id: employee_id || null,
      location_id: resolvedLocationId,
      transaction_id: transaction.id,
      status: 'real',
      extracted_amount: extracted_amount !== undefined && extracted_amount !== '' ? Number(extracted_amount) : transaction.amount,
      extracted_reference: extracted_reference !== undefined ? (extracted_reference || null) : (transaction.reference_number || null),
      extracted_sender: extracted_sender !== undefined ? (extracted_sender || null) : (transaction.sender_name || null),
      extracted_date: parseDateInput(extracted_date) || transaction.transaction_date || new Date().toISOString(),
      whatsapp_from: 'manual',
      response_text: 'Confirmación manual desde Ingresos',
      notes: notes || 'Confirmado manualmente desde Ingresos',
    };

    let comprobanteImageUrl = null;
    if (comprobante_base64) {
      try {
        comprobanteImageUrl = await uploadManualReceipt({
          companyId,
          transactionId: transaction.id,
          base64: comprobante_base64,
          filename: comprobante_filename,
        });
      } catch (uploadErr) {
        return res.status(500).json({ error: uploadErr.message });
      }
      verificationPayload.comprobante_image_url = comprobanteImageUrl;
    }

    const { data: existingVerification } = await supabaseAdmin
      .from('verifications')
      .select('id')
      .eq('transaction_id', transaction.id)
      .maybeSingle();

    let verification;
    if (existingVerification?.id) {
      const { data, error } = await supabaseAdmin
        .from('verifications')
        .update(verificationPayload)
        .eq('id', existingVerification.id)
        .select('*, employees(name), transactions(*)')
        .single();
      if (error) return res.status(500).json({ error: error.message });
      verification = data;
    } else {
      const { data, error } = await supabaseAdmin
        .from('verifications')
        .insert(verificationPayload)
        .select('*, employees(name), transactions(*)')
        .single();
      if (error) return res.status(500).json({ error: error.message });
      verification = data;
    }

    const { error: updateTxErr } = await supabaseAdmin
      .from('transactions')
      .update({
        status: 'confirmed',
        reference_number: verificationPayload.extracted_reference || transaction.reference_number || null,
        sender_name: verificationPayload.extracted_sender || transaction.sender_name || null,
        transaction_date: verificationPayload.extracted_date || transaction.transaction_date,
      })
      .eq('id', transaction.id);

    if (updateTxErr) return res.status(500).json({ error: updateTxErr.message });

    return res.status(200).json({ ok: true, verification });
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
            }, { companyId, verificationId: id });
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
