import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api.js';

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
