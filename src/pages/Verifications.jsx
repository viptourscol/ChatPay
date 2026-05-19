import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api.js';
import {
  CheckCircle2, XCircle, AlertTriangle, Clock, AlertCircle,
  ClipboardList, DollarSign, Inbox, RefreshCw, ChevronRight, X
} from 'lucide-react';

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

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
      {[
        { Icon: ClipboardList, label: 'Total',           value: items.length,         color: 'bg-slate-100',   iconCls: 'text-slate-500' },
        { Icon: CheckCircle2,  label: 'Verificados',     value: real,                 color: 'bg-emerald-50',  iconCls: 'text-emerald-600', valueClass: 'text-emerald-700' },
        { Icon: XCircle,       label: 'Falsos / Dup.',   value: fake + dup,           color: 'bg-red-50',      iconCls: 'text-red-500',    valueClass: 'text-red-600' },
        { Icon: DollarSign,    label: 'Monto verificado',value: fmtMoney(totalAmount), color: 'bg-brand-50',    iconCls: 'text-brand-600',  valueClass: 'text-brand-700' },
      ].map(({ Icon, label, value, color, iconCls, valueClass }) => (
        <div key={label} className="card flex items-center gap-3 py-3">
          <div className={`w-10 h-10 rounded-xl ${color} grid place-items-center flex-shrink-0`}>
            <Icon size={20} className={iconCls} />
          </div>
          <div className="min-w-0">
            <div className="text-xs text-slate-500 truncate">{label}</div>
            <div className={`text-xl font-semibold truncate ${valueClass || 'text-slate-900'}`}>{value}</div>
          </div>
        </div>
      ))}
    </div>
  );
}

function DetailModal({ v, onClose }) {
  if (!v) return null;
  const s = STATUS_CONFIG[v.status] || STATUS_CONFIG.pending;
  const headerBg = v.status === 'real' ? 'bg-emerald-50' : v.status === 'fake' ? 'bg-red-50' : 'bg-slate-50';
  const { Icon: StatusIcon } = s;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm grid place-items-center p-4 z-50" onClick={onClose}>
      <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className={`px-6 py-4 flex items-center justify-between ${headerBg}`}>
          <div className="flex items-center gap-3">
            <StatusIcon size={28} className={s.iconCls} />
            <div>
              <div className="font-semibold text-slate-900">Comprobante {s.label}</div>
              <div className="text-xs text-slate-500">{fmtDate(v.created_at)}</div>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition"><X size={18} /></button>
        </div>

        <div className="px-6 py-5 space-y-4">
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
              <img
                src={v.comprobante_signed_url}
                alt="comprobante"
                className="w-full max-h-64 object-contain rounded-xl border border-slate-100 bg-slate-50"
              />
            </div>
          )}

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
  const [filters, setFilters] = useState({ status: '' });
  const [selected, setSelected] = useState(null);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['verifications', filters],
    queryFn: () => api('/api/verifications', { query: filters })
  });

  const items = data?.items || [];

  return (
    <div>
      <header className="mb-6 flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-serif text-3xl">Verificaciones</h1>
          <p className="text-slate-500 text-sm">Comprobantes recibidos por WhatsApp y su resultado.</p>
        </div>
        <div className="flex gap-2">
          <select
            className="input w-auto text-sm"
            value={filters.status}
            onChange={(e) => setFilters({ ...filters, status: e.target.value })}
          >
            <option value="">Todos los estados</option>
            <option value="real">Verificados</option>
            <option value="fake">Falsos</option>
            <option value="duplicate">Duplicados</option>
            <option value="error">Errores</option>
          </select>
          <button onClick={() => refetch()} className="btn btn-ghost text-sm flex items-center gap-1.5"><RefreshCw size={14} /> Refrescar</button>
        </div>
      </header>

      {!isLoading && <SummaryBar items={items} />}

      <div className="card overflow-hidden p-0">
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
                  <div className="text-4xl mb-2"><Inbox size={40} className="mx-auto text-slate-300" /></div>
                  <div className="text-slate-400 text-sm">Sin verificaciones aún</div>
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

      <DetailModal v={selected} onClose={() => setSelected(null)} />
    </div>
  );
}
