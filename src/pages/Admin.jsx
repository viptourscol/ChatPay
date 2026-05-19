import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api.js';
import { Building2, CheckCircle2, XCircle, RefreshCw } from 'lucide-react';

const PLAN_OPTS = [
  { value: 'free',    label: 'Free',    employees: 3  },
  { value: 'starter', label: 'Starter', employees: 15 },
  { value: 'pro',     label: 'Pro',     employees: 100 },
];

function PlanBadge({ plan }) {
  const colors = { free: 'bg-slate-100 text-slate-600', starter: 'bg-blue-50 text-blue-700', pro: 'bg-emerald-50 text-emerald-700' };
  return (
    <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold ${colors[plan] || colors.free}`}>
      {plan || 'free'}
    </span>
  );
}

export default function Admin() {
  const qc = useQueryClient();
  const { data: companies = [], isLoading, refetch } = useQuery({
    queryKey: ['admin-companies'],
    queryFn: () => api('/api/admin/companies')
  });

  const mutation = useMutation({
    mutationFn: (body) => api('/api/admin/companies', { method: 'PATCH', body }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-companies'] })
  });

  function toggleActive(c) {
    mutation.mutate({ id: c.id, is_active: !c.is_active });
  }

  function changePlan(c, plan) {
    const opt = PLAN_OPTS.find(o => o.value === plan);
    mutation.mutate({ id: c.id, plan, max_employees: opt?.employees ?? c.max_employees });
  }

  if (isLoading) return <div className="text-slate-400 py-12 text-center">Cargando…</div>;

  return (
    <div>
      <header className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="font-serif text-3xl">Panel Admin</h1>
          <p className="text-slate-500 text-sm">Gestión de empresas y planes.</p>
        </div>
        <button onClick={() => refetch()} className="btn btn-ghost text-sm flex items-center gap-1.5">
          <RefreshCw size={14} /> Refrescar
        </button>
      </header>

      <div className="card overflow-hidden p-0">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 border-b border-slate-100 text-left">
            <tr>
              <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Empresa</th>
              <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Email alias</th>
              <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Usuario</th>
              <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Plan</th>
              <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Empleados</th>
              <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Estado</th>
              <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {companies.map((c) => (
              <tr key={c.id} className={`hover:bg-slate-50 transition-colors ${!c.is_active ? 'opacity-50' : ''}`}>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-full bg-brand-100 text-brand-700 text-xs font-bold grid place-items-center shrink-0">
                      <Building2 size={13} />
                    </div>
                    <span className="font-medium text-slate-800">{c.name || '—'}</span>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <code className="text-xs text-slate-500">{c.email_alias}@chatpay.co</code>
                </td>
                <td className="px-4 py-3 text-slate-500 text-xs">{c.user_email || '—'}</td>
                <td className="px-4 py-3">
                  <select
                    className="input py-0.5 text-xs"
                    value={c.plan || 'free'}
                    onChange={(e) => changePlan(c, e.target.value)}
                  >
                    {PLAN_OPTS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </td>
                <td className="px-4 py-3 text-slate-600 text-center">{c.max_employees}</td>
                <td className="px-4 py-3">
                  {c.is_active
                    ? <span className="inline-flex items-center gap-1 text-emerald-600 text-xs"><CheckCircle2 size={13} /> Activa</span>
                    : <span className="inline-flex items-center gap-1 text-red-500 text-xs"><XCircle size={13} /> Suspendida</span>}
                </td>
                <td className="px-4 py-3">
                  <button
                    className={`btn text-xs ${c.is_active ? 'btn-ghost text-red-500' : 'btn-ghost text-emerald-600'}`}
                    onClick={() => toggleActive(c)}
                    disabled={mutation.isPending}
                  >
                    {c.is_active ? 'Suspender' : 'Activar'}
                  </button>
                </td>
              </tr>
            ))}
            {companies.length === 0 && (
              <tr><td colSpan={7} className="px-4 py-10 text-center text-slate-400">Sin empresas registradas</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
