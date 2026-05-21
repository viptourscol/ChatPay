import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api.js';
import {
  CheckCircle2, XCircle, AlertTriangle, Clock, AlertCircle,
  ClipboardList, DollarSign, Inbox, RefreshCw, ChevronRight, X,
  Maximize2, ExternalLink, Filter, ChevronLeft
} from 'lucide-react';

const _today = new Date();
const todayISO = _today.toISOString().slice(0, 10);
const todayFull = `${todayISO}T00:00:00`;
const todayEnd  = `${todayISO}T23:59:59`;
const PAGE_SIZE = 25;

const STATUS_CONFIG = {
  real:      { label: 'Verificado',  Icon: CheckCircle2,   cls: 'bg-emerald-50 text-emerald-700 border border-emerald-200', iconCls: 'text-emerald-600' },
  fake:      { label: 'Falso',       Icon: XCircle,        cls: 'bg-red-50 text-red-700 border border-red-200',             iconCls: 'text-red-500' },
  duplicate: { label: 'Duplicado',   Icon: AlertTriangle,  cls: 'bg-amber-50 text-amber-700 border border-amber-200',       iconCls: 'text-amber-500' },
  pending:   { label: 'Pendiente',   Icon: Clock,          cls: 'bg-slate-100 text-slate-600 border border-slate-200',      iconCls: 'text-slate-400' },
  error:     { label: 'Error',       Icon: AlertCircle,    cls: 'bg-slate-100 text-slate-600 border border-slate-200',      iconCls: 'text-slate-400' },
};

function fmtMoney(n) {
  if (n == null) return '—';
  return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(n);
}
function fmtMoneyCompact(n) {
  if (n == null) return '—';
  if (n >= 1_000_000_000) return `$${(n / 1_000_000_000).toFixed(1).replace('.0', '')}B`;
  if (n >= 1_000_000)     return `$${(n / 1_000_000).toFixed(1).replace('.0', '')}M`;
  if (n >= 100_000)       return `$${(n / 1_000).toFixed(0)}K`;
  return fmtMoney(n);
}
function fmtDate(s) {
  if (!s) return '—';
  return new Date(s).toLocaleString('es-CO', { timeZone: 'America/Bogota', day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}
function fmtDateShort(s) {
  if (!s) return '—';
  return new Date(s).toLocaleString('es-CO', { timeZone: 'America/Bogota', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
}
function initials(name) {
  if (!name) return '?';
  return name.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase();
}

function StatusBadge({ status }) {
  const s = STATUS_CONFIG[status] || STATUS_CONFIG.pending;
  const { Icon } = s;
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium ${s.cls}`}>
      <Icon size={12} className={s.iconCls} />
      {s.label}
    </span>
  );
}

function SummaryBar({ items = [] }) {
  const real = items.filter(v => v.status === 'real').length;
  const fake = items.filter(v => v.status === 'fake').length;
  const dup  = items.filter(v => v.status === 'duplicate').length;
  const totalAmount = items.filter(v => v.status === 'real')
    .reduce((s, v) => s + Number(v.extracted_amount || 0), 0);
  const montoStr = fmtMoneyCompact(totalAmount);

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
      {[
        { Icon: ClipboardList, label: 'Total',            value: items.length, color: 'bg-slate-100',   iconCls: 'text-slate-500',   valueClass: 'text-slate-900' },
        { Icon: CheckCircle2,  label: 'Verificados',      value: real,         color: 'bg-emerald-50',  iconCls: 'text-emerald-600', valueClass: 'text-emerald-700' },
        { Icon: XCircle,       label: 'Falsos / Dup.',    value: fake + dup,   color: 'bg-red-50',      iconCls: 'text-red-500',     valueClass: 'text-red-600' },
        { Icon: DollarSign,    label: 'Monto verificado', value: montoStr,     color: 'bg-brand-50',    iconCls: 'text-brand-600',   valueClass: 'text-brand-700', isMoney: true },
      ].map(({ Icon, label, value, color, iconCls, valueClass, isMoney }) => {
        const str = String(value ?? '');
        const fs = isMoney ? (str.length > 10 ? 'text-base' : str.length > 7 ? 'text-lg' : 'text-xl') : 'text-xl';
        return (
          <div key={label} className="card flex items-center gap-3 py-3">
            <div className={`w-10 h-10 rounded-xl ${color} grid place-items-center flex-shrink-0`}>
              <Icon size={20} className={iconCls} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-xs text-slate-500 truncate">{label}</div>
              <div className={`${fs} font-semibold leading-tight break-all ${valueClass || 'text-slate-900'}`}>{value}</div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Pagination ───────────────────────────────────────────────────
function Pagination({ page, total, pageSize, onChange }) {
  const totalPages = Math.ceil(total / pageSize) || 1;
  if (totalPages <= 1) return null;
  const from = (page - 1) * pageSize + 1;
  const to   = Math.min(page * pageSize, total);
  const pages = [];
  if (totalPages <= 5) { for (let i = 1; i <= totalPages; i++) pages.push(i); }
  else if (page <= 3) pages.push(1, 2, 3, 4, 5);
  else if (page >= totalPages - 2) { for (let i = totalPages - 4; i <= totalPages; i++) pages.push(i); }
  else pages.push(page - 2, page - 1, page, page + 1, page + 2);
  return (
    <div className="flex items-center justify-between mt-4 flex-wrap gap-3">
      <span className="text-sm text-slate-500">{from}–{to} de {total} verificaciones</span>
      <div className="flex items-center gap-1">
        <button disabled={page <= 1} onClick={() => onChange(page - 1)}
          className="w-8 h-8 rounded-lg border border-slate-200 flex items-center justify-center text-slate-500 hover:bg-slate-50 disabled:opacity-30 transition">
          <ChevronLeft size={15} />
        </button>
        {pages.map(p => (
          <button key={p} onClick={() => onChange(p)}
            className={`w-8 h-8 rounded-lg border text-sm font-medium transition ${
              p === page ? 'border-brand-600 bg-brand-600 text-white' : 'border-slate-200 text-slate-600 hover:bg-slate-50'
            }`}>{p}</button>
        ))}
        <button disabled={page >= totalPages} onClick={() => onChange(page + 1)}
          className="w-8 h-8 rounded-lg border border-slate-200 flex items-center justify-center text-slate-500 hover:bg-slate-50 disabled:opacity-30 transition">
          <ChevronRight size={15} />
        </button>
      </div>
    </div>
  );
}

// ─── Lightbox ────────────────────────────────────────────────────
function Lightbox({ src, onClose }) {
  if (!src) return null;
  return (
    <div
      className="fixed inset-0 bg-black/90 z-[60] flex flex-col items-center justify-center p-4"
      onClick={onClose}
    >
      <div className="absolute top-4 right-4 flex gap-2">
        <a
          href={src}
          target="_blank"
          rel="noreferrer"
          onClick={e => e.stopPropagation()}
          className="flex items-center gap-1.5 bg-white/10 hover:bg-white/20 transition text-white text-xs px-3 py-1.5 rounded-lg"
        >
          <ExternalLink size={13} /> Abrir original
        </a>
        <button
          onClick={onClose}
          className="bg-white/10 hover:bg-white/20 transition text-white p-1.5 rounded-lg"
        >
          <X size={18} />
        </button>
      </div>
      <img
        src={src}
        alt="comprobante ampliado"
        className="max-w-full max-h-[90vh] object-contain rounded-xl shadow-2xl"
        onClick={e => e.stopPropagation()}
      />
      <p className="text-white/40 text-xs mt-3">Haz clic fuera de la imagen para cerrar</p>
    </div>
  );
}

// ─── Detail Modal ─────────────────────────────────────────────────
function DetailModal({ v, onClose }) {
  const [lightbox, setLightbox] = useState(null);
  if (!v) return null;
  const s = STATUS_CONFIG[v.status] || STATUS_CONFIG.pending;
  const headerBg = v.status === 'real' ? 'bg-emerald-50' : v.status === 'fake' ? 'bg-red-50' : 'bg-slate-50';
  const { Icon: StatusIcon } = s;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm grid place-items-center p-3 z-50" onClick={onClose}>
      <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl overflow-hidden flex flex-col max-h-[92vh]" onClick={e => e.stopPropagation()}>
        <div className={`px-5 py-4 flex items-center justify-between shrink-0 ${headerBg}`}>
          <div className="flex items-center gap-3">
            <StatusIcon size={28} className={s.iconCls} />
            <div>
              <div className="font-semibold text-slate-900">Comprobante {s.label}</div>
              <div className="text-xs text-slate-500">{fmtDate(v.created_at)}</div>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition"><X size={18} /></button>
        </div>

        <div className="px-5 py-5 space-y-4 overflow-y-auto">
          <div className="text-center py-3 rounded-xl bg-slate-50">
            <div className="text-xs text-slate-500 mb-1">Monto del comprobante</div>
            <div className="text-3xl font-bold text-slate-900">{fmtMoney(v.extracted_amount)}</div>
            {v.extracted_reference && (
              <div className="text-xs text-slate-400 font-mono mt-1">Ref: {v.extracted_reference}</div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="rounded-lg bg-slate-50 p-3">
              <div className="text-xs text-slate-400 mb-0.5">Empleado</div>
              <div className="font-medium">{v.employees?.name || '—'}</div>
              <div className="text-xs text-slate-400">{v.whatsapp_from}</div>
            </div>
            <div className="rounded-lg bg-slate-50 p-3">
              <div className="text-xs text-slate-400 mb-0.5">Remitente OCR</div>
              <div className="font-medium">{v.extracted_sender || '—'}</div>
            </div>
            <div className="rounded-lg bg-slate-50 p-3">
              <div className="text-xs text-slate-400 mb-0.5">Fecha comprobante</div>
              <div className="font-medium">{v.extracted_date ? fmtDate(v.extracted_date) : '—'}</div>
            </div>
            <div className="rounded-lg bg-slate-50 p-3">
              <div className="text-xs text-slate-400 mb-0.5">ID verificación</div>
              <div className="font-mono text-xs">…{v.id?.slice(-12)}</div>
            </div>
          </div>

          {v.transactions && (
            <div className="rounded-xl bg-emerald-50 border border-emerald-100 p-4">
              <div className="text-xs font-semibold text-emerald-800 mb-2 uppercase tracking-wide">Transferencia real vinculada</div>
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-semibold text-slate-900">{fmtMoney(v.transactions.amount)}</div>
                  <div className="text-sm text-slate-600">{v.transactions.sender_name || 'Sin nombre'}</div>
                </div>
                <div className="text-right text-xs text-slate-500">{fmtDate(v.transactions.transaction_date)}</div>
              </div>
            </div>
          )}

          {v.comprobante_signed_url && (
            <div>
              <div className="text-xs text-slate-400 mb-2">Imagen del comprobante</div>
              <div className="relative group cursor-zoom-in" onClick={() => setLightbox(v.comprobante_signed_url)}>
                <img
                  src={v.comprobante_signed_url}
                  alt="comprobante"
                  className="w-full max-h-64 object-contain rounded-xl border border-slate-100 bg-slate-50 transition group-hover:brightness-90"
                />
                <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition">
                  <div className="bg-black/60 text-white rounded-xl px-4 py-2 flex items-center gap-2 text-sm font-medium backdrop-blur-sm">
                    <Maximize2 size={16} /> Ver en grande
                  </div>
                </div>
              </div>
            </div>
          )}

          {lightbox && <Lightbox src={lightbox} onClose={() => setLightbox(null)} />}

          {v.notes && (
            <div className="text-xs text-slate-500 bg-slate-50 rounded-lg px-3 py-2">
              <span className="font-medium">Nota:</span> {v.notes}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function Verifications() {
  const [filters, setFilters]   = useState({ status: '', from: todayFull, to: todayEnd });
  const [applied, setApplied]   = useState({ from: todayFull, to: todayEnd });
  const [page, setPage]         = useState(1);
  const [selected, setSelected] = useState(null);
  const [showFilters, setShowFilters] = useState(false);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['verifications', applied, page],
    queryFn: () => api('/api/verifications', { query: { ...applied, page, pageSize: PAGE_SIZE } })
  });

  const items = data?.items || [];
  const total = data?.total || 0;

  function apply() { setPage(1); setApplied({ ...filters }); }
  function reset() {
    const def = { status: '', from: todayFull, to: todayEnd };
    setFilters(def); setApplied({ from: todayFull, to: todayEnd }); setPage(1);
  }
  const hasFilters = applied.status || applied.from !== todayFull || applied.to !== todayEnd;

  const todayLabel = new Date().toLocaleDateString('es-CO', { timeZone: 'America/Bogota', day: '2-digit', month: 'long', year: 'numeric' });

  return (
    <div>
      <header className="mb-5 flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-serif text-2xl md:text-3xl">Verificaciones</h1>
          <p className="text-slate-500 text-sm">{hasFilters ? 'Filtro activo' : `Hoy · ${todayLabel}`}</p>
        </div>
        <div className="flex gap-2 w-full md:w-auto">
          <button
            onClick={() => setShowFilters(v => !v)}
            className={`btn text-sm flex items-center gap-1.5 flex-1 md:flex-none justify-center ${
              showFilters ? 'btn-primary' : 'btn-ghost'
            }`}
          >
            <Filter size={14} /> Filtros
            {hasFilters && <span className="bg-brand-600 text-white rounded-full w-4 h-4 text-[10px] grid place-items-center font-bold">!</span>}
          </button>
          <button onClick={() => refetch()} className="btn btn-ghost text-sm flex items-center gap-1.5 shrink-0">
            <RefreshCw size={14} /><span className="hidden sm:inline">Refrescar</span>
          </button>
        </div>
      </header>

      {showFilters && (
        <div className="card mb-5 border border-brand-100 bg-brand-50/20 animate-fade-up">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
            <div>
              <label className="text-xs text-slate-500 mb-1 block">Estado</label>
              <select className="input w-full text-sm" value={filters.status}
                onChange={(e) => setFilters({ ...filters, status: e.target.value })}>
                <option value="">Todos</option>
                <option value="real">Verificados</option>
                <option value="fake">Falsos</option>
                <option value="duplicate">Duplicados</option>
                <option value="pending">Pendientes</option>
                <option value="error">Errores</option>
              </select>
            </div>
            <div>
              <label className="text-xs text-slate-500 mb-1 block">Desde</label>
              <input type="datetime-local" className="input w-full text-sm"
                value={filters.from.slice(0, 16)}
                onChange={(e) => setFilters({ ...filters, from: e.target.value })} />
            </div>
            <div>
              <label className="text-xs text-slate-500 mb-1 block">Hasta</label>
              <input type="datetime-local" className="input w-full text-sm"
                value={filters.to.slice(0, 16)}
                onChange={(e) => setFilters({ ...filters, to: e.target.value })} />
            </div>
          </div>
          <div className="flex flex-wrap gap-1.5 mt-3">
            {[['Hoy', 0, 0], ['Ayer', 1, 1], ['7 días', 7, 0], ['30 días', 30, 0]].map(([lbl, dFrom, dTo]) => (
              <button key={lbl} type="button"
                onClick={() => {
                  const f = new Date(); f.setDate(f.getDate() - dFrom); f.setHours(0, 0, 0, 0);
                  const t = new Date(); t.setDate(t.getDate() - dTo); t.setHours(23, 59, 59, 0);
                  const fmt = (d) => d.toISOString().slice(0, 16);
                  setFilters(fv => ({ ...fv, from: fmt(f), to: fmt(t) }));
                }}
                className="text-xs px-2.5 py-1 rounded-full bg-white border border-slate-200 text-slate-600 hover:border-brand-300 hover:text-brand-700 transition"
              >{lbl}</button>
            ))}
          </div>
          <div className="flex gap-2 mt-4">
            <button onClick={apply} className="btn btn-primary text-sm">Aplicar</button>
            <button onClick={reset} className="btn btn-ghost text-sm flex items-center gap-1"><X size={13} /> Restablecer</button>
          </div>
        </div>
      )}

      {!isLoading && <SummaryBar items={items} />}

      {/* Tabla — visible solo en md+ */}
      <div className="card overflow-hidden p-0 hidden md:block">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 border-b border-slate-100 text-left">
            <tr>
              <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Fecha</th>
              <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Empleado</th>
              <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Remitente</th>
              <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Monto</th>
              <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Estado</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {isLoading && (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-slate-400">
                  <div className="flex flex-col items-center gap-2">
                    <div className="w-6 h-6 border-2 border-brand-400 border-t-transparent rounded-full animate-spin" />
                    Cargando…
                  </div>
                </td>
              </tr>
            )}
            {!isLoading && items.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-12 text-center">
                  <Inbox size={40} className="mx-auto text-slate-300 mb-2" />
                  <div className="text-slate-400 text-sm">Sin verificaciones para el período seleccionado</div>
                  {hasFilters && <button onClick={reset} className="mt-2 text-xs text-brand-600 underline">Ver hoy</button>}
                </td>
              </tr>
            )}
            {items.map((v) => (
              <tr
                key={v.id}
                className="hover:bg-slate-50 transition-colors cursor-pointer"
                onClick={() => setSelected(v)}
              >
                <td className="px-4 py-3 text-slate-500 whitespace-nowrap text-xs">{fmtDateShort(v.created_at)}</td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-full bg-brand-100 text-brand-700 text-xs font-bold grid place-items-center flex-shrink-0">
                      {initials(v.employees?.name)}
                    </div>
                    <span className="font-medium text-slate-800 text-xs">{v.employees?.name || v.whatsapp_from || '—'}</span>
                  </div>
                </td>
                <td className="px-4 py-3 text-slate-600 text-xs max-w-[140px] truncate">{v.extracted_sender || <span className="text-slate-300">—</span>}</td>
                <td className="px-4 py-3 font-semibold text-slate-900">{fmtMoney(v.extracted_amount)}</td>
                <td className="px-4 py-3"><StatusBadge status={v.status} /></td>
                <td className="px-4 py-3 text-right">
                  <span className="text-brand-600 text-xs font-medium flex items-center gap-0.5">Ver <ChevronRight size={12} /></span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Cards — visible solo en móvil */}
      <div className="space-y-3 md:hidden">
        {isLoading && (
          <div className="card text-center py-8 text-slate-400">
            <div className="w-6 h-6 border-2 border-brand-400 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
            Cargando…
          </div>
        )}
        {!isLoading && items.length === 0 && (
          <div className="card text-center py-10">
            <Inbox size={36} className="mx-auto text-slate-300 mb-2" />
            <div className="text-slate-400 text-sm">Sin verificaciones para el período</div>
            {hasFilters && <button onClick={reset} className="mt-2 text-xs text-brand-600 underline">Ver hoy</button>}
          </div>
        )}
        {items.map((v) => (
          <div
            key={v.id}
            className="card cursor-pointer active:scale-[0.99] transition-transform"
            onClick={() => setSelected(v)}
          >
            <div className="flex items-start justify-between gap-2 mb-2">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-brand-100 text-brand-700 text-xs font-bold grid place-items-center shrink-0">
                  {initials(v.employees?.name)}
                </div>
                <div>
                  <div className="font-medium text-slate-800 text-sm">{v.employees?.name || v.whatsapp_from || '—'}</div>
                  <div className="text-xs text-slate-400">{fmtDateShort(v.created_at)}</div>
                </div>
              </div>
              <StatusBadge status={v.status} />
            </div>
            <div className="flex items-center justify-between mt-1">
              <div className="text-lg font-semibold text-slate-900">{fmtMoney(v.extracted_amount)}</div>
              <span className="text-brand-600 text-xs font-medium flex items-center gap-0.5">Ver detalle <ChevronRight size={12} /></span>
            </div>
            {v.extracted_sender && (
              <div className="text-xs text-slate-400 mt-1 truncate">Remitente: {v.extracted_sender}</div>
            )}
          </div>
        ))}
      </div>

      <Pagination page={page} total={total} pageSize={PAGE_SIZE} onChange={setPage} />
      <DetailModal v={selected} onClose={() => setSelected(null)} />
    </div>
  );
}
