import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api.js';
import {
  TrendingUp, DollarSign, Clock, CheckCircle2, ChevronLeft,
  ChevronRight, RefreshCw, Search, SlidersHorizontal, X, Mail, MessageSquare
} from 'lucide-react';

function SourceBadge({ source }) {
  if (source === 'sms') return (
    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-green-100 text-green-700 text-[10px] font-medium">
      <MessageSquare size={9} />SMS
    </span>
  );
  return (
    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-700 text-[10px] font-medium">
      <Mail size={9} />Email
    </span>
  );
}

function fmtMoney(n) {
  if (n == null) return '—';
  return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(n);
}
function fmtDate(s) {
  if (!s) return '—';
  return new Date(s).toLocaleDateString('es-CO', {
    timeZone: 'America/Bogota', day: '2-digit', month: 'short', year: 'numeric'
  });
}
function fmtTime(s) {
  if (!s) return '';
  return new Date(s).toLocaleTimeString('es-CO', {
    timeZone: 'America/Bogota', hour: '2-digit', minute: '2-digit'
  });
}
function initials(name) {
  if (!name) return '?';
  return name.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase();
}

const STATUS_CFG = {
  pending:   { label: 'Pendiente',  cls: 'bg-amber-50 text-amber-700 border border-amber-200' },
  confirmed: { label: 'Confirmado', cls: 'bg-emerald-50 text-emerald-700 border border-emerald-200' },
  rejected:  { label: 'Rechazado', cls: 'bg-red-50 text-red-600 border border-red-200' },
};

function StatusBadge({ status }) {
  const cfg = STATUS_CFG[status] || { label: status || '—', cls: 'bg-slate-100 text-slate-500 border border-slate-200' };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${cfg.cls}`}>
      {cfg.label}
    </span>
  );
}

function KpiCard({ Icon, label, value, sub, iconBg = 'bg-emerald-50', iconColor = 'text-emerald-600' }) {
  const str = String(value ?? '');
  const fontSize = str.length > 12 ? 'text-sm' : str.length > 8 ? 'text-base' : 'text-xl';
  return (
    <div className="rounded-2xl bg-white border border-emerald-100/60 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 p-4 sm:p-5">
      <div className={`w-10 h-10 rounded-xl grid place-items-center mb-3 ${iconBg}`}>
        <Icon size={18} className={iconColor} />
      </div>
      <div className={`${fontSize} font-bold text-slate-900 leading-none mb-1`}>{value}</div>
      <div className="text-xs font-medium text-slate-500 truncate">{label}</div>
      {sub && <div className="text-[11px] text-slate-400 mt-1 truncate">{sub}</div>}
    </div>
  );
}

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
      <span className="text-sm text-slate-500">{from}–{to} de {total} transacciones</span>
      <div className="flex items-center gap-1">
        <button disabled={page <= 1} onClick={() => onChange(page - 1)}
          className="w-8 h-8 rounded-lg border border-emerald-100 flex items-center justify-center text-slate-500 hover:bg-emerald-50 disabled:opacity-30 transition">
          <ChevronLeft size={15} />
        </button>
        {pages.map(p => (
          <button key={p} onClick={() => onChange(p)}
            className={`w-8 h-8 rounded-lg border text-sm font-medium transition ${
              p === page ? 'border-emerald-500 bg-emerald-500 text-white' : 'border-emerald-100 text-slate-600 hover:bg-emerald-50'
            }`}>{p}</button>
        ))}
        <button disabled={page >= totalPages} onClick={() => onChange(page + 1)}
          className="w-8 h-8 rounded-lg border border-emerald-100 flex items-center justify-center text-slate-500 hover:bg-emerald-50 disabled:opacity-30 transition">
          <ChevronRight size={15} />
        </button>
      </div>
    </div>
  );
}

export default function Ingresos() {
  const [filters, setFilters] = useState({ from: '', to: '', min_amount: '', max_amount: '', status: '', sender: '' });
  const [applied, setApplied] = useState({});
  const [page, setPage] = useState(1);
  const [showFilters, setShowFilters] = useState(false);

  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ['ingresos', applied, page],
    queryFn: () => api('/api/ingresos', { query: { ...applied, page } })
  });

  function applyFilters() { setPage(1); setApplied({ ...filters }); }
  function clearFilters() {
    const empty = { from: '', to: '', min_amount: '', max_amount: '', status: '', sender: '' };
    setFilters(empty); setApplied({}); setPage(1);
  }
  const hasFilters = Object.values(applied).some(Boolean);

  const stats = data?.stats;
  const totalPages = data ? Math.ceil(data.total / data.pageSize) : 1;

  return (
    <div>
      {/* ── Header ── */}
      <header className="mb-6 flex items-center justify-between gap-4 flex-wrap animate-fade-up">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-emerald-100 grid place-items-center shrink-0">
            <TrendingUp size={20} className="text-emerald-600" />
          </div>
          <div>
            <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-widest leading-none mb-0.5">Finanzas</p>
            <h1 className="font-serif text-2xl md:text-3xl text-slate-900 leading-tight">Ingresos</h1>
          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowFilters(v => !v)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium border transition-colors duration-150 ${
              showFilters
                ? 'bg-emerald-500 text-white border-emerald-500'
                : 'bg-white text-slate-600 border-slate-200 hover:border-emerald-300 hover:text-emerald-700'
            }`}
          >
            <SlidersHorizontal size={14} />
            Filtros
            {hasFilters && <span className="bg-white/30 rounded-full px-1.5 py-0.5 text-[10px] font-bold">activos</span>}
          </button>
          <button
            onClick={() => refetch()}
            disabled={isFetching}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium bg-white text-slate-600 border border-slate-200 hover:border-emerald-300 hover:text-emerald-700 transition-colors duration-150 disabled:opacity-60"
          >
            <RefreshCw size={14} className={isFetching ? 'animate-spin' : ''} /> Refrescar
          </button>
        </div>
      </header>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
        <KpiCard Icon={DollarSign} label="Total este mes" value={fmtMoney(stats?.monthTotal)}
          sub={`${stats?.monthCount ?? 0} transacciones`} iconBg="bg-emerald-50" iconColor="text-emerald-600" />
        <KpiCard Icon={TrendingUp} label="Total histórico" value={fmtMoney(stats?.allTimeTotal)}
          sub={`${stats?.allTimeCount ?? 0} en total`} iconBg="bg-emerald-100" iconColor="text-emerald-700" />
        <KpiCard Icon={DollarSign} label="Promedio por transacción" value={fmtMoney(stats?.allTimeAvg)}
          iconBg="bg-emerald-50" iconColor="text-emerald-600" />
        <KpiCard Icon={Clock} label="Pendientes de verificar" value={stats?.pendingCount ?? '—'}
          sub="Sin comprobante recibido" iconBg="bg-amber-50" iconColor="text-amber-500" />
      </div>

      {/* Filtros */}
      {showFilters && (
        <div className="bg-white rounded-2xl border border-emerald-100/60 shadow-sm p-5 mb-4">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            <div className="col-span-2 md:col-span-3">
              <label className="text-xs text-slate-500 mb-1 block">Buscar remitente</label>
              <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  className="input w-full pl-8"
                  placeholder="Nombre del remitente…"
                  value={filters.sender}
                  onChange={(e) => setFilters({ ...filters, sender: e.target.value })}
                />
              </div>
            </div>
            <div>
              <label className="text-xs text-slate-500 mb-1 block">Desde</label>
              <input type="date" className="input w-full" value={filters.from}
                onChange={(e) => setFilters({ ...filters, from: e.target.value })} />
            </div>
            <div>
              <label className="text-xs text-slate-500 mb-1 block">Hasta</label>
              <input type="date" className="input w-full" value={filters.to}
                onChange={(e) => setFilters({ ...filters, to: e.target.value })} />
            </div>
            <div>
              <label className="text-xs text-slate-500 mb-1 block">Estado</label>
              <select className="input w-full" value={filters.status}
                onChange={(e) => setFilters({ ...filters, status: e.target.value })}>
                <option value="">Todos</option>
                <option value="pending">Pendiente</option>
                <option value="confirmed">Confirmado</option>
                <option value="rejected">Rechazado</option>
              </select>
            </div>
            <div>
              <label className="text-xs text-slate-500 mb-1 block">Monto mínimo</label>
              <input type="number" className="input w-full" placeholder="0" value={filters.min_amount}
                onChange={(e) => setFilters({ ...filters, min_amount: e.target.value })} />
            </div>
            <div>
              <label className="text-xs text-slate-500 mb-1 block">Monto máximo</label>
              <input type="number" className="input w-full" placeholder="Sin límite" value={filters.max_amount}
                onChange={(e) => setFilters({ ...filters, max_amount: e.target.value })} />
            </div>
          </div>
          <div className="flex gap-2 mt-4">
            <button onClick={applyFilters} className="btn btn-primary text-sm">Aplicar filtros</button>
            <button onClick={clearFilters} className="btn btn-ghost text-sm flex items-center gap-1"><X size={13} /> Limpiar</button>
          </div>
        </div>
      )}

      {/* Tabla — solo md+ */}
      <div className="bg-white rounded-2xl border border-emerald-100/60 shadow-sm overflow-hidden hidden md:block">
        <table className="w-full text-sm">
          <thead className="bg-emerald-50/60 border-b border-emerald-100/60 text-left">
            <tr>
              <th className="px-4 py-3 text-xs font-semibold text-emerald-700 uppercase tracking-wide">Fecha / Hora</th>
              <th className="px-4 py-3 text-xs font-semibold text-emerald-700 uppercase tracking-wide">Remitente</th>
              <th className="px-4 py-3 text-xs font-semibold text-emerald-700 uppercase tracking-wide hidden md:table-cell">Descripción</th>
              <th className="px-4 py-3 text-xs font-semibold text-emerald-700 uppercase tracking-wide hidden lg:table-cell">Referencia</th>
              <th className="px-4 py-3 text-xs font-semibold text-emerald-700 uppercase tracking-wide">Estado</th>
              <th className="px-4 py-3 text-xs font-semibold text-emerald-700 uppercase tracking-wide text-right">Monto</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50/80">
            {isLoading && (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-slate-400">
                  <div className="flex flex-col items-center gap-2">
                    <div className="w-5 h-5 border-2 border-brand-400 border-t-transparent rounded-full animate-spin" />
                    Cargando…
                  </div>
                </td>
              </tr>
            )}
            {!isLoading && (data?.items || []).length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-12 text-center">
                  <div className="text-slate-300 mb-1"><Search size={36} className="mx-auto" /></div>
                  <div className="text-slate-400 text-sm">Sin transacciones para los filtros aplicados</div>
                </td>
              </tr>
            )}
            {(data?.items || []).map((t) => (
              <tr key={t.id} className="hover:bg-slate-50 transition-colors">
                <td className="px-4 py-3 whitespace-nowrap">
                  <div className="text-sm font-medium text-slate-800">{fmtDate(t.transaction_date)}</div>
                  <div className="text-xs text-slate-400">{fmtTime(t.transaction_date)}</div>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-full bg-brand-100 text-brand-700 text-xs font-bold grid place-items-center shrink-0">
                      {initials(t.sender_name)}
                    </div>
                    <div className="min-w-0">
                      <span className="font-medium text-slate-800 truncate max-w-[130px] block">{t.sender_name || <span className="text-slate-400">—</span>}</span>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3 hidden md:table-cell">
                  <span className="text-slate-500 text-xs line-clamp-2 max-w-[220px]">{t.raw_snippet || t.raw_subject || <span className="text-slate-300">—</span>}</span>
                </td>
                <td className="px-4 py-3 hidden lg:table-cell">
                  <span className="font-mono text-xs text-slate-400">{t.reference_number || '—'}</span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex flex-col items-start gap-1">
                    <StatusBadge status={t.status} />
                    <SourceBadge source={t.source} />
                  </div>
                </td>
                <td className="px-4 py-3 text-right">
                  <span className="font-semibold text-emerald-700 text-base">{fmtMoney(t.amount)}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Cards — solo móvil */}
      <div className="space-y-3 md:hidden">
        {isLoading && (
          <div className="bg-white rounded-2xl border border-emerald-100/60 shadow-sm text-center py-8 text-slate-400">
            <div className="w-5 h-5 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
            Cargando…
          </div>
        )}
        {!isLoading && (data?.items || []).length === 0 && (
          <div className="bg-white rounded-2xl border border-emerald-100/60 shadow-sm text-center py-10">
            <Search size={32} className="mx-auto text-slate-300 mb-2" />
            <div className="text-slate-400 text-sm">Sin transacciones</div>
          </div>
        )}
        {(data?.items || []).map((t) => (
          <div key={t.id} className="bg-white rounded-2xl border border-emerald-100/60 shadow-sm p-4 hover:shadow-md transition-shadow duration-200">
            <div className="flex items-start justify-between gap-2 mb-2">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-9 h-9 rounded-full bg-emerald-100 text-emerald-700 text-xs font-bold grid place-items-center shrink-0">
                  {initials(t.sender_name)}
                </div>
                <div className="min-w-0">
                  <div className="font-semibold text-slate-800 text-sm truncate">{t.sender_name || '—'}</div>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <span className="text-xs text-slate-400">{fmtDate(t.transaction_date)} · {fmtTime(t.transaction_date)}</span>
                  </div>
                </div>
              </div>
              <div className="shrink-0 text-right">
                <div className="font-bold text-emerald-700 text-base">{fmtMoney(t.amount)}</div>
                <div className="flex items-center justify-end gap-1.5 mt-1">
                  <SourceBadge source={t.source} />
                  <StatusBadge status={t.status} />
                </div>
              </div>
            </div>
            {(t.raw_snippet || t.raw_subject) && (
              <div className="text-xs text-slate-400 mt-2 line-clamp-2 border-t border-slate-50 pt-2">{t.raw_snippet || t.raw_subject}</div>
            )}
          </div>
        ))}
      </div>

      {/* Paginación */}
      <Pagination page={page} total={data?.total || 0} pageSize={data?.pageSize || 25} onChange={setPage} />
    </div>
  );
}