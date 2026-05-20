import { useState } from 'react';
import { api } from '../lib/api.js';
import {
  Download, FileText, FileSpreadsheet, FileJson,
  Printer, CheckCircle2, Clock, XCircle, Users, ShieldCheck, Loader2
} from 'lucide-react';

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
            <div className="grid grid-cols-2 gap-4">
              <div><label className="label">Desde</label><input type="date" className="input" value={from} max={to} onChange={(e) => setFrom(e.target.value)} /></div>
              <div><label className="label">Hasta</label><input type="date" className="input" value={to} min={from} max={today} onChange={(e) => setTo(e.target.value)} /></div>
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
    </div>
  );
}

