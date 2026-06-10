import { requireUser } from '../../lib/auth.js';
import { supabaseAdmin } from '../../lib/supabase.js';
import { resolveCompany } from '../../lib/getCompany.js';

/**
 * GET /api/reports/nomina
 * Parámetros: period (day|week|biweekly|monthly), from, to
 * Devuelve resumen de nómina: quién pagó, cuánto, estado, pendientes
 */
export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).end();

  const user = await requireUser(req, res);
  if (!user) return;
  req._impersonateUserEmail = user.email;
  const company = await resolveCompany(user.id, req, res);
  if (!company) return;

  const { from, to } = req.query;
  if (!from || !to) return res.status(400).json({ error: 'from y to son requeridos' });

  const fromDt = `${from}T00:00:00`;
  const toDt   = `${to}T23:59:59`;

  // 1. Todos los empleados activos de la empresa
  const { data: employees } = await supabaseAdmin
    .from('employees')
    .select('id, name, whatsapp_number')
    .eq('company_id', company.id)
    .eq('is_active', true)
    .order('name');

  // 2. Verificaciones del período
  const { data: verifications } = await supabaseAdmin
    .from('verifications')
    .select('employee_id, status, extracted_amount, extracted_reference, created_at, whatsapp_from')
    .eq('company_id', company.id)
    .gte('created_at', fromDt)
    .lte('created_at', toDt);

  // 3. Construir reporte por empleado
  const empMap = {};
  for (const e of (employees || [])) {
    empMap[e.id] = {
      id: e.id,
      name: e.name,
      whatsapp: e.whatsapp_number,
      pagos_reales: 0,
      pagos_falsos: 0,
      pagos_duplicados: 0,
      pendientes: 0,
      monto_total: 0,
      ultimo_pago: null,
      estado_nomina: 'pendiente', // pendiente | pagado | rechazado
    };
  }

  for (const v of (verifications || [])) {
    const emp = empMap[v.employee_id];
    if (!emp) continue;
    if (v.status === 'real') {
      emp.pagos_reales++;
      emp.monto_total += v.extracted_amount || 0;
      if (!emp.ultimo_pago || v.created_at > emp.ultimo_pago) emp.ultimo_pago = v.created_at;
    } else if (v.status === 'fake')      emp.pagos_falsos++;
    else if (v.status === 'duplicate')   emp.pagos_duplicados++;
    else if (v.status === 'pending')     emp.pendientes++;
  }

  // Determinar estado de nómina de cada empleado
  for (const emp of Object.values(empMap)) {
    if (emp.pagos_reales > 0)    emp.estado_nomina = 'pagado';
    else if (emp.pagos_falsos > 0 || emp.pagos_duplicados > 0) emp.estado_nomina = 'rechazado';
    else                          emp.estado_nomina = 'pendiente';
  }

  const rows = Object.values(empMap);
  const summary = {
    total_empleados: rows.length,
    pagados:   rows.filter(r => r.estado_nomina === 'pagado').length,
    pendientes: rows.filter(r => r.estado_nomina === 'pendiente').length,
    rechazados: rows.filter(r => r.estado_nomina === 'rechazado').length,
    monto_total: rows.reduce((s, r) => s + r.monto_total, 0),
    periodo: { from, to },
  };

  return res.json({ summary, rows });
}
