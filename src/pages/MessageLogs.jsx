import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api.js';
import {
  MessageSquare, CheckCircle2, XCircle, Filter,
  ChevronLeft, ChevronRight, RefreshCw, Building2, X, Check
} from 'lucide-react';

const TYPE_LABELS = {
  payment_notification: 'Notif. pago',
  admin_alert:          'Alerta admin',
  auth_rejected:        'No autorizado',
  verification_response:'Respuesta verificación',
  disambiguation:       'Desambiguación',
  greeting:             'Saludo',
  fallback_text:        'Fallback texto',
  other:                'Otro',
};

const TYPE_COLORS = {
  payment_notification:  'bg-brand-100 text-brand-700',
  admin_alert:           'bg-orange-100 text-orange-700',
  auth_rejected:         'bg-red-100 text-red-700',
  verification_response: 'bg-green-100 text-green-700',
  disambiguation:        'bg-yellow-100 text-yellow-700',
  greeting:              'bg-slate-100 text-slate-600',
  fallback_text:         'bg-purple-100 text-purple-700',
  other:                 'bg-slate-100 text-slate-500',
};

function DeliveryBadge({ status, delivery }) {
  if (status === 'failed') return <span className="inline-flex items-center gap-1 text-red-600 text-xs"><XCircle size={12} /> Fallido</span>;
  if (delivery === 'read')      return <span className="inline-flex items-center gap-1 text-[#4fc3f7] text-xs font-medium">✓✓ Leído</span>;
  if (delivery === 'delivered') return <span className="inline-flex items-center gap-1 text-slate-500 text-xs">✓✓ Entregado</span>;
  if (delivery === 'failed')    return <span className="inline-flex items-center gap-1 text-red-600 text-xs"><XCircle size={12} /> Fallido (entrega)</span>;
  // Solo aceptado por Meta, sin confirmación de entrega aún
  return <span className="inline-flex items-center gap-1 text-green-600 text-xs"><CheckCircle2 size={12} /> Aceptado</span>;
}

// ─── Modal estilo WhatsApp ────────────────────────────────────────────────────
function WhatsAppModal({ log, onClose }) {
  if (!log) return null;

  const time = new Date(log.sent_at).toLocaleString('es-CO', {
    timeZone: 'America/Bogota',
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit'
  });

  // Convertir *texto* a <strong> y _texto_ a <em>
  function formatWaText(text) {
    if (!text) return '';
    return text
      .replace(/\*(.*?)\*/g, '<strong>$1</strong>')
      .replace(/_(.*?)_/g, '<em>$1</em>')
      .replace(/\n/g, '<br/>');
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden" onClick={e => e.stopPropagation()}>

        {/* Header estilo WhatsApp */}
        <div className="bg-[#075e54] text-white px-4 py-3 flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-[#128c7e] flex items-center justify-center shrink-0">
            <MessageSquare size={18} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-semibold text-sm truncate">ChatPay Bot</div>
            <div className="text-xs text-green-200 truncate">→ {log.recipient}</div>
          </div>
          <button onClick={onClose} className="text-white/70 hover:text-white transition">
            <X size={18} />
          </button>
        </div>

        {/* Fondo tipo chat WhatsApp */}
        <div
          className="px-4 py-5 min-h-[200px] max-h-[60vh] overflow-y-auto"
          style={{ background: '#e5ddd5 url("data:image/svg+xml,%3Csvg width=\'300\' height=\'300\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3C/svg%3E")' }}
        >
          {/* Burbuja saliente (derecha) */}
          <div className="flex justify-end">
            <div className="max-w-[85%]">
              <div className="bg-[#dcf8c6] rounded-2xl rounded-tr-sm px-3 py-2 shadow-sm relative">
                {log.message_text ? (
                  <p
                    className="text-sm text-slate-800 leading-relaxed whitespace-pre-wrap"
                    dangerouslySetInnerHTML={{ __html: formatWaText(log.message_text) }}
                  />
                ) : (
                  <p className="text-sm text-slate-400 italic">[Mensaje de plantilla — sin texto guardado]</p>
                )}
                {/* Timestamp + ticks estilo WA */}
                <div className="flex items-center justify-end gap-1 mt-1">
                  <span className="text-[10px] text-slate-400">{time}</span>
                  {log.status === 'failed' || log.delivery_status === 'failed'
                    ? <XCircle size={12} className="text-red-400" />
                    : log.delivery_status === 'read'
                      ? <span className="text-[10px] text-[#4fc3f7] font-bold">✓✓</span>
                      : log.delivery_status === 'delivered'
                        ? <span className="text-[10px] text-slate-400 font-bold">✓✓</span>
                        : <Check size={13} className="text-slate-400" strokeWidth={3} />
                  }
                </div>
              </div>
            </div>
          </div>

          {/* Si falló, mostrar error */}
          {log.status === 'failed' && log.error_message && (
            <div className="mt-3 flex justify-end">
              <div className="max-w-[85%] bg-red-50 border border-red-200 rounded-xl px-3 py-2">
                <p className="text-xs text-red-600 font-medium mb-0.5">⚠ Error de envío</p>
                <p className="text-xs text-red-500 break-all">{log.error_message}</p>
              </div>
            </div>
          )}
        </div>

        {/* Footer con metadata */}
        <div className="border-t border-slate-100 px-4 py-3 space-y-1.5 bg-slate-50">
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-500">Empresa</span>
            <span className="font-medium text-slate-700">{log.companies?.name || '—'}</span>
          </div>
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-500">Entrega</span>
            <DeliveryBadge status={log.status} delivery={log.delivery_status} />
          </div>
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-500">Tipo</span>
            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${TYPE_COLORS[log.message_type] || TYPE_COLORS.other}`}>
              {TYPE_LABELS[log.message_type] || log.message_type}
            </span>
          </div>
          {log.meta_message_id && (
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-500">Meta ID</span>
              <span className="font-mono text-slate-400 text-[10px]">{log.meta_message_id}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function MessageLogs() {
  const [filters, setFilters] = useState({ companyId: '', status: '', type: '' });
  const [page, setPage] = useState(1);
  const [selectedLog, setSelectedLog] = useState(null);

  const params = new URLSearchParams({ action: 'message-logs', page });
  if (filters.companyId) params.set('companyId', filters.companyId);
  if (filters.status)    params.set('status', filters.status);
  if (filters.type)      params.set('type', filters.type);

  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ['message-logs', filters, page],
    queryFn: () => api(`/api/admin/companies?${params}`),
    keepPreviousData: true,
  });

  const { data: companies = [] } = useQuery({
    queryKey: ['admin-companies'],
    queryFn: () => api('/api/admin/companies'),
  });

  const logs = data?.data || [];
  const total = data?.total || 0;
  const totalPages = Math.ceil(total / (data?.pageSize || 50));

  function applyFilter(key, value) {
    setFilters(f => ({ ...f, [key]: value }));
    setPage(1);
  }

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-8">
      <WhatsAppModal log={selectedLog} onClose={() => setSelectedLog(null)} />
      <div className="max-w-6xl mx-auto space-y-6">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
              <MessageSquare size={22} className="text-brand-500" />
              Monitor de mensajes WhatsApp
            </h1>
            <p className="text-sm text-slate-500 mt-1">Últimos 90 días · {total.toLocaleString()} mensaje{total !== 1 ? 's' : ''} en total</p>
          </div>
          <button onClick={() => refetch()} disabled={isFetching} className="btn btn-secondary flex items-center gap-2">
            <RefreshCw size={14} className={isFetching ? 'animate-spin' : ''} />
            Actualizar
          </button>
        </div>

        {/* Filtros */}
        <div className="bg-white rounded-xl border border-slate-200 p-4 flex flex-wrap gap-3 items-end">
          <div className="flex items-center gap-2 text-slate-400 text-sm mr-1">
            <Filter size={14} /> Filtros
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs text-slate-500">Empresa</label>
            <select className="input text-sm" value={filters.companyId} onChange={e => applyFilter('companyId', e.target.value)}>
              <option value="">Todas</option>
              {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs text-slate-500">Estado</label>
            <select className="input text-sm" value={filters.status} onChange={e => applyFilter('status', e.target.value)}>
              <option value="">Todos</option>
              <option value="sent">Enviado</option>
              <option value="failed">Fallido</option>
            </select>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs text-slate-500">Tipo</label>
            <select className="input text-sm" value={filters.type} onChange={e => applyFilter('type', e.target.value)}>
              <option value="">Todos</option>
              {Object.entries(TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>

          {(filters.companyId || filters.status || filters.type) && (
            <button className="btn btn-secondary text-sm mt-4" onClick={() => { setFilters({ companyId: '', status: '', type: '' }); setPage(1); }}>
              Limpiar filtros
            </button>
          )}
        </div>

        {/* Tabla */}
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          {isLoading ? (
            <div className="py-20 text-center text-slate-400">
              <RefreshCw size={20} className="animate-spin inline mb-2" /><br />Cargando…
            </div>
          ) : logs.length === 0 ? (
            <div className="py-20 text-center text-slate-400">
              <MessageSquare size={28} className="mx-auto mb-2 opacity-30" />
              <p>No hay mensajes con los filtros seleccionados.</p>
              {!filters.companyId && !filters.status && !filters.type && (
                <p className="text-xs mt-1">Los mensajes aparecerán aquí una vez que el sistema empiece a enviar notificaciones.</p>
              )}
            </div>
          ) : (
            <>
              {/* Desktop */}
              <table className="w-full text-sm hidden md:table">
                <thead className="bg-slate-50 border-b border-slate-200 text-xs text-slate-500 uppercase tracking-wide">
                  <tr>
                    <th className="text-left px-4 py-3">Fecha</th>
                    <th className="text-left px-4 py-3">Empresa</th>
                    <th className="text-left px-4 py-3">Destinatario</th>
                    <th className="text-left px-4 py-3">Tipo</th>
                    <th className="text-left px-4 py-3">Estado</th>
                    <th className="text-left px-4 py-3">Mensaje</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {logs.map(log => (
                    <tr key={log.id} onClick={() => setSelectedLog(log)} className="hover:bg-slate-50 transition-colors cursor-pointer">
                      <td className="px-4 py-3 text-slate-500 whitespace-nowrap">
                        {new Date(log.sent_at).toLocaleString('es-CO', {
                          timeZone: 'America/Bogota',
                          day: '2-digit', month: '2-digit', year: '2-digit',
                          hour: '2-digit', minute: '2-digit'
                        })}
                      </td>
                      <td className="px-4 py-3">
                        <span className="flex items-center gap-1 text-slate-700">
                          <Building2 size={12} className="text-slate-400 shrink-0" />
                          {log.companies?.name || <span className="text-slate-400 italic">Sin empresa</span>}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-slate-600">{log.recipient}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${TYPE_COLORS[log.message_type] || TYPE_COLORS.other}`}>
                          {TYPE_LABELS[log.message_type] || log.message_type}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <DeliveryBadge status={log.status} delivery={log.delivery_status} />
                      </td>
                      <td className="px-4 py-3 max-w-xs">
                        {log.message_text ? (
                          <p className="text-slate-600 text-xs truncate max-w-[240px]" title={log.message_text}>
                            {log.message_text}
                          </p>
                        ) : <span className="text-slate-300 text-xs">—</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Mobile */}
              <div className="md:hidden divide-y divide-slate-100">
                {logs.map(log => (
                  <div key={log.id} onClick={() => setSelectedLog(log)} className="px-4 py-3 space-y-1 cursor-pointer hover:bg-slate-50 active:bg-slate-100 transition-colors">
                    <div className="flex items-center justify-between gap-2">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${TYPE_COLORS[log.message_type] || TYPE_COLORS.other}`}>
                        {TYPE_LABELS[log.message_type] || log.message_type}
                      </span>
                      <DeliveryBadge status={log.status} delivery={log.delivery_status} />
                    </div>
                    <div className="text-xs text-slate-500">
                      {new Date(log.sent_at).toLocaleString('es-CO', { timeZone: 'America/Bogota', dateStyle: 'short', timeStyle: 'short' })}
                      {' · '}{log.companies?.name || 'Sin empresa'}
                    </div>
                    <div className="font-mono text-xs text-slate-600">{log.recipient}</div>
                    <p className="text-xs text-slate-400 truncate">{log.message_text || '—'}</p>
                    {log.status === 'failed' && log.error_message && (
                      <p className="text-red-500 text-xs">⚠ {log.error_message}</p>
                    )}
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Paginación */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between text-sm text-slate-500">
            <span>Página {page} de {totalPages} · {total} mensajes</span>
            <div className="flex gap-2">
              <button className="btn btn-secondary flex items-center gap-1" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}>
                <ChevronLeft size={14} /> Anterior
              </button>
              <button className="btn btn-secondary flex items-center gap-1" onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}>
                Siguiente <ChevronRight size={14} />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
