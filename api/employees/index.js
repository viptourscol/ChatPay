import { requireUser } from '../../lib/auth.js';
import { supabaseAdmin } from '../../lib/supabase.js';
import { requireCompany } from '../../lib/getCompany.js';
import { checkEmployeeLimit, checkLocationLimit, PLANS } from '../../lib/subscription.js';

export default async function handler(req, res) {
  const user = await requireUser(req, res);
  if (!user) return;

  const company = await requireCompany(user.id, res);
  if (!company) return;
  const companyId = company.id;

  // ── Sub-recurso: sedes ──────────────────────────────────────────
  if (req.query.resource === 'locations') {
    if (req.method === 'GET') {
      const { data, error } = await supabaseAdmin
        .from('company_locations')
        .select('*')
        .eq('company_id', companyId)
        .order('created_at', { ascending: true });
      const maxLoc = company.max_locations ?? PLANS[company.plan]?.maxLocations ?? 1;
      if (error) return res.json({ items: [], max_locations: maxLoc });

      const locationIds = data.map(l => l.id);
      const { data: empCounts } = await supabaseAdmin
        .from('employees')
        .select('location_id')
        .eq('company_id', companyId)
        .eq('is_active', true)
        .in('location_id', locationIds.length ? locationIds : ['none']);

      const countMap = {};
      for (const e of empCounts || []) {
        countMap[e.location_id] = (countMap[e.location_id] || 0) + 1;
      }
      const items = data.map(l => ({ ...l, employee_count: countMap[l.id] || 0 }));
      const maxLoc = company.max_locations ?? PLANS[company.plan]?.maxLocations ?? 1;
      return res.json({ items, max_locations: maxLoc });
    }

    if (req.method === 'POST') {
      const { name, city, address } = req.body || {};
      if (!name) return res.status(400).json({ error: 'name requerido' });
      const limitCheck = await checkLocationLimit(companyId);
      if (!limitCheck.ok) return res.status(403).json({ error: limitCheck.reason, limitReached: limitCheck.limitReached });
      const { data, error } = await supabaseAdmin
        .from('company_locations')
        .insert({ company_id: companyId, name: name.trim(), city: city?.trim() || null, address: address?.trim() || null })
        .select().single();
      if (error) return res.status(400).json({ error: error.message });
      return res.json(data);
    }

    if (req.method === 'PATCH') {
      const { id, ...updates } = req.body || {};
      if (!id) return res.status(400).json({ error: 'id requerido' });
      const allowed = ['name', 'city', 'address', 'is_active'];
      const patch = Object.fromEntries(Object.entries(updates).filter(([k]) => allowed.includes(k)));
      const { data, error } = await supabaseAdmin
        .from('company_locations')
        .update(patch).eq('id', id).eq('company_id', companyId)
        .select().single();
      if (error) return res.status(400).json({ error: error.message });
      return res.json(data);
    }

    if (req.method === 'DELETE') {
      const { id } = req.body || {};
      if (!id) return res.status(400).json({ error: 'id requerido' });
      const { count } = await supabaseAdmin
        .from('employees').select('id', { count: 'exact', head: true })
        .eq('location_id', id).eq('is_active', true);
      if (count > 0) return res.status(409).json({ error: `Esta sede tiene ${count} empleado${count === 1 ? '' : 's'} activo${count === 1 ? '' : 's'}. Reasígnalos antes de desactivarla.` });
      const { error } = await supabaseAdmin
        .from('company_locations').update({ is_active: false }).eq('id', id).eq('company_id', companyId);
      if (error) return res.status(400).json({ error: error.message });
      return res.json({ ok: true });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  }

  // ── Empleados ───────────────────────────────────────────────────
  if (req.method === 'GET') {
    const { data, error } = await supabaseAdmin
      .from('employees')
      .select('*')
      .eq('company_id', companyId)
      .order('created_at', { ascending: false });
    if (error) return res.status(500).json({ error: error.message });
    return res.json({ items: data });
  }

  if (req.method === 'POST') {
    const { name, whatsapp_number, location_id } = req.body || {};
    if (!name || !whatsapp_number) return res.status(400).json({ error: 'name y whatsapp_number requeridos' });

    const limitCheck = await checkEmployeeLimit(companyId);
    if (!limitCheck.ok) return res.status(403).json({ error: limitCheck.reason, limitReached: limitCheck.limitReached });

    const number = String(whatsapp_number).trim().startsWith('+')
      ? String(whatsapp_number).trim()
      : `+${String(whatsapp_number).trim()}`;

    let resolvedLocationId = location_id || null;
    if (location_id) {
      const { data: loc } = await supabaseAdmin
        .from('company_locations').select('id').eq('id', location_id).eq('company_id', companyId).maybeSingle();
      if (!loc) resolvedLocationId = null;
    }
    if (!resolvedLocationId) {
      const { data: firstLoc } = await supabaseAdmin
        .from('company_locations').select('id').eq('company_id', companyId).eq('is_active', true)
        .order('created_at', { ascending: true }).limit(1).maybeSingle();
      resolvedLocationId = firstLoc?.id || null;
    }

    const { data, error } = await supabaseAdmin
      .from('employees')
      .insert({ name, whatsapp_number: number, company_id: companyId, location_id: resolvedLocationId })
      .select().single();
    if (error) return res.status(400).json({ error: error.message });
    return res.json(data);
  }

  if (req.method === 'PATCH') {
    const { id, ...updates } = req.body || {};
    if (!id) return res.status(400).json({ error: 'id required' });
    const allowed = ['name', 'whatsapp_number', 'is_active', 'location_id'];
    const patch = Object.fromEntries(Object.entries(updates).filter(([k]) => allowed.includes(k)));
    const { data, error } = await supabaseAdmin
      .from('employees').update(patch).eq('id', id).eq('company_id', companyId).select().single();
    if (error) return res.status(400).json({ error: error.message });
    return res.json(data);
  }

  if (req.method === 'DELETE') {
    const { id } = req.query;
    if (!id) return res.status(400).json({ error: 'id required' });
    const { error } = await supabaseAdmin
      .from('employees').delete().eq('id', id).eq('company_id', companyId);
    if (error) return res.status(400).json({ error: error.message });
    return res.json({ ok: true });
  }

  return res.status(405).end();
}
