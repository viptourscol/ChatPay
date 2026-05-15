import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api.js';

const METHODS = ['transferencia', 'efectivo', 'tarjeta', 'cheque'];
const CATEGORIES = ['nómina', 'arriendo', 'servicios', 'proveedor', 'otro'];

const CATEGORY_COLORS = {
  'nómina': 'bg-blue-100 text-blue-700',
  'arriendo': 'bg-purple-100 text-purple-700',
  'servicios': 'bg-amber-100 text-amber-700',
  'proveedor': 'bg-teal-100 text-teal-700',
  'otro': 'bg-slate-100 text-slate-700'
};

function fmtMoney(n) {
  if (n == null) return '—';
  return `$${Number(n).toLocaleString('es-CO', { minimumFractionDigits: 0 })}`;
}
function fmtDate(s) {
  if (!s) return '—';
  return new Date(s + 'T00:00:00').toLocaleDateString('es-CO', { dateStyle: 'medium' });
}

const EMPTY_FORM = { description: '', amount: '', recipient: '', payment_date: new Date().toISOString().slice(0, 10), method: 'transferencia', category: 'otro', notes: '' };

function EgresoModal({ initial, onClose, onSave, loading }) {
  const [form, setForm] = useState(initial || EMPTY_FORM);
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  function handleSubmit(e) {
    e.preventDefault();
    onSave(form);
  }

  return (
    <div className="fixed inset-0 bg-black/40 grid place-items-center p-4 z-50" onClick={onClose}>
      <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <h3 className="font-serif text-xl">{initial?.id ? 'Editar egreso' : 'Registrar egreso'}</h3>
          <button className="text-slate-400 hover:text-slate-700" onClick={onClose}>✕</button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-sm text-slate-600 mb-1 block">Descripción *</label>
            <input
              className="input w-full"
              required
              value={form.description}
              onChange={(e) => set('description', e.target.value)}
              placeholder="Ej: Pago nómina enero"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm text-slate-600 mb-1 block">Monto *</label>
              <input
                type="number"
                min="0"
                step="0.01"
                className="input w-full"
                required
                value={form.amount}
                onChange={(e) => set('amount', e.target.value)}
                placeholder="0"
              />
            </div>
            <div>
              <label className="text-sm text-slate-600 mb-1 block">Fecha</label>
              <input
                type="date"
                className="input w-full"
                value={form.payment_date}
                onChange={(e) => set('payment_date', e.target.value)}
              />
            </div>
          </div>
          <div>
            <label className="text-sm text-slate-600 mb-1 block">Destinatario</label>
            <input
              className="input w-full"
              value={form.recipient}
              onChange={(e) => set('recipient', e.target.value)}
              placeholder="Nombre del beneficiario"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm text-slate-600 mb-1 block">Método</label>
              <select className="input w-full" value={form.method} onChange={(e) => set('method', e.target.value)}>
                {METHODS.map((m) => <option key={m} value={m}>{m.charAt(0).toUpperCase() + m.slice(1)}</option>)}
              </select>
            </div>
            <div>
              <label className="text-sm text-slate-600 mb-1 block">Categoría</label>
              <select className="input w-full" value={form.category} onChange={(e) => set('category', e.target.value)}>
                {CATEGORIES.map((c) => <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="text-sm text-slate-600 mb-1 block">Notas</label>
            <textarea
              className="input w-full"
              rows={2}
              value={form.notes}
              onChange={(e) => set('notes', e.target.value)}
              placeholder="Observaciones opcionales"
            />
          </div>
          <div className="flex gap-2 pt-1">
            <button type="submit" className="btn btn-primary flex-1" disabled={loading}>
              {loading ? 'Guardando…' : initial?.id ? 'Guardar cambios' : 'Registrar egreso'}
            </button>
            <button type="button" className="btn btn-ghost" onClick={onClose}>Cancelar</button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function Egresos() {
  const qc = useQueryClient();
  const [filters, setFilters] = useState({ from: '', to: '', category: '' });
  const [applied, setApplied] = useState({});
  const [page, setPage] = useState(1);
  const [modal, setModal] = useState(null); // null | 'new' | egreso objeto
  const [deleting, setDeleting] = useState(null);

  const { data, isLoading } = useQuery({
    queryKey: ['egresos', applied, page],
    queryFn: () => api('/api/egresos', { query: { ...applied, page } })
  });

  const saveMutation = useMutation({
    mutationFn: (form) => {
      if (form.id) {
        return api('/api/egresos', { method: 'PATCH', body: form });
      }
      return api('/api/egresos', { method: 'POST', body: form });
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['egresos'] }); setModal(null); }
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => api(`/api/egresos?id=${id}`, { method: 'DELETE' }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['egresos'] }); setDeleting(null); }
  });

  function applyFilters() { setPage(1); setApplied({ ...filters }); }
  function clearFilters() { setFilters({ from: '', to: '', category: '' }); setApplied({}); setPage(1); }

  const stats = data?.stats;
  const totalPages = data ? Math.ceil(data.total / data.pageSize) : 1;

  return (
    <div>
      <header className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="font-serif text-3xl">Egresos</h1>
          <p className="text-slate-500 text-sm">Gastos y pagos realizados por tu empresa.</p>
        </div>
        <button onClick={() => setModal('new')} className="btn btn-primary">+ Registrar egreso</button>
      </header>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <div className="card">
          <div className="text-sm text-slate-500">Total este mes</div>
          <div className="text-2xl font-semibold mt-1 text-red-600">{fmtMoney(stats?.monthTotal)}</div>
          <div className="text-xs text-slate-400 mt-0.5">{stats?.monthCount ?? 0} registros</div>
        </div>
        <div className="card">
          <div className="text-sm text-slate-500">Total histórico</div>
          <div className="text-2xl font-semibold mt-1 text-slate-800">{fmtMoney(stats?.allTotal)}</div>
        </div>
        <div className="card">
          <div className="text-sm text-slate-500">En este listado</div>
          <div className="text-2xl font-semibold mt-1 text-slate-800">{data?.total ?? '—'}</div>
          <div className="text-xs text-slate-400 mt-0.5">registros</div>
        </div>
      </div>

      {/* Filtros */}
      <div className="card mb-4">
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          <div>
            <label className="text-xs text-slate-500 mb-1 block">Desde</label>
            <input type="date" className="input w-full" value={filters.from} onChange={(e) => setFilters({ ...filters, from: e.target.value })} />
          </div>
          <div>
            <label className="text-xs text-slate-500 mb-1 block">Hasta</label>
            <input type="date" className="input w-full" value={filters.to} onChange={(e) => setFilters({ ...filters, to: e.target.value })} />
          </div>
          <div>
            <label className="text-xs text-slate-500 mb-1 block">Categoría</label>
            <select className="input w-full" value={filters.category} onChange={(e) => setFilters({ ...filters, category: e.target.value })}>
              <option value="">Todas</option>
              {CATEGORIES.map((c) => <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>)}
            </select>
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
              <th className="px-4 py-3 text-slate-500 font-medium">Descripción</th>
              <th className="px-4 py-3 text-slate-500 font-medium">Destinatario</th>
              <th className="px-4 py-3 text-slate-500 font-medium">Categoría</th>
              <th className="px-4 py-3 text-slate-500 font-medium">Método</th>
              <th className="px-4 py-3 text-slate-500 font-medium text-right">Monto</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr><td colSpan={7} className="px-4 py-8 text-center text-slate-400">Cargando…</td></tr>
            )}
            {!isLoading && (data?.items || []).length === 0 && (
              <tr><td colSpan={7} className="px-4 py-8 text-center text-slate-400">Sin egresos registrados</td></tr>
            )}
            {(data?.items || []).map((e) => (
              <tr key={e.id} className="border-t border-slate-100 hover:bg-slate-50 transition">
                <td className="px-4 py-3 whitespace-nowrap">{fmtDate(e.payment_date)}</td>
                <td className="px-4 py-3">{e.description}</td>
                <td className="px-4 py-3 text-slate-500">{e.recipient || '—'}</td>
                <td className="px-4 py-3">
                  {e.category && (
                    <span className={`badge ${CATEGORY_COLORS[e.category] || 'bg-slate-100 text-slate-700'}`}>
                      {e.category}
                    </span>
                  )}
                </td>
                <td className="px-4 py-3 text-slate-500 capitalize">{e.method}</td>
                <td className="px-4 py-3 text-right font-semibold text-red-600">{fmtMoney(e.amount)}</td>
                <td className="px-4 py-3 text-right">
                  <div className="flex gap-2 justify-end">
                    <button className="text-brand-600 hover:underline text-xs" onClick={() => setModal(e)}>Editar</button>
                    <button className="text-red-400 hover:underline text-xs" onClick={() => setDeleting(e)}>Eliminar</button>
                  </div>
                </td>
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
            <button className="btn btn-ghost text-sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>← Anterior</button>
            <button className="btn btn-ghost text-sm" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>Siguiente →</button>
          </div>
        </div>
      )}

      {/* Modal crear/editar */}
      {modal && (
        <EgresoModal
          initial={modal === 'new' ? null : modal}
          onClose={() => setModal(null)}
          onSave={(form) => saveMutation.mutate(form)}
          loading={saveMutation.isPending}
        />
      )}

      {/* Confirm delete */}
      {deleting && (
        <div className="fixed inset-0 bg-black/40 grid place-items-center p-4 z-50" onClick={() => setDeleting(null)}>
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-serif text-lg mb-2">¿Eliminar egreso?</h3>
            <p className="text-sm text-slate-500 mb-4">
              "<strong>{deleting.description}</strong>" por {fmtMoney(deleting.amount)} del {fmtDate(deleting.payment_date)}.
              Esta acción no se puede deshacer.
            </p>
            <div className="flex gap-2">
              <button
                className="btn flex-1 bg-red-600 text-white hover:bg-red-700 text-sm"
                onClick={() => deleteMutation.mutate(deleting.id)}
                disabled={deleteMutation.isPending}
              >
                {deleteMutation.isPending ? 'Eliminando…' : 'Sí, eliminar'}
              </button>
              <button className="btn btn-ghost" onClick={() => setDeleting(null)}>Cancelar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
