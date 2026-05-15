import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api.js';

const STATUS_BADGES = {
  real: { label: '✅ Real', cls: 'bg-green-100 text-green-700' },
  fake: { label: '❌ Falso', cls: 'bg-red-100 text-red-700' },
  duplicate: { label: '⚠️ Duplicado', cls: 'bg-amber-100 text-amber-700' },
  pending: { label: '… Pendiente', cls: 'bg-slate-100 text-slate-700' },
  error: { label: '⚙️ Error', cls: 'bg-slate-100 text-slate-700' }
};

function fmtMoney(n) {
  if (n == null) return '—';
  return `$${Number(n).toLocaleString('es-CO')}`;
}
function fmtDate(s) {
  if (!s) return '—';
  return new Date(s).toLocaleString('es-CO', { dateStyle: 'short', timeStyle: 'short' });
}

export default function Verifications() {
  const [filters, setFilters] = useState({ status: '' });
  const [selected, setSelected] = useState(null);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['verifications', filters],
    queryFn: () => api('/api/verifications', { query: filters })
  });

  return (
    <div>
      <header className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="font-serif text-3xl">Verificaciones</h1>
          <p className="text-slate-500 text-sm">Cada comprobante recibido por WhatsApp.</p>
        </div>
        <div className="flex gap-2">
          <select
            className="input w-auto"
            value={filters.status}
            onChange={(e) => setFilters({ ...filters, status: e.target.value })}
          >
            <option value="">Todos los estados</option>
            <option value="real">Reales</option>
            <option value="fake">Falsos</option>
            <option value="duplicate">Duplicados</option>
            <option value="error">Errores</option>
          </select>
          <button onClick={() => refetch()} className="btn btn-ghost">Refrescar</button>
        </div>
      </header>

      <div className="card overflow-hidden p-0">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left">
            <tr>
              <th className="px-4 py-3">Fecha</th>
              <th className="px-4 py-3">Empleado</th>
              <th className="px-4 py-3">Monto</th>
              <th className="px-4 py-3">Referencia</th>
              <th className="px-4 py-3">Estado</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr><td colSpan={6} className="px-4 py-6 text-center text-slate-500">Cargando…</td></tr>
            )}
            {!isLoading && (data?.items || []).length === 0 && (
              <tr><td colSpan={6} className="px-4 py-6 text-center text-slate-500">Sin resultados</td></tr>
            )}
            {(data?.items || []).map((v) => {
              const b = STATUS_BADGES[v.status] || STATUS_BADGES.pending;
              return (
                <tr key={v.id} className="border-t border-slate-100">
                  <td className="px-4 py-3">{fmtDate(v.created_at)}</td>
                  <td className="px-4 py-3">{v.employees?.name || v.whatsapp_from || '—'}</td>
                  <td className="px-4 py-3">{fmtMoney(v.extracted_amount)}</td>
                  <td className="px-4 py-3 font-mono text-xs">{v.extracted_reference || '—'}</td>
                  <td className="px-4 py-3"><span className={`badge ${b.cls}`}>{b.label}</span></td>
                  <td className="px-4 py-3 text-right">
                    <button onClick={() => setSelected(v)} className="text-brand-600 hover:underline text-sm">
                      Ver
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {selected && (
        <div className="fixed inset-0 bg-black/40 grid place-items-center p-4 z-50" onClick={() => setSelected(null)}>
          <div className="bg-white rounded-2xl max-w-2xl w-full p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between mb-4">
              <div>
                <h3 className="font-serif text-2xl">Detalle de verificación</h3>
                <p className="text-sm text-slate-500">{fmtDate(selected.created_at)}</p>
              </div>
              <button className="text-slate-400" onClick={() => setSelected(null)}>✕</button>
            </div>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div><div className="text-slate-500">Empleado</div><div>{selected.employees?.name || '—'}</div></div>
              <div><div className="text-slate-500">WhatsApp</div><div>{selected.whatsapp_from}</div></div>
              <div><div className="text-slate-500">Monto extraído</div><div>{fmtMoney(selected.extracted_amount)}</div></div>
              <div><div className="text-slate-500">Referencia</div><div className="font-mono">{selected.extracted_reference || '—'}</div></div>
              <div><div className="text-slate-500">Remitente</div><div>{selected.extracted_sender || '—'}</div></div>
              <div><div className="text-slate-500">Estado</div><div>{(STATUS_BADGES[selected.status] || {}).label}</div></div>
            </div>
            {selected.transactions && (
              <div className="mt-4 p-3 rounded-lg bg-green-50 border border-green-100 text-sm">
                <div className="font-semibold text-green-800 mb-1">Transferencia real coincidente</div>
                <div>{fmtMoney(selected.transactions.amount)} · {selected.transactions.sender_name || 's/n'}</div>
                <div className="text-xs text-slate-500">{fmtDate(selected.transactions.transaction_date)}</div>
              </div>
            )}
            {selected.comprobante_signed_url && (
              <div className="mt-4">
                <img src={selected.comprobante_signed_url} alt="comprobante" className="max-h-96 mx-auto rounded-lg border" />
              </div>
            )}
            {selected.notes && <div className="mt-4 text-sm text-slate-500">Notas: {selected.notes}</div>}
          </div>
        </div>
      )}
    </div>
  );
}
