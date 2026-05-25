import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api.js';
import { supabase } from '../lib/supabase.js';
import { MessageSquare, Link2, Clock, AlertCircle, CheckCircle2, XCircle, RefreshCw, Filter } from 'lucide-react';

async function fetchSmsData(filters) {
  const query = { resource: 'sms-admin' };
  if (filters.status)     query.status     = filters.status;
  if (filters.bank)       query.bank       = filters.bank;
  if (filters.company_id) query.company_id = filters.company_id;
  return api('/api/stats', { query });
}

async function fetchCompaniesForFilter() {
  const { data } = await supabase.from('companies').select('id, name').order('name');
  return data || [];
}

const STATUS_CFG = {
  linked:        { label: 'Vinculado',    bg: 'bg-emerald-100', text: 'text-emerald-700', Icon: CheckCircle2 },
  pending_match: { label: 'Sin vincular', bg: 'bg-amber-100',   text: 'text-amber-700',   Icon: Clock },
  ignored:       { label: 'Ignorado',     bg: 'bg-slate-100',   text: 'text-slate-500',   Icon: XCircle },
};

function fmtDate(s) {
  if (!s) return '—';
  return new Date(s).toLocaleString('es-CO', {
    timeZone: 'America/Bogota', day: '2-digit', month: '2-digit',
    year: '2-digit', hour: '2-digit', minute: '2-digit'
  });
}

function fmtMoney(n) {
  if (!n && n !== 0) return '—';
  return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(n);
}

export default function SuperAdminSms() {
  const [filters, setFilters] = useState({ status: '', bank: '', company_id: '' });
  const [expanded, setExpanded] = useState(null);

  const { data: smsList = [], isLoading, refetch, isFetching } = useQuery({
    queryKey: ['superadmin-sms', filters],
    queryFn: () => fetchSmsData(filters),
    refetchInterval: 30000,
  });

  const { data: companies = [] } = useQuery({
    queryKey: ['superadmin-companies-filter'],
    queryFn: fetchCompaniesForFilter,
  });

  // KPIs
  const total   = smsList.length;
  const linked  = smsList.filter(s => s.status === 'linked').length;
  const pending = smsList.filter(s => s.status === 'pending_match').length;
  const ignored = smsList.filter(s => s.status === 'ignored').length;

  return (
    <div>
      <header className="mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-serif text-2xl md:text-3xl font-bold text-slate-800">SMS Backup — Monitor</h1>
            <p className="text-slate-500 text-sm mt-1">Últimos 100 SMS bancarios recibidos de todas las empresas.</p>
          </div>
          <button
            onClick={() => refetch()}
            disabled={isFetching}
            className="p-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 transition-colors"
            title="Actualizar"
          >
            <RefreshCw size={16} className={isFetching ? 'animate-spin' : ''} />
          </button>
        </div>
      </header>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        {[
          { label: 'Total recibidos', value: total, color: 'text-slate-800', bg: 'bg-slate-50' },
          { label: 'Vinculados', value: linked, color: 'text-emerald-700', bg: 'bg-emerald-50' },
          { label: 'Sin vincular', value: pending, color: 'text-amber-700', bg: 'bg-amber-50' },
          { label: 'Ignorados', value: ignored, color: 'text-slate-500', bg: 'bg-slate-50' },
        ].map(({ label, value, color, bg }) => (
          <div key={label} className={`card py-3 ${bg}`}>
            <div className="text-xs text-slate-500 mb-1">{label}</div>
            <div className={`text-2xl font-semibold ${color}`}>{value}</div>
          </div>
        ))}
      </div>

      {/* Filtros */}
      <div className="card mb-4">
        <div className="flex items-center gap-2 mb-3">
          <Filter size={14} className="text-slate-400" />
          <span className="text-sm font-medium text-slate-600">Filtros</span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <select
            className="input text-sm"
            value={filters.status}
            onChange={e => setFilters(f => ({ ...f, status: e.target.value }))}
          >
            <option value="">Todos los estados</option>
            <option value="linked">Vinculados</option>
            <option value="pending_match">Sin vincular</option>
            <option value="ignored">Ignorados</option>
          </select>
          <select
            className="input text-sm"
            value={filters.bank}
            onChange={e => setFilters(f => ({ ...f, bank: e.target.value }))}
          >
            <option value="">Todos los bancos</option>
            <option value="Bancolombia">Bancolombia</option>
          </select>
          <select
            className="input text-sm"
            value={filters.company_id}
            onChange={e => setFilters(f => ({ ...f, company_id: e.target.value }))}
          >
            <option value="">Todas las empresas</option>
            {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
      </div>

      {/* Tabla */}
      {isLoading ? (
        <div className="card py-16 text-center text-slate-400">Cargando…</div>
      ) : smsList.length === 0 ? (
        <div className="card py-16 text-center text-slate-400">
          <MessageSquare size={32} className="mx-auto mb-3 opacity-30" />
          <p>No hay SMS registrados con esos filtros.</p>
        </div>
      ) : (
        <div className="card overflow-hidden p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  {['Empresa', 'Banco', 'Monto', 'Referencia', 'Remitente', 'Fuente', 'Estado', 'Recibido'].map(h => (
                    <th key={h} className="text-left px-4 py-3 text-xs font-medium text-slate-500 whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {smsList.map(sms => {
                  const cfg = STATUS_CFG[sms.status] || STATUS_CFG.ignored;
                  const isExpanded = expanded === sms.id;
                  return (
                    <>
                      <tr
                        key={sms.id}
                        className="hover:bg-slate-50 cursor-pointer transition-colors"
                        onClick={() => setExpanded(isExpanded ? null : sms.id)}
                      >
                        <td className="px-4 py-3 font-medium text-slate-700 whitespace-nowrap max-w-[140px] truncate">
                          {sms.companies?.name || sms.company_id.slice(0, 8)}
                        </td>
                        <td className="px-4 py-3 text-slate-600">{sms.bank || '—'}</td>
                        <td className="px-4 py-3 font-mono text-slate-800">{fmtMoney(sms.amount)}</td>
                        <td className="px-4 py-3 font-mono text-xs text-slate-600">{sms.reference || '—'}</td>
                        <td className="px-4 py-3 text-slate-600 max-w-[140px] truncate">{sms.sender_name || '—'}</td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${sms.source === 'ios' ? 'bg-blue-100 text-blue-700' : 'bg-green-100 text-green-700'}`}>
                            {sms.source}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1.5">
                            <cfg.Icon size={13} className={cfg.text} />
                            <span className={`text-xs font-medium ${cfg.text}`}>{cfg.label}</span>
                            {sms.transaction_id && (
                              <Link2 size={11} className="text-slate-300" title="Vinculado a transacción" />
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-xs text-slate-500 whitespace-nowrap">{fmtDate(sms.received_at)}</td>
                      </tr>
                      {isExpanded && (
                        <tr key={`${sms.id}-expanded`} className="bg-slate-50">
                          <td colSpan={8} className="px-4 py-3">
                            <div className="flex items-start gap-2">
                              <MessageSquare size={13} className="text-slate-400 mt-0.5 shrink-0" />
                              <div>
                                <p className="text-xs font-medium text-slate-500 mb-1">Texto original del SMS:</p>
                                <p className="text-xs text-slate-700 font-mono bg-white border border-slate-200 rounded-lg px-3 py-2 whitespace-pre-wrap">{sms.raw_text}</p>
                                {sms.transaction_id && (
                                  <p className="text-xs text-emerald-600 mt-1.5">Transaction ID: <code className="font-mono">{sms.transaction_id}</code></p>
                                )}
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
