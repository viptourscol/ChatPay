import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api.js';
import { Building2, CheckCircle2, XCircle, RefreshCw, Clock, Crown } from 'lucide-react';

const PLAN_OPTS = [
  { value: 'starter',    label: 'Starter',    employees: 1,      verifications: 200,    bankAccounts: 1,  price: 49900 },
  { value: 'business',   label: 'Business',   employees: 20,     verifications: 1000,   bankAccounts: 3,  price: 129900 },
  { value: 'enterprise', label: 'Enterprise', employees: 999999, verifications: 999999, bankAccounts: 999999, price: 299900 },
];

const STATUS_OPTS = [
  { value: 'trial',     label: 'Trial' },
  { value: 'active',    label: 'Activo' },
  { value: 'suspended', label: 'Suspendido' },
  { value: 'cancelled', label: 'Cancelado' },
];

function PlanBadge({ plan }) {
  const colors = {
    starter: 'bg-blue-50 text-blue-700',
    business: 'bg-emerald-50 text-emerald-700',
    enterprise: 'bg-purple-50 text-purple-700'
  };
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold ${colors[plan] || 'bg-slate-100 text-slate-600'}`}>
      {plan === 'enterprise' && <Crown size={10} />}
      {PLAN_OPTS.find(p => p.value === plan)?.label || plan || 'starter'}
    </span>
  );
}

function StatusBadge({ status, trialEndsAt }) {
  const daysLeft = trialEndsAt ? Math.ceil((new Date(trialEndsAt) - new Date()) / 86400000) : null;
  if (status === 'trial') return (
    <span className="inline-flex items-center gap-1 text-amber-600 text-xs">
      <Clock size={12} /> Trial {daysLeft !== null ? `(${daysLeft}d)` : ''}
    </span>
  );
  if (status === 'active') return <span className="inline-flex items-center gap-1 text-emerald-600 text-xs"><CheckCircle2 size={12} /> Activo</span>;
  if (status === 'suspended') return <span className="inline-flex items-center gap-1 text-red-500 text-xs"><XCircle size={12} /> Suspendido</span>;
  return <span className="inline-flex items-center gap-1 text-slate-400 text-xs"><XCircle size={12} /> Cancelado</span>;
}

export default function Admin() {
  const qc = useQueryClient();
  const { data: companies = [], isLoading, error, refetch } = useQuery({
    queryKey: ['admin-companies'],
    queryFn: () => api('/api/admin/companies')
  });

  const mutation = useMutation({
    mutationFn: (body) => api('/api/admin/companies', { method: 'PATCH', body }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-companies'] })
  });

  function changePlan(c, plan) {
    const opt = PLAN_OPTS.find(o => o.value === plan);
    mutation.mutate({
      id: c.id,
      plan,
      max_employees: opt?.employees ?? c.max_employees,
      max_verifications_month: opt?.verifications ?? c.max_verifications_month,
      max_bank_accounts: opt?.bankAccounts ?? c.max_bank_accounts
    });
  }

  function changeStatus(c, subscription_status) {
    const is_active = subscription_status === 'active' || subscription_status === 'trial';
    mutation.mutate({ id: c.id, subscription_status, is_active });
  }

  function extendTrial(c, days) {
    const newDate = new Date(Date.now() + days * 86400000).toISOString();
    mutation.mutate({ id: c.id, trial_ends_at: newDate, subscription_status: 'trial', is_active: true });
  }

  if (isLoading) return <div className="text-slate-400 py-12 text-center">Cargando…</div>;
  if (error) return <div className="text-red-600 py-12 text-center bg-red-50 rounded-xl p-6">Error: {error.message}</div>;

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
              <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Usuario</th>
              <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Plan</th>
              <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Estado</th>
              <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide text-center">Emp.</th>
              <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide text-center">Verif/mes</th>
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
                    <div>
                      <div className="font-medium text-slate-800">{c.name || '—'}</div>
                      <div className="text-xs text-slate-400">{c.user_email || '—'}</div>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3 text-slate-500 text-xs">{c.user_email || '—'}</td>
                <td className="px-4 py-3">
                  <select
                    className="input py-0.5 text-xs"
                    value={c.plan || 'starter'}
                    onChange={(e) => changePlan(c, e.target.value)}
                    disabled={mutation.isPending}
                  >
                    {PLAN_OPTS.map(o => <option key={o.value} value={o.value}>{o.label} — ${o.price.toLocaleString('es-CO')}/mes</option>)}
                  </select>
                </td>
                <td className="px-4 py-3">
                  <select
                    className="input py-0.5 text-xs"
                    value={c.subscription_status || 'trial'}
                    onChange={(e) => changeStatus(c, e.target.value)}
                    disabled={mutation.isPending}
                  >
                    {STATUS_OPTS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                  <div className="mt-1">
                    <StatusBadge status={c.subscription_status} trialEndsAt={c.trial_ends_at} />
                  </div>
                </td>
                <td className="px-4 py-3 text-slate-600 text-center text-xs">
                  {c.max_employees >= 999999 ? '∞' : c.max_employees}
                </td>
                <td className="px-4 py-3 text-slate-600 text-center text-xs">
                  {c.max_verifications_month >= 999999 ? '∞' : c.max_verifications_month}
                </td>
                <td className="px-4 py-3">
                  <div className="flex flex-col gap-1">
                    <button
                      className="btn btn-ghost text-xs text-amber-600"
                      onClick={() => extendTrial(c, 14)}
                      disabled={mutation.isPending}
                    >
                      +14d trial
                    </button>
                    <button
                      className="btn btn-ghost text-xs text-sky-600"
                      onClick={() => extendTrial(c, 30)}
                      disabled={mutation.isPending}
                    >
                      +30d trial
                    </button>
                  </div>
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
