import { requireUser } from '../../lib/auth.js';
import { supabaseAdmin } from '../../lib/supabase.js';
import { requireCompany } from '../../lib/getCompany.js';
import { checkLocationLimit, checkSubscriptionActive } from '../../lib/subscription.js';

export default async function handler(req, res) {
  const user = await requireUser(req, res);
  if (!user) return;

  const company = await requireCompany(user.id, res);
  if (!company) return;
  const companyId = company.id;

  // GET — listar sedes de la empresa
  if (req.method === 'GET') {
    const { data, error } = await supabaseAdmin
      .from('company_locations')
      .select('*')
      .eq('company_id', companyId)
      .order('created_at', { ascending: true });
    if (error) return res.status(500).json({ error: error.message });

    // Contar empleados por sede
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
    return res.json({ items, max_locations: company.max_locations });
  }

  // POST — crear nueva sede
  if (req.method === 'POST') {
    const { name, city, address } = req.body || {};
    if (!name) return res.status(400).json({ error: 'name requerido' });

    const limitCheck = await checkLocationLimit(companyId);
    if (!limitCheck.ok) return res.status(403).json({ error: limitCheck.reason, limitReached: limitCheck.limitReached });

    const { data, error } = await supabaseAdmin
      .from('company_locations')
      .insert({ company_id: companyId, name: name.trim(), city: city?.trim() || null, address: address?.trim() || null })
      .select()
      .single();
    if (error) return res.status(400).json({ error: error.message });
    return res.json(data);
  }

  // PATCH — editar sede
  if (req.method === 'PATCH') {
    const { id, ...updates } = req.body || {};
    if (!id) return res.status(400).json({ error: 'id requerido' });
    const allowed = ['name', 'city', 'address', 'is_active'];
    const patch = Object.fromEntries(Object.entries(updates).filter(([k]) => allowed.includes(k)));
    if (!Object.keys(patch).length) return res.status(400).json({ error: 'Sin campos válidos para actualizar' });

    const { data, error } = await supabaseAdmin
      .from('company_locations')
      .update(patch)
      .eq('id', id)
      .eq('company_id', companyId)
      .select()
      .single();
    if (error) return res.status(400).json({ error: error.message });
    return res.json(data);
  }

  // DELETE — desactivar sede (no borrar para preservar historial)
  if (req.method === 'DELETE') {
    const { id } = req.body || {};
    if (!id) return res.status(400).json({ error: 'id requerido' });

    // No se puede eliminar si tiene empleados activos
    const { count } = await supabaseAdmin
      .from('employees')
      .select('id', { count: 'exact', head: true })
      .eq('location_id', id)
      .eq('is_active', true);

    if (count > 0) {
      return res.status(409).json({ error: `Esta sede tiene ${count} empleado${count === 1 ? '' : 's'} activo${count === 1 ? '' : 's'}. Reasígnalos antes de desactivarla.` });
    }

    const { error } = await supabaseAdmin
      .from('company_locations')
      .update({ is_active: false })
      .eq('id', id)
      .eq('company_id', companyId);
    if (error) return res.status(400).json({ error: error.message });
    return res.json({ ok: true });
  }

  res.status(405).json({ error: 'Method not allowed' });
}
