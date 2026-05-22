import { useState } from 'react';
import { api } from '../lib/api.js';
import {
  Download, FileText, FileSpreadsheet, FileJson,
  Printer, CheckCircle2, Clock, XCircle, Users, ShieldCheck, Loader2,
  CalendarCheck, ChevronDown, AlertTriangle
} from 'lucide-react';
import { useSubscription } from '../hooks/useSubscription.js';
import FeatureGate from '../components/FeatureGate.jsx';

// ─── Utilidades ──────────────────────────────────────────────────

function fmtMoney(n) {
  if (!n && n !== 0) return '';
  return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(n);
}
function fmtDate(s) {
  if (!s) return '';
  return new Date(s).toLocaleString('es-CO', {
    timeZone: 'America/Bogota', day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit'
  });
}
const STATUS_LABEL = { real: 'Aprobado', fake: 'Falso', duplicate: 'Duplicado', error: 'Error', pending: 'Pendiente' };

function triggerDownload(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

// ─── Fetchers por tipo ───────────────────────────────────────────

async function fetchVerificaciones({ from, to }) {
  const res = await api('/api/verifications', { query: { from: `${from}T00:00:00`, to: `${to}T23:59:59`, limit: 10000 } });
  return (res.items || []).map((v) => ({
    'Fecha': fmtDate(v.created_at), 'Empleado': v.employees?.name || '—',
    'WhatsApp': v.whatsapp_from || '', 'Monto': fmtMoney(v.extracted_amount),
    'Referencia': v.extracted_reference || '', 'Remitente': v.extracted_sender || '',
    'Estado': STATUS_LABEL[v.status] || v.status,
  }));
}
async function fetchAprobados({ from, to }) {
  const res = await api('/api/verifications', { query: { from: `${from}T00:00:00`, to: `${to}T23:59:59`, status: 'real', limit: 10000 } });
  return (res.items || []).map((v) => ({
    'Fecha': fmtDate(v.created_at), 'Empleado': v.employees?.name || '—',
    'Monto': fmtMoney(v.extracted_amount), 'Referencia': v.extracted_reference || '',
    'Remitente': v.extracted_sender || '', 'Estado': 'Aprobado',
  }));
}
async function fetchPendientes({ from, to }) {
  const res = await api('/api/verifications', { query: { from: `${from}T00:00:00`, to: `${to}T23:59:59`, status: 'pending', limit: 10000 } });
  return (res.items || []).map((v) => ({
    'Fecha': fmtDate(v.created_at), 'Empleado': v.employees?.name || '—',
    'WhatsApp': v.whatsapp_from || '', 'Monto': fmtMoney(v.extracted_amount),
    'Remitente': v.extracted_sender || '', 'Estado': 'Pendiente',
  }));
}
async function fetchFalsos({ from, to }) {
  const [a, b] = await Promise.all([
    api('/api/verifications', { query: { from: `${from}T00:00:00`, to: `${to}T23:59:59`, status: 'fake', limit: 10000 } }),
    api('/api/verifications', { query: { from: `${from}T00:00:00`, to: `${to}T23:59:59`, status: 'duplicate', limit: 10000 } }),
  ]);
  return [...(a.items || []), ...(b.items || [])].map((v) => ({
    'Fecha': fmtDate(v.created_at), 'Empleado': v.employees?.name || '—',
    'WhatsApp': v.whatsapp_from || '', 'Monto Reclamado': fmtMoney(v.extracted_amount),
    'Referencia': v.extracted_reference || '', 'Estado': STATUS_LABEL[v.status] || v.status,
  }));
}
async function fetchResumenEmpleado({ from, to }) {
  const res = await api('/api/verifications', { query: { from: `${from}T00:00:00`, to: `${to}T23:59:59`, limit: 10000 } });
  const map = {};
  (res.items || []).forEach((v) => {
    const k = v.employees?.name || v.whatsapp_from || 'Desconocido';
    if (!map[k]) map[k] = { real: 0, fake: 0, duplicate: 0, pending: 0, total: 0, monto: 0 };
    map[k][v.status] = (map[k][v.status] || 0) + 1;
    map[k].total += 1; map[k].monto += v.extracted_amount || 0;
  });
  return Object.entries(map).map(([nombre, s]) => ({
    'Empleado': nombre, 'Total': s.total, 'Aprobados': s.real,
    'Falsos': s.fake, 'Duplicados': s.duplicate, 'Pendientes': s.pending,
    'Monto Total': fmtMoney(s.monto),
    '% Aprobación': s.total > 0 ? `${Math.round((s.real / s.total) * 100)}%` : '—',
  }));
}

// ─── Exportadores ────────────────────────────────────────────────

function downloadCsv(rows, filename) {
  if (!rows.length) return alert('No hay datos en este rango.');
  const h = Object.keys(rows[0]);
  const esc = (s) => `"${String(s ?? '').replace(/"/g, '""')}"`;
  const blob = new Blob(['\uFEFF' + [h.join(','), ...rows.map((r) => h.map((k) => esc(r[k])).join(','))].join('\n')], { type: 'text/csv;charset=utf-8' });
  triggerDownload(blob, `${filename}.csv`);
}
function downloadExcel(rows, filename, title) {
  if (!rows.length) return alert('No hay datos en este rango.');
  const h = Object.keys(rows[0]);
  const esc = (s) => `<td>${String(s ?? '').replace(/</g, '&lt;')}</td>`;
  const html = `<html xmlns:x='urn:schemas-microsoft-com:office:excel'><head><meta charset="UTF-8">
    <style>body{font-family:Calibri,sans-serif;font-size:11pt}h2{color:#2563eb}table{border-collapse:collapse;width:100%;margin-top:8px}th{background:#2563eb;color:white;padding:6px 10px;text-align:left;font-weight:600}td{padding:5px 10px;border-bottom:1px solid #e2e8f0}tr:nth-child(even) td{background:#f8fafc}</style>
    </head><body><h2>ChatPay — ${title}</h2>
    <p style="color:#64748b;font-size:10pt">Generado: ${new Date().toLocaleString('es-CO', { timeZone: 'America/Bogota' })}</p>
    <table><thead><tr>${h.map((k) => `<th>${k}</th>`).join('')}</tr></thead>
    <tbody>${rows.map((r) => `<tr>${h.map((k) => esc(r[k])).join('')}</tr>`).join('')}</tbody></table></body></html>`;
  triggerDownload(new Blob([html], { type: 'application/vnd.ms-excel;charset=utf-8' }), `${filename}.xls`);
}
function downloadJson(rows, filename) {
  if (!rows.length) return alert('No hay datos en este rango.');
  triggerDownload(new Blob([JSON.stringify(rows, null, 2)], { type: 'application/json' }), `${filename}.json`);
}
function printReport(rows, title, dateRange) {
  if (!rows.length) return alert('No hay datos en este rango.');
  const h = Object.keys(rows[0]);
  const w = window.open('', '_blank');
  w.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8"><title>${title}</title>
    <style>*{box-sizing:border-box;margin:0;padding:0}body{font-family:'Segoe UI',sans-serif;font-size:11px;color:#1e293b;padding:24px}
    h1{font-size:20px;color:#2563eb;margin-bottom:2px}.sub{color:#64748b;font-size:10px;margin-bottom:16px}
    table{width:100%;border-collapse:collapse}th{background:#2563eb;color:white;padding:6px 8px;text-align:left;font-size:10px;font-weight:600}
    td{padding:5px 8px;border-bottom:1px solid #e2e8f0;font-size:10px}tr:nth-child(even) td{background:#f8fafc}
    .footer{margin-top:16px;font-size:9px;color:#94a3b8}@media print{body{padding:0}}</style></head><body>
    <h1>ChatPay — ${title}</h1>
    <div class="sub">Período: ${dateRange} · Generado: ${new Date().toLocaleString('es-CO', { timeZone: 'America/Bogota' })}</div>
    <table><thead><tr>${h.map((k) => `<th>${k}</th>`).join('')}</tr></thead>
    <tbody>${rows.map((r) => `<tr>${h.map((k) => `<td>${r[k] ?? ''}</td>`).join('')}</tr>`).join('')}</tbody></table>
    <div class="footer">Total: ${rows.length} registros · ChatPay © ${new Date().getFullYear()}</div></body></html>`);
  w.document.close(); w.focus(); setTimeout(() => w.print(), 500);
}

// ─── Cierre de Nómina ────────────────────────────────────────────

const PERIODS = [
  { id: 'day',       label: 'Diario',     days: 1  },
  { id: 'week',      label: 'Semanal',    days: 7  },
  { id: 'biweekly',  label: 'Quincenal',  days: 15 },
  { id: 'monthly',   label: 'Mensual',    days: 30 },
];

const NOMINA_STATUS = {
  pagado:   { label: 'Pagado',   cls: 'bg-emerald-100 text-emerald-700 border border-emerald-200', dot: 'bg-emerald-500' },
  pendiente:{ label: 'Pendiente',cls: 'bg-amber-100 text-amber-700 border border-amber-200',       dot: 'bg-amber-500'   },
  rechazado:{ label: 'Rechazado',cls: 'bg-red-100 text-red-600 border border-red-200',             dot: 'bg-red-500'     },
};

function NominaReport() {
  const today = new Date().toISOString().slice(0, 10);
  const [period, setPeriod]   = useState('biweekly');
  const [nomFrom, setNomFrom] = useState(() => {
    const d = new Date(Date.now() - 15 * 86400000);
    return d.toISOString().slice(0, 10);
  });
  const [nomTo, setNomTo]     = useState(today);
  const [result, setResult]   = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState(null);

  function applyPeriod(id) {
    const days = PERIODS.find(p => p.id === id)?.days || 15;
    const t = new Date().toISOString().slice(0, 10);
    const f = new Date(Date.now() - days * 86400000).toISOString().slice(0, 10);
    setPeriod(id); setNomFrom(f); setNomTo(t);
  }

  async function generate() {
    setLoading(true); setError(null); setResult(null);
    try {
      const data = await api('/api/reports', { query: { from: nomFrom, to: nomTo } });
      setResult(data);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  function exportNomina(fmt) {
    if (!result?.rows?.length) return;
    const rows = result.rows.map(r => ({
      'Empleado':      r.name,
      'WhatsApp':      r.whatsapp || '—',
      'Estado nómina': NOMINA_STATUS[r.estado_nomina]?.label || r.estado_nomina,
      'Pagos reales':  r.pagos_reales,
      'Pagos falsos':  r.pagos_falsos,
      'Duplicados':    r.pagos_duplicados,
      'Pendientes':    r.pendientes,
      'Monto total':   fmtMoney(r.monto_total),
      'Último pago':   r.ultimo_pago ? fmtDate(r.ultimo_pago) : '—',
    }));
    const title = `Cierre de Nómina ${nomFrom} al ${nomTo}`;
    const filename = `chatpay-nomina-${nomFrom}_${nomTo}`;
    if (fmt === 'csv')   downloadCsv(rows, filename);
    if (fmt === 'excel') downloadExcel(rows, filename, title);
    if (fmt === 'pdf')   printNomina(result, nomFrom, nomTo);
  }

  function printNomina(data, from, to) {
    const fmtMny = (n) => n != null
      ? new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(n)
      : '—';
    const statusColor = { pagado: '#059669', pendiente: '#d97706', rechazado: '#dc2626' };
    const w = window.open('', '_blank');
    w.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Cierre de Nómina</title>
    <style>*{box-sizing:border-box}body{font-family:'Segoe UI',sans-serif;font-size:11px;color:#1e293b;padding:24px;max-width:960px;margin:0 auto}
    h1{font-size:22px;color:#059669;margin-bottom:2px}.sub{color:#64748b;font-size:10px;margin-bottom:16px}
    .stats{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:20px}
    .stat{background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:10px 14px}
    .stat .val{font-size:20px;font-weight:700;color:#059669}.stat .lbl{font-size:9px;color:#94a3b8;text-transform:uppercase;letter-spacing:.05em}
    table{width:100%;border-collapse:collapse}th{background:#059669;color:white;padding:7px 10px;text-align:left;font-size:10px;font-weight:600}
    td{padding:6px 10px;border-bottom:1px solid #f1f5f9;font-size:10px}tr:hover td{background:#f0fdf4}
    .badge{display:inline-block;padding:2px 8px;border-radius:99px;font-weight:600;font-size:9px}
    @media print{body{padding:0}.noprint{display:none}}</style></head><body>
    <h1>ChatPay — Cierre de Nómina</h1>
    <div class="sub">Período: ${from} al ${to} · Generado: ${new Date().toLocaleString('es-CO', { timeZone: 'America/Bogota' })}</div>
    <div class="stats">
      <div class="stat"><div class="val">${data.summary.total_empleados}</div><div class="lbl">Total empleados</div></div>
      <div class="stat"><div class="val" style="color:#059669">${data.summary.pagados}</div><div class="lbl">Pagados</div></div>
      <div class="stat"><div class="val" style="color:#d97706">${data.summary.pendientes}</div><div class="lbl">Pendientes</div></div>
      <div class="stat"><div class="val" style="color:#dc2626">${data.summary.rechazados}</div><div class="lbl">Rechazados</div></div>
    </div>
    <table><thead><tr><th>Empleado</th><th>Estado</th><th>Pagos reales</th><th>Falsos</th><th>Pendientes</th><th>Monto total</th><th>Último pago</th></tr></thead>
    <tbody>${data.rows.map(r => `<tr>
      <td><strong>${r.name}</strong></td>
      <td><span class="badge" style="background:${statusColor[r.estado_nomina]}22;color:${statusColor[r.estado_nomina]}">${NOMINA_STATUS[r.estado_nomina]?.label || r.estado_nomina}</span></td>
      <td>${r.pagos_reales}</td><td>${r.pagos_falsos}</td><td>${r.pendientes}</td>
      <td><strong>${fmtMny(r.monto_total)}</strong></td>
      <td>${r.ultimo_pago ? new Date(r.ultimo_pago).toLocaleDateString('es-CO') : '—'}</td>
    </tr>`).join('')}</tbody></table>
    <div style="margin-top:16px;font-size:9px;color:#94a3b8">Total nómina verificada: <strong>${fmtMny(data.summary.monto_total)}</strong> · ChatPay © ${new Date().getFullYear()}</div>
    </body></html>`);
    w.document.close(); w.focus(); setTimeout(() => w.print(), 500);
  }

  const summary = result?.summary;

  return (
    <div className="card mt-8 border-2 border-emerald-100 animate-fade-up delay-400">
      {/* Header */}
      <div className="flex items-center gap-3 mb-5">
        <div className="w-10 h-10 rounded-2xl bg-emerald-100 grid place-items-center">
          <CalendarCheck size={20} className="text-emerald-600" />
        </div>
        <div>
          <h2 className="font-semibold text-slate-800">Cierre de Nómina</h2>
          <p className="text-xs text-slate-500">Genera el resumen del período y descarga en PDF, Excel o CSV.</p>
        </div>
      </div>

      {/* Selector de período */}
      <div className="flex flex-wrap gap-2 mb-4">
        {PERIODS.map(p => (
          <button
            key={p.id}
            onClick={() => applyPeriod(p.id)}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors duration-150 ${
              period === p.id
                ? 'bg-emerald-500 text-white border-emerald-500'
                : 'bg-white text-slate-600 border-slate-200 hover:border-emerald-300'
            }`}
          >{p.label}</button>
        ))}
      </div>

      {/* Fechas personalizadas */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        <div>
          <label className="text-xs text-slate-500 mb-1 block">Desde</label>
          <input type="date" className="input w-full" value={nomFrom} max={nomTo}
            onChange={(e) => { setNomFrom(e.target.value); setPeriod(''); }} />
        </div>
        <div>
          <label className="text-xs text-slate-500 mb-1 block">Hasta</label>
          <input type="date" className="input w-full" value={nomTo} min={nomFrom} max={today}
            onChange={(e) => { setNomTo(e.target.value); setPeriod(''); }} />
        </div>
      </div>

      <button onClick={generate} disabled={loading} className="btn btn-primary w-full mb-5">
        {loading
          ? <><Loader2 size={15} className="animate-spin" /> Generando…</>
          : <><CalendarCheck size={15} /> Generar cierre de nómina</>}
      </button>

      {error && (
        <div className="bg-red-50 border border-red-100 text-red-600 rounded-xl px-4 py-3 text-sm mb-4">
          ⚠ {error}
        </div>
      )}

      {/* Resultado */}
      {result && (
        <div className="animate-fade-up">
          {/* KPIs resumen */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
            {[
              { label: 'Empleados', value: summary.total_empleados, color: 'text-slate-700' },
              { label: 'Pagados',   value: summary.pagados,          color: 'text-emerald-600' },
              { label: 'Pendientes',value: summary.pendientes,        color: 'text-amber-600'  },
              { label: 'Rechazados',value: summary.rechazados,        color: 'text-red-500'    },
            ].map(({ label, value, color }) => (
              <div key={label} className="bg-slate-50 rounded-xl p-3 border border-slate-100 text-center">
                <div className={`text-2xl font-bold ${color}`}>{value}</div>
                <div className="text-xs text-slate-500">{label}</div>
              </div>
            ))}
          </div>

          <div className="bg-emerald-50 rounded-xl px-4 py-3 flex items-center justify-between mb-4 border border-emerald-100">
            <span className="text-sm font-medium text-emerald-800">Total nómina verificada</span>
            <span className="text-xl font-bold text-emerald-700">{fmtMoney(summary.monto_total)}</span>
          </div>

          {/* Tabla empleados */}
          <div className="rounded-xl border border-slate-100 overflow-hidden mb-4">
            <table className="w-full text-sm">
              <thead className="bg-emerald-50 border-b border-emerald-100">
                <tr>
                  <th className="px-3 py-2.5 text-left text-xs font-semibold text-emerald-700">Empleado</th>
                  <th className="px-3 py-2.5 text-left text-xs font-semibold text-emerald-700">Estado</th>
                  <th className="px-3 py-2.5 text-right text-xs font-semibold text-emerald-700 hidden sm:table-cell">Pagos ✓</th>
                  <th className="px-3 py-2.5 text-right text-xs font-semibold text-emerald-700 hidden sm:table-cell">Falsos</th>
                  <th className="px-3 py-2.5 text-right text-xs font-semibold text-emerald-700">Monto</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {result.rows.map((r) => {
                  const cfg = NOMINA_STATUS[r.estado_nomina] || NOMINA_STATUS.pendiente;
                  return (
                    <tr key={r.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-3 py-2.5 font-medium text-slate-800">{r.name}</td>
                      <td className="px-3 py-2.5">
                        <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full ${cfg.cls}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />{cfg.label}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 text-right text-slate-600 hidden sm:table-cell">{r.pagos_reales}</td>
                      <td className="px-3 py-2.5 text-right hidden sm:table-cell">
                        {r.pagos_falsos > 0
                          ? <span className="text-red-500 font-medium">{r.pagos_falsos}</span>
                          : <span className="text-slate-300">—</span>}
                      </td>
                      <td className="px-3 py-2.5 text-right font-bold text-emerald-700">{fmtMoney(r.monto_total) || '—'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Botones de exportación */}
          <div className="flex flex-wrap gap-2">
            <button onClick={() => exportNomina('pdf')}   className="btn btn-primary text-sm flex items-center gap-1.5"><Printer size={14} /> PDF</button>
            <button onClick={() => exportNomina('excel')} className="btn btn-ghost text-sm flex items-center gap-1.5"><FileSpreadsheet size={14} /> Excel</button>
            <button onClick={() => exportNomina('csv')}   className="btn btn-ghost text-sm flex items-center gap-1.5"><FileText size={14} /> CSV</button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Config de reportes y formatos ──────────────────────────────

const REPORTS = [
  { id: 'verificaciones',   label: 'Todas las verificaciones', desc: 'Historial completo de comprobantes con su estado.', Icon: ShieldCheck,    color: 'bg-brand-50 text-brand-600 border-brand-100',     fetch: fetchVerificaciones },
  { id: 'aprobados',        label: 'Pagos aprobados',          desc: 'Solo comprobantes verificados como reales.',         Icon: CheckCircle2,   color: 'bg-emerald-50 text-emerald-600 border-emerald-100', fetch: fetchAprobados },
  { id: 'pendientes',       label: 'Pagos pendientes',         desc: 'Empleados sin comprobante enviado aún.',             Icon: Clock,          color: 'bg-amber-50 text-amber-600 border-amber-100',     fetch: fetchPendientes },
  { id: 'falsos',           label: 'Falsos y duplicados',      desc: 'Comprobantes rechazados por fraude o duplicación.',  Icon: XCircle,        color: 'bg-red-50 text-red-500 border-red-100',           fetch: fetchFalsos },
  { id: 'resumen_empleado', label: 'Resumen por empleado',     desc: 'Estadísticas agrupadas: totales, % aprobación.',    Icon: Users,          color: 'bg-purple-50 text-purple-600 border-purple-100',   fetch: fetchResumenEmpleado },
];
const FORMATS = [
  { id: 'csv',   label: 'CSV',   Icon: FileText,       desc: 'Excel, Google Sheets' },
  { id: 'excel', label: 'Excel', Icon: FileSpreadsheet, desc: 'Archivo .xls con estilos' },
  { id: 'json',  label: 'JSON',  Icon: FileJson,        desc: 'Para integraciones' },
  { id: 'pdf',   label: 'PDF',   Icon: Printer,         desc: 'Imprimir / guardar PDF' },
];

// ─── Página principal ────────────────────────────────────────────

export default function Reports() {
  const today = new Date().toISOString().slice(0, 10);
  const monthAgo = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);
  const [from, setFrom] = useState(monthAgo);
  const [to, setTo] = useState(today);
  const [selectedReport, setSelectedReport] = useState('verificaciones');
  const [selectedFormat, setSelectedFormat] = useState('csv');
  const [loading, setLoading] = useState(false);
  const [lastResult, setLastResult] = useState(null);

  const report = REPORTS.find((r) => r.id === selectedReport);

  const handleDownload = async () => {
    setLoading(true); setLastResult(null);
    try {
      const rows = await report.fetch({ from, to });
      const filename = `chatpay-${selectedReport}-${from}_${to}`;
      if (selectedFormat === 'csv')   downloadCsv(rows, filename);
      if (selectedFormat === 'excel') downloadExcel(rows, filename, report.label);
      if (selectedFormat === 'json')  downloadJson(rows, filename);
      if (selectedFormat === 'pdf')   printReport(rows, report.label, `${from} al ${to}`);
      setLastResult({ ok: true, count: rows.length });
    } catch (e) {
      setLastResult({ ok: false, msg: e.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="animate-fade-up">
      <header className="mb-6">
        <h1 className="font-serif text-3xl">Reportes</h1>
        <p className="text-slate-500 text-sm">Genera y descarga reportes en el formato que necesites.</p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

        {/* ─ Selección ─────────────────────────────────── */}
        <div className="lg:col-span-2 space-y-5">

          {/* 1. Período */}
          <div className="card animate-fade-up delay-75">
            <h2 className="font-semibold text-slate-800 mb-4 flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-brand-600 text-white text-xs grid place-items-center font-bold">1</span>
              Selecciona el período
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div><label className="label">Desde</label><input type="date" className="input w-full" value={from} max={to} onChange={(e) => setFrom(e.target.value)} /></div>
              <div><label className="label">Hasta</label><input type="date" className="input w-full" value={to} min={from} max={today} onChange={(e) => setTo(e.target.value)} /></div>
            </div>
            <div className="flex flex-wrap gap-2 mt-3">
              {[['Hoy', 0], ['7 días', 7], ['30 días', 30], ['90 días', 90]].map(([label, days]) => (
                <button key={label} onClick={() => { const t = new Date().toISOString().slice(0,10); setFrom(new Date(Date.now()-days*86400000).toISOString().slice(0,10)); setTo(t); }}
                  className="text-xs px-3 py-1.5 rounded-full border border-slate-200 text-slate-600 hover:bg-slate-100 transition-all active:scale-95">{label}</button>
              ))}
            </div>
          </div>

          {/* 2. Tipo de reporte */}
          <div className="card animate-fade-up delay-150">
            <h2 className="font-semibold text-slate-800 mb-4 flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-brand-600 text-white text-xs grid place-items-center font-bold">2</span>
              Tipo de reporte
            </h2>
            <div className="space-y-2">
              {REPORTS.map((r) => (
                <label key={r.id} className={`flex items-center gap-3 p-3.5 rounded-xl border cursor-pointer transition-all duration-150 ${selectedReport === r.id ? 'border-brand-400 bg-brand-50 shadow-sm' : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'}`}>
                  <input type="radio" name="report" value={r.id} checked={selectedReport === r.id} onChange={() => setSelectedReport(r.id)} className="accent-blue-600 shrink-0" />
                  <div className={`w-8 h-8 rounded-lg border grid place-items-center shrink-0 ${r.color}`}><r.Icon size={15} /></div>
                  <div>
                    <div className="text-sm font-medium text-slate-800">{r.label}</div>
                    <div className="text-xs text-slate-500 mt-0.5">{r.desc}</div>
                  </div>
                </label>
              ))}
            </div>
          </div>

          {/* 3. Formato */}
          <div className="card animate-fade-up delay-225">
            <h2 className="font-semibold text-slate-800 mb-4 flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-brand-600 text-white text-xs grid place-items-center font-bold">3</span>
              Formato de descarga
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {FORMATS.map((f) => (
                <label key={f.id} className={`flex flex-col items-center gap-2 p-3 rounded-xl border cursor-pointer transition-all duration-150 text-center ${selectedFormat === f.id ? 'border-brand-400 bg-brand-50 shadow-sm' : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'}`}>
                  <input type="radio" name="format" value={f.id} checked={selectedFormat === f.id} onChange={() => setSelectedFormat(f.id)} className="sr-only" />
                  <f.Icon size={22} className={selectedFormat === f.id ? 'text-brand-600' : 'text-slate-400'} />
                  <div className="text-sm font-semibold text-slate-800">{f.label}</div>
                  <div className="text-[10px] text-slate-400 leading-tight">{f.desc}</div>
                </label>
              ))}
            </div>
          </div>
        </div>

        {/* ─ Resumen + botón ───────────────────────────── */}
        <div className="animate-fade-up delay-300">
          <div className="card sticky top-6">
            <h2 className="font-semibold text-slate-800 mb-4">Resumen del reporte</h2>
            <div className={`rounded-xl border p-4 mb-4 ${report.color}`}>
              <div className="flex items-center gap-2 mb-1"><report.Icon size={16} /><span className="font-semibold text-sm">{report.label}</span></div>
              <div className="text-xs opacity-75">{report.desc}</div>
            </div>
            <div className="space-y-2 text-sm text-slate-600 mb-5">
              <div className="flex justify-between"><span>Desde</span><span className="font-medium text-slate-800">{from}</span></div>
              <div className="flex justify-between"><span>Hasta</span><span className="font-medium text-slate-800">{to}</span></div>
              <div className="flex justify-between"><span>Formato</span><span className="font-medium text-slate-800 uppercase">{selectedFormat}</span></div>
            </div>
            <button onClick={handleDownload} disabled={loading} className="btn btn-primary w-full group">
              {loading
                ? <><Loader2 size={16} className="animate-spin" /> Generando…</>
                : <><Download size={16} className="transition-transform group-hover:-translate-y-0.5" /> Descargar reporte</>}
            </button>
            {lastResult && (
              <div className={`mt-3 text-sm rounded-lg px-3 py-2 animate-fade-in ${lastResult.ok ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' : 'bg-red-50 text-red-600 border border-red-100'}`}>
                {lastResult.ok ? `✓ ${lastResult.count} registros exportados` : `⚠ ${lastResult.msg}`}
              </div>
            )}
            <p className="text-[11px] text-slate-400 mt-4 text-center">Solo se incluyen datos de tu empresa.</p>
          </div>
        </div>
      </div>

      {/* ── Cierre de Nómina ── */}
      <NominaGated />
    </div>
  );
}

function NominaGated() {
  const { can } = useSubscription();
  return (
    <FeatureGate allowed={can('nomina')} requiredPlan="pro" feature="Cierre de Nómina">
      <NominaReport />
    </FeatureGate>
  );
}
