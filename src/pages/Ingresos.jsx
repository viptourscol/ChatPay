import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api.js';
import {
  TrendingUp, DollarSign, Clock, CheckCircle2, ChevronLeft,
  ChevronRight, RefreshCw, Search, SlidersHorizontal, X
} from 'lucide-react';

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

function KpiCard({ Icon, label, value, sub, accent, bg }) {
  return (
    <div className="card flex items-center gap-3 py-3">
      <div className={`w-10 h-10 rounded-xl grid place-items-center shrink-0 ${bg || 'bg-slate-100'}`}>
        <Icon size={19} className={accent || 'text-slate-500'} />
      </div>
      <div className="min-w-0">
        <div className="text-xs text-slate-400 truncate">{label}</div>
        <div className={`text-xl font-semibold leading-tight truncate ${accent || 'text-slate-900'}`}>{value}</div>
        {sub && <div className="text-[11px] text-slate-400">{sub}</div>}
      </div>
    </div>
  );
}

export default function Ingresos() {
  const [filters, setFilters] = useState({ from: '', to: '', min_amount: '', max_amount: '', status: '', sender: '' });
  const [applied, setApplied] = useState({});
  const [page, setPage] = useState(1);
  const [showFilters, setShowFilters] = useState(false);

  const { data, isLoading, refetch } = useQuery({
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
      <header className="mb-6 flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-serif text-3xl">Ingresos</h1>
          <p className="text-slate-500 text-sm">Transferencias recibidas desde Bancolombia.</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowFilters(v => !v)}
            className={`btn text-sm flex items-center gap-1.5 ${showFilters ? 'btn-primary' : 'btn-ghost'}`}
          >
            <SlidersHorizontal size={14} /> Filtros {hasFilters && <span className="bg-white/30 rounded-full px-1 text-xs">activos</span>}
          </button>
          <button onClick={() => refetch()} className="btn btn-ghost text-sm flex items-center gap-1.5">
            <RefreshCw size={14} /> Refrescar
          </button>
        </div>
      </header>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
        <KpiCard Icon={DollarSign} label="Total este mes" value={fmtMoney(stats?.monthTotal)}
          sub={`${stats?.monthCount ?? 0} transacciones`} bg="bg-brand-50" accent="text-brand-600" />
        <KpiCard Icon={TrendingUp} label="Total histórico" value={fmtMoney(stats?.allTimeTotal)}
          sub={`${stats?.allTimeCount ?? 0} en total`} bg="bg-emerald-50" accent="text-emerald-600" />
        <KpiCard Icon={DollarSign} label="Promedio por transacción" value={fmtMoney(stats?.allTimeAvg)}
          bg="bg-slate-100" accent="text-slate-600" />
        <KpiCard Icon={Clock} label="Pendientes de verificar" value={stats?.pendingCount ?? '—'}
          sub="Sin comprobante recibido" bg="bg-amber-50" accent="text-amber-500" />
      </div>

      {/* Filtros */}
      {showFilters && (
        <div className="card mb-4 border border-slate-200">
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

      {/* Tabla */}
      <div className="card overflow-hidden p-0">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 border-b border-slate-100 text-left">
            <tr>
              <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Fecha / Hora</th>
              <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Remitente</th>
              <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide hidden md:table-cell">Descripción</th>
              <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide hidden lg:table-cell">Referencia</th>
              <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Estado</th>
              <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide text-right">Monto</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
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
                    <span className="font-medium text-slate-800 truncate max-w-[130px]">{t.sender_name || <span className="text-slate-400">—</span>}</span>
                  </div>
                </td>
                <td className="px-4 py-3 hidden md:table-cell">
                  <span className="text-slate-500 text-xs line-clamp-2 max-w-[220px]">{t.raw_snippet || t.raw_subject || <span className="text-slate-300">—</span>}</span>
                </td>
                <td className="px-4 py-3 hidden lg:table-cell">
                  <span className="font-mono text-xs text-slate-400">{t.reference_number || '—'}</span>
                </td>
                <td className="px-4 py-3">
                  <StatusBadge status={t.status} />
                </td>
                <td className="px-4 py-3 text-right">
                  <span className="font-semibold text-emerald-700 text-base">{fmtMoney(t.amount)}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Paginación */}
      {(data?.total > 0) && (
        <div className="flex items-center justify-between mt-4 text-sm text-slate-500">
          <span>
            {data.total} registro{data.total !== 1 ? 's' : ''} · página {page} de {totalPages}
          </span>
          <div className="flex gap-1">
            <button
              className="btn btn-ghost text-sm flex items-center gap-1"
              disabled={page <= 1}
              onClick={() => setPage(p => p - 1)}
            >
              <ChevronLeft size={15} /> Anterior
            </button>
            <button
              className="btn btn-ghost text-sm flex items-center gap-1"
              disabled={page >= totalPages}
              onClick={() => setPage(p => p + 1)}
            >
              Siguiente <ChevronRight size={15} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}


function fmtMoney(n) {
  if (n == null) return '—';
  return `$${Number(n).toLocaleString('es-CO', { minimumFractionDigits: 0 })}`;
}
function fmtDate(s) {
  if (!s) return '—';
  return new Date(s).toLocaleDateString('es-CO', { dateStyle: 'medium' });
}

function StatCard({ label, value, sub }) {
  return (
    <div className="card">
      <div className="text-sm text-slate-500">{label}</div>
      <div className="text-2xl font-semibold mt-1 text-brand-600">{value}</div>
      {sub && <div className="text-xs text-slate-400 mt-0.5">{sub}</div>}
    </div>
  );
}

export default function Ingresos() {
  const [filters, setFilters] = useState({ from: '', to: '', min_amount: '', max_amount: '' });
  const [applied, setApplied] = useState({});
  const [page, setPage] = useState(1);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['ingresos', applied, page],
    queryFn: () => api('/api/ingresos', { query: { ...applied, page } })
  });

  function applyFilters() {
    setPage(1);
    setApplied({ ...filters });
  }
  function clearFilters() {
    setFilters({ from: '', to: '', min_amount: '', max_amount: '' });
    setApplied({});
    setPage(1);
  }

  const stats = data?.stats;
  const totalPages = data ? Math.ceil(data.total / data.pageSize) : 1;

  return (
    <div>
      <header className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="font-serif text-3xl">Ingresos</h1>
          <p className="text-slate-500 text-sm">Transferencias reales recibidas desde Bancolombia.</p>
        </div>
        <button onClick={() => refetch()} className="btn btn-ghost">Refrescar</button>
      </header>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <StatCard
          label="Total este mes"
          value={fmtMoney(stats?.monthTotal)}
          sub={`${stats?.monthCount ?? 0} transacciones`}
        />
        <StatCard label="Total histórico" value={fmtMoney(stats?.allTimeTotal)} />
        <StatCard
          label="Promedio por transacción"
          value={fmtMoney(stats?.allTimeAvg)}
        />
        <StatCard label="En este listado" value={data?.total ?? '—'} sub="registros" />
      </div>

      {/* Filtros */}
      <div className="card mb-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div>
            <label className="text-xs text-slate-500 mb-1 block">Desde</label>
            <input
              type="date"
              className="input w-full"
              value={filters.from}
              onChange={(e) => setFilters({ ...filters, from: e.target.value })}
            />
          </div>
          <div>
            <label className="text-xs text-slate-500 mb-1 block">Hasta</label>
            <input
              type="date"
              className="input w-full"
              value={filters.to}
              onChange={(e) => setFilters({ ...filters, to: e.target.value })}
            />
          </div>
          <div>
            <label className="text-xs text-slate-500 mb-1 block">Monto mínimo</label>
            <input
              type="number"
              className="input w-full"
              placeholder="0"
              value={filters.min_amount}
              onChange={(e) => setFilters({ ...filters, min_amount: e.target.value })}
            />
          </div>
          <div>
            <label className="text-xs text-slate-500 mb-1 block">Monto máximo</label>
            <input
              type="number"
              className="input w-full"
              placeholder="999,999,999"
              value={filters.max_amount}
              onChange={(e) => setFilters({ ...filters, max_amount: e.target.value })}
            />
          </div>
        </div>
        <div className="flex gap-2 mt-3">
          <button onClick={applyFilters} className="btn btn-primary text-sm">Filtrar</button>
          <button onClick={clearFilters} className="btn btn-ghost text-sm">Limpiar</button>
        </div>
      </div>

      {/* Tabla */}
      <div className="card overflow-hidden p-0">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left">
            <tr>
              <th className="px-4 py-3 text-slate-500 font-medium">Fecha</th>
              <th className="px-4 py-3 text-slate-500 font-medium">Remitente</th>
              <th className="px-4 py-3 text-slate-500 font-medium">Referencia</th>
              <th className="px-4 py-3 text-slate-500 font-medium text-right">Monto</th>
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr><td colSpan={4} className="px-4 py-8 text-center text-slate-400">Cargando…</td></tr>
            )}
            {!isLoading && (data?.items || []).length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-slate-400">
                  Sin transacciones para los filtros aplicados
                </td>
              </tr>
            )}
            {(data?.items || []).map((t) => (
              <tr key={t.id} className="border-t border-slate-100 hover:bg-slate-50 transition">
                <td className="px-4 py-3">{fmtDate(t.transaction_date)}</td>
                <td className="px-4 py-3">{t.sender_name || '—'}</td>
                <td className="px-4 py-3 font-mono text-xs text-slate-500">{t.reference_number || '—'}</td>
                <td className="px-4 py-3 text-right font-semibold text-green-700">{fmtMoney(t.amount)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Paginación */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-4 text-sm text-slate-600">
          <span>Página {page} de {totalPages} · {data?.total} registros</span>
          <div className="flex gap-2">
            <button
              className="btn btn-ghost text-sm"
              disabled={page <= 1}
              onClick={() => setPage((p) => p - 1)}
            >
              ← Anterior
            </button>
            <button
              className="btn btn-ghost text-sm"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => p + 1)}
            >
              Siguiente →
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
