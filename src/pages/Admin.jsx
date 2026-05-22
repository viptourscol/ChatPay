import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api.js';
import {
  Building2, CheckCircle2, XCircle, RefreshCw, Clock, Crown,
  Search, ChevronDown, ChevronUp, Users, ShieldCheck,
  AlertTriangle, X, Banknote, Pencil, Ban,
  BadgeDollarSign,
} from 'lucide-react';

/* ─── Constantes ─────────────────────────────────────────── */
const PLAN_OPTS = [
  { value: 'free',        label: 'Free Trial',  employees: 3,      verifications: 50,     bankAccounts: 1,      adminAlerts: 10,     adminNumbers: 1, price: 0,      color: 'slate'   },
  { value: 'basico',      label: 'Básico',      employees: 2,      verifications: 300,    bankAccounts: 1,      adminAlerts: 0,      adminNumbers: 0, price: 49900,  color: 'blue'    },
  { value: 'estandar',    label: 'Estándar',    employees: 5,      verifications: 800,    bankAccounts: 2,      adminAlerts: 20,     adminNumbers: 1, price: 99900,  color: 'emerald' },
  { value: 'pro',         label: 'Pro',         employees: 15,     verifications: 2500,   bankAccounts: 5,      adminAlerts: 50,     adminNumbers: 2, price: 199900, color: 'violet'  },
  { value: 'empresarial', label: 'Empresarial', employees: 999999, verifications: 999999, bankAccounts: 999999, adminAlerts: 999999, adminNumbers: 2, price: 349900, color: 'purple'  },
  // Legacy — mantener compatibilidad con cuentas existentes
  { value: 'starter',    label: 'Starter (legacy)',    employees: 1,      verifications: 200,    bankAccounts: 1,      adminAlerts: 0,      adminNumbers: 0, price: 49900,  color: 'blue'   },
  { value: 'business',   label: 'Business (legacy)',   employees: 20,     verifications: 1000,   bankAccounts: 3,      adminAlerts: 20,     adminNumbers: 1, price: 129900, color: 'emerald'},
  { value: 'enterprise', label: 'Enterprise (legacy)', employees: 999999, verifications: 999999, bankAccounts: 999999, adminAlerts: 999999, adminNumbers: 2, price: 299900, color: 'purple' },
];

const STATUS_OPTS = [
  { value: 'trial',     label: 'Trial' },
  { value: 'active',    label: 'Activo' },
  { value: 'suspended', label: 'Suspendido' },
  { value: 'cancelled', label: 'Cancelado' },
];

const planColorMap = {
  slate:   { bg: 'bg-slate-100',   text: 'text-slate-600',   border: 'border-slate-200',   ring: 'ring-slate-200'   },
  blue:    { bg: 'bg-blue-50',     text: 'text-blue-700',    border: 'border-blue-200',    ring: 'ring-blue-200'    },
  emerald: { bg: 'bg-emerald-50',  text: 'text-emerald-700', border: 'border-emerald-200', ring: 'ring-emerald-200' },
  violet:  { bg: 'bg-violet-50',   text: 'text-violet-700',  border: 'border-violet-200',  ring: 'ring-violet-200'  },
  purple:  { bg: 'bg-purple-50',   text: 'text-purple-700',  border: 'border-purple-200',  ring: 'ring-purple-200'  },
};

const statusColorMap = {
  trial:     { bg: 'bg-amber-50',   text: 'text-amber-700',   dot: 'bg-amber-400' },
  active:    { bg: 'bg-emerald-50', text: 'text-emerald-700', dot: 'bg-emerald-400' },
  suspended: { bg: 'bg-red-50',     text: 'text-red-700',     dot: 'bg-red-400' },
  cancelled: { bg: 'bg-slate-100',  text: 'text-slate-500',   dot: 'bg-slate-400' },
};

const fmtPrice = (n) => `$${n.toLocaleString('es-CO')}`;
const fmtDate  = (d) => d ? new Date(d).toLocaleDateString('es-CO', { day:'2-digit', month:'short', year:'numeric' }) : '—';
const daysLeft = (d) => d ? Math.ceil((new Date(d) - new Date()) / 86400000) : null;

/* ─── PlanBadge ──────────────────────────────────────────── */
function PlanBadge({ plan }) {
  const opt = PLAN_OPTS.find(p => p.value === plan);
  const clr = planColorMap[opt?.color] ?? planColorMap.blue;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold border ${clr.bg} ${clr.text} ${clr.border}`}>
      {plan === 'enterprise' && <Crown size={10} />}
      {opt?.label || plan || 'Básico'}
    </span>
  );
}

/* ─── StatusBadge ────────────────────────────────────────── */
function StatusBadge({ status, trialEndsAt, subExpiresAt }) {
  const clr   = statusColorMap[status] ?? statusColorMap.cancelled;
  const days  = status === 'trial'  ? daysLeft(trialEndsAt)
               : status === 'active' ? daysLeft(subExpiresAt)
               : null;
  const label = STATUS_OPTS.find(s => s.value === status)?.label || status;
  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium ${clr.bg} ${clr.text}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${clr.dot}`} />
      {label}
      {days !== null && <span className="opacity-70">({days}d)</span>}
    </span>
  );
}

/* ─── StatCard ───────────────────────────────────────────── */
function StatCard({ icon: Icon, label, value, sub, color = 'brand' }) {
  const colors = {
    brand:   'bg-brand-50 text-brand-600',
    emerald: 'bg-emerald-50 text-emerald-600',
    amber:   'bg-amber-50 text-amber-600',
    purple:  'bg-purple-50 text-purple-600',
    rose:    'bg-rose-50 text-rose-600',
  };
  const str = String(value ?? '');
  const fontSize = str.length > 12 ? 'text-base' : str.length > 8 ? 'text-xl' : 'text-2xl';
  return (
    <div className="card flex items-center gap-3 py-4 px-4 md:px-5">
      <div className={`w-10 h-10 rounded-xl grid place-items-center shrink-0 ${colors[color]}`}>
        <Icon size={18} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-xs text-slate-500 font-medium truncate">{label}</p>
        <p className={`${fontSize} font-bold text-slate-800 leading-tight break-all`}>{value}</p>
        {sub && <p className="text-xs text-slate-400">{sub}</p>}
      </div>
    </div>
  );
}

/* ─── EditModal ──────────────────────────────────────────── */
function EditModal({ company, onClose, onSave, isPending }) {
  const [form, setForm] = useState({
    plan:                    company.plan || 'basico',
    subscription_status:     company.subscription_status || 'trial',
    trial_ends_at:           company.trial_ends_at ? company.trial_ends_at.slice(0, 10) : '',
    subscription_expires_at: company.subscription_expires_at ? company.subscription_expires_at.slice(0, 10) : '',
    max_employees:           company.max_employees ?? 1,
    max_verifications_month: company.max_verifications_month ?? 200,
    max_bank_accounts:       company.max_bank_accounts ?? 1,
  });

  function applyPlan(plan) {
    const opt = PLAN_OPTS.find(o => o.value === plan);
    setForm(f => ({
      ...f, plan,
      max_employees:           opt.employees,
      max_verifications_month: opt.verifications,
      max_bank_accounts:       opt.bankAccounts,
      max_admin_alerts:        opt.adminAlerts,
      max_admin_numbers:       opt.adminNumbers,
    }));
  }

  function extendTrial(days) {
    const base = form.trial_ends_at ? new Date(form.trial_ends_at) : new Date();
    if (base < new Date()) base.setTime(Date.now());
    base.setDate(base.getDate() + days);
    setForm(f => ({ ...f, trial_ends_at: base.toISOString().slice(0, 10), subscription_status: 'trial' }));
  }

  function extendSubscription(months) {
    const base = form.subscription_expires_at ? new Date(form.subscription_expires_at) : new Date();
    if (base < new Date()) base.setTime(Date.now());
    base.setMonth(base.getMonth() + months);
    setForm(f => ({ ...f, subscription_expires_at: base.toISOString().slice(0, 10), subscription_status: 'active' }));
  }

  function handleSave() {
    const is_active = form.subscription_status === 'active' || form.subscription_status === 'trial';
    onSave({
      id: company.id,
      ...form,
      trial_ends_at:           form.trial_ends_at           ? new Date(form.trial_ends_at).toISOString()           : null,
      subscription_expires_at: form.subscription_expires_at ? new Date(form.subscription_expires_at).toISOString() : null,
      is_active,
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg animate-fade-up">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-brand-50 text-brand-600 grid place-items-center font-bold text-sm">
              {(company.name || 'E').charAt(0).toUpperCase()}
            </div>
            <div>
              <p className="font-semibold text-slate-800">{company.name || 'Empresa'}</p>
              <p className="text-xs text-slate-400">{company.user_email}</p>
            </div>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-lg hover:bg-slate-100 grid place-items-center text-slate-400 transition">
            <X size={16} />
          </button>
        </div>

        <div className="px-6 py-5 space-y-5 max-h-[70vh] overflow-y-auto">
          {/* Plan */}
          <div>
            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide block mb-2">Plan</label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mb-2">
              {PLAN_OPTS.filter(o => !['starter','business','enterprise'].includes(o.value)).map(opt => {
                const clr    = planColorMap[opt.color];
                const active = form.plan === opt.value;
                return (
                  <button
                    key={opt.value}
                    onClick={() => applyPlan(opt.value)}
                    className={`rounded-xl border-2 p-3 text-left transition-all ${
                      active ? `${clr.bg} ${clr.border} ${clr.text} ring-2 ${clr.ring}` : 'border-slate-200 hover:border-slate-300 text-slate-600'
                    }`}
                  >
                    <div className="flex items-center gap-1 mb-0.5">
                      {opt.value === 'empresarial' && <Crown size={10} />}
                      <span className="text-xs font-bold">{opt.label}</span>
                    </div>
                    <div className="text-xs opacity-70">{opt.price === 0 ? 'Gratis 14d' : `${fmtPrice(opt.price)}/mes`}</div>
                  </button>
                );
              })}
            </div>
            {/* Legacy plans — solo si la empresa ya tiene uno */}
            {['starter','business','enterprise'].includes(form.plan) && (
              <div className="mt-1">
                <p className="text-[10px] text-slate-400 mb-1">Plan legacy activo:</p>
                <div className="grid grid-cols-3 gap-2">
                  {PLAN_OPTS.filter(o => ['starter','business','enterprise'].includes(o.value)).map(opt => {
                    const clr    = planColorMap[opt.color];
                    const active = form.plan === opt.value;
                    return (
                      <button key={opt.value} onClick={() => applyPlan(opt.value)}
                        className={`rounded-xl border-2 p-2 text-left transition-all opacity-70 ${
                          active ? `${clr.bg} ${clr.border} ${clr.text} ring-2 ${clr.ring}` : 'border-slate-200 text-slate-500'
                        }`}>
                        <div className="text-[10px] font-bold">{opt.label}</div>
                        <div className="text-[10px] opacity-70">{fmtPrice(opt.price)}/mes</div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Estado */}
          <div>
            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide block mb-2">Estado de suscripción</label>
            <div className="grid grid-cols-2 gap-2">
              {STATUS_OPTS.map(opt => {
                const active = form.subscription_status === opt.value;
                const clr    = statusColorMap[opt.value];
                return (
                  <button
                    key={opt.value}
                    onClick={() => setForm(f => ({ ...f, subscription_status: opt.value }))}
                    className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm transition-all ${
                      active ? `${clr.bg} border-transparent ${clr.text} font-medium` : 'border-slate-200 text-slate-500 hover:border-slate-300'
                    }`}
                  >
                    <span className={`w-2 h-2 rounded-full ${active ? clr.dot : 'bg-slate-300'}`} />
                    {opt.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Trial */}
          <div>
            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide block mb-2">Vencimiento trial</label>
            <div className="flex items-center gap-2">
              <input
                type="date"
                className="input flex-1 text-sm"
                value={form.trial_ends_at}
                onChange={e => setForm(f => ({ ...f, trial_ends_at: e.target.value }))}
              />
              <button onClick={() => extendTrial(7)}  className="btn btn-ghost text-xs px-2 py-1 text-amber-600 border border-amber-200">+7d</button>
              <button onClick={() => extendTrial(14)} className="btn btn-ghost text-xs px-2 py-1 text-amber-600 border border-amber-200">+14d</button>
              <button onClick={() => extendTrial(30)} className="btn btn-ghost text-xs px-2 py-1 text-sky-600 border border-sky-200">+30d</button>
            </div>
          </div>

          {/* Vencimiento suscripción activa */}
          <div>
            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide block mb-2">Vencimiento suscripción activa</label>
            <div className="flex items-center gap-2">
              <input
                type="date"
                className="input flex-1 text-sm"
                value={form.subscription_expires_at}
                onChange={e => setForm(f => ({ ...f, subscription_expires_at: e.target.value }))}
              />
              <button onClick={() => extendSubscription(1)}  className="btn btn-ghost text-xs px-2 py-1 text-emerald-600 border border-emerald-200">+1m</button>
              <button onClick={() => extendSubscription(3)}  className="btn btn-ghost text-xs px-2 py-1 text-emerald-600 border border-emerald-200">+3m</button>
              <button onClick={() => extendSubscription(12)} className="btn btn-ghost text-xs px-2 py-1 text-purple-600 border border-purple-200">+1a</button>
            </div>
            {form.subscription_expires_at && (
              <p className="text-xs text-slate-400 mt-1">
                {(() => { const d = Math.ceil((new Date(form.subscription_expires_at) - new Date()) / 86400000); return d > 0 ? `${d} días restantes` : '⚠ Ya vencida'; })()}
              </p>
            )}
          </div>

          {/* Límites */}
          <div>
            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide block mb-2">Límites personalizados</label>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="text-xs text-slate-400 block mb-1">Empleados</label>
                <input type="number" min="1" className="input text-sm" value={form.max_employees}
                  onChange={e => setForm(f => ({ ...f, max_employees: +e.target.value }))} />
              </div>
              <div>
                <label className="text-xs text-slate-400 block mb-1">Verif/mes</label>
                <input type="number" min="1" className="input text-sm" value={form.max_verifications_month}
                  onChange={e => setForm(f => ({ ...f, max_verifications_month: +e.target.value }))} />
              </div>
              <div>
                <label className="text-xs text-slate-400 block mb-1">Cuentas ban.</label>
                <input type="number" min="1" className="input text-sm" value={form.max_bank_accounts}
                  onChange={e => setForm(f => ({ ...f, max_bank_accounts: +e.target.value }))} />
              </div>
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-2 px-6 py-4 border-t border-slate-100 bg-slate-50 rounded-b-2xl">
          <button onClick={onClose} className="btn btn-ghost">Cancelar</button>
          <button onClick={handleSave} disabled={isPending} className="btn btn-primary gap-2">
            {isPending && <RefreshCw size={14} className="animate-spin" />}
            Guardar cambios
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── CompanyRow ─────────────────────────────────────────── */
function CompanyRow({ c, onEdit }) {
  const days      = daysLeft(c.trial_ends_at);
  const subDays   = daysLeft(c.subscription_expires_at);
  const isWarning = c.subscription_status === 'trial' && days !== null && days <= 3 && days > 0;
  const isExpired = c.subscription_status === 'trial' && days !== null && days <= 0;
  const subExpiring = c.subscription_status === 'active' && subDays !== null && subDays <= 7 && subDays > 0;
  const subExpired  = c.subscription_status === 'active' && subDays !== null && subDays <= 0;

  return (
    <tr className={`group hover:bg-slate-50/80 transition-colors border-b border-slate-100 last:border-0 ${!c.is_active ? 'opacity-50' : ''}`}>
      <td className="px-5 py-4">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-brand-100 to-brand-200 text-brand-700 font-bold text-sm grid place-items-center shrink-0 uppercase">
            {(c.name || 'E').charAt(0)}
          </div>
          <div>
            <div className="font-semibold text-slate-800 text-sm">{c.name || '—'}</div>
            <div className="text-xs text-slate-400">{c.user_email || '—'}</div>
          </div>
        </div>
      </td>
      <td className="px-5 py-4">
        <PlanBadge plan={c.plan} />
      </td>
      <td className="px-5 py-4">
        <div className="flex flex-col gap-0.5">
          <StatusBadge status={c.subscription_status} trialEndsAt={c.trial_ends_at} subExpiresAt={c.subscription_expires_at} />
          {c.subscription_status === 'trial' && c.trial_ends_at && (
            <span className={`text-xs ${isExpired ? 'text-red-500 font-semibold' : isWarning ? 'text-amber-500' : 'text-slate-400'}`}>
              {isExpired ? '⚠ Trial vencido' : `Vence ${fmtDate(c.trial_ends_at)}`}
            </span>
          )}
          {c.subscription_status === 'active' && c.subscription_expires_at && (
            <span className={`text-xs ${subExpired ? 'text-red-500 font-semibold' : subExpiring ? 'text-amber-500 font-medium' : 'text-slate-400'}`}>
              {subExpired ? '⚠ Suscripción vencida' : `Vence ${fmtDate(c.subscription_expires_at)}`}
            </span>
          )}
          {c.subscription_status === 'active' && !c.subscription_expires_at && (
            <span className="text-xs text-slate-300">Sin fecha registrada</span>
          )}
        </div>
      </td>
      <td className="px-5 py-4">
        <div className="flex flex-col gap-0.5 text-xs text-slate-500">
          <span className="flex items-center gap-1.5">
            <Users size={11} className="text-slate-400" />
            {c.max_employees >= 999999 ? '∞' : c.max_employees} emp.
          </span>
          <span className="flex items-center gap-1.5">
            <ShieldCheck size={11} className="text-slate-400" />
            {c.max_verifications_month >= 999999 ? '∞' : c.max_verifications_month} verif/mes
          </span>
          <span className="flex items-center gap-1.5">
            <Banknote size={11} className="text-slate-400" />
            {c.max_bank_accounts >= 999999 ? '∞' : c.max_bank_accounts} cuentas
          </span>
        </div>
      </td>
      <td className="px-5 py-4">
        <span className="text-sm font-semibold text-slate-700">
          {fmtPrice(PLAN_OPTS.find(p => p.value === c.plan)?.price ?? 49900)}
          <span className="text-xs text-slate-400 font-normal">/mes</span>
        </span>
      </td>
      <td className="px-5 py-4 text-xs text-slate-400">
        {fmtDate(c.created_at)}
      </td>
      <td className="px-5 py-4">
        <button
          onClick={() => onEdit(c)}
          className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1.5 text-xs text-brand-600 font-medium hover:text-brand-800 px-2.5 py-1.5 rounded-lg hover:bg-brand-50"
        >
          <Pencil size={12} /> Editar
        </button>
      </td>
    </tr>
  );
}

/* ─── CompanyCard (móvil) ────────────────────────────────── */
function CompanyCard({ c, onEdit }) {
  return (
    <div className={`card ${!c.is_active ? 'opacity-50' : ''}`}>
      <div className="flex items-start justify-between gap-2 mb-3">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-brand-100 to-brand-200 text-brand-700 font-bold text-sm grid place-items-center shrink-0 uppercase">
            {(c.name || 'E').charAt(0)}
          </div>
          <div className="min-w-0">
            <div className="font-semibold text-slate-800 text-sm truncate">{c.name || '—'}</div>
            <div className="text-xs text-slate-400 truncate">{c.user_email || '—'}</div>
          </div>
        </div>
        <button
          onClick={() => onEdit(c)}
          className="shrink-0 flex items-center gap-1 text-xs text-brand-600 font-medium px-2 py-1 rounded-lg hover:bg-brand-50 border border-brand-200"
        >
          <Pencil size={11} /> Editar
        </button>
      </div>
      <div className="flex flex-wrap gap-2 mb-2">
        <PlanBadge plan={c.plan} />
        <StatusBadge status={c.subscription_status} trialEndsAt={c.trial_ends_at} subExpiresAt={c.subscription_expires_at} />
      </div>
      <div className="flex items-center justify-between text-xs text-slate-500">
        <div className="flex gap-3">
          <span className="flex items-center gap-1"><Users size={10} />{c.max_employees >= 999999 ? '∞' : c.max_employees} emp.</span>
          <span className="flex items-center gap-1"><ShieldCheck size={10} />{c.max_verifications_month >= 999999 ? '∞' : c.max_verifications_month}/mes</span>
        </div>
        <div className="text-right">
          <div className="font-semibold text-slate-700">{fmtPrice(PLAN_OPTS.find(p => p.value === c.plan)?.price ?? 49900)}<span className="font-normal text-slate-400">/mes</span></div>
          {c.subscription_status === 'active' && c.subscription_expires_at && (
            <div className={`text-xs ${daysLeft(c.subscription_expires_at) <= 7 ? 'text-amber-500' : 'text-slate-400'}`}>
              Vence {fmtDate(c.subscription_expires_at)}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ─── Admin Page ─────────────────────────────────────────── */
export default function Admin() {
  const qc = useQueryClient();
  const [search,       setSearch]      = useState('');
  const [filterStatus, setFilter]      = useState('all');
  const [filterPlan,   setFilterPlan]  = useState('all');
  const [editing,      setEditing]     = useState(null);
  const [sortBy,       setSortBy]      = useState('name');
  const [sortDir,      setSortDir]     = useState('asc');

  const { data: companies = [], isLoading, error, refetch, isFetching } = useQuery({
    queryKey: ['admin-companies'],
    queryFn:  () => api('/api/admin/companies'),
  });

  const mutation = useMutation({
    mutationFn: (body) => api('/api/admin/companies', { method: 'PATCH', body }),
    onSuccess:  () => { qc.invalidateQueries({ queryKey: ['admin-companies'] }); setEditing(null); },
  });

  /* Stats */
  const stats = useMemo(() => {
    const total   = companies.length;
    const active  = companies.filter(c => c.subscription_status === 'active').length;
    const trial   = companies.filter(c => c.subscription_status === 'trial').length;
    const expired = companies.filter(c => {
      const d = daysLeft(c.trial_ends_at);
      return c.subscription_status === 'trial' && d !== null && d <= 0;
    }).length;
    const mrr = companies
      .filter(c => c.subscription_status === 'active')
      .reduce((sum, c) => sum + (PLAN_OPTS.find(p => p.value === c.plan)?.price ?? 0), 0);
    return { total, active, trial, expired, mrr };
  }, [companies]);

  /* Filter + sort */
  const filtered = useMemo(() => {
    let list = [...companies];
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(c =>
        (c.name || '').toLowerCase().includes(q) ||
        (c.user_email || '').toLowerCase().includes(q)
      );
    }
    if (filterStatus !== 'all') list = list.filter(c => c.subscription_status === filterStatus);
    if (filterPlan   !== 'all') list = list.filter(c => c.plan === filterPlan);

    list.sort((a, b) => {
      let av, bv;
      if      (sortBy === 'name')   { av = a.name || '';   bv = b.name || ''; }
      else if (sortBy === 'plan')   { av = a.plan || '';   bv = b.plan || ''; }
      else if (sortBy === 'status') { av = a.subscription_status || ''; bv = b.subscription_status || ''; }
      else if (sortBy === 'date')   { av = a.created_at || ''; bv = b.created_at || ''; }
      const cmp = av < bv ? -1 : av > bv ? 1 : 0;
      return sortDir === 'asc' ? cmp : -cmp;
    });
    return list;
  }, [companies, search, filterStatus, filterPlan, sortBy, sortDir]);

  function toggleSort(col) {
    if (sortBy === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortBy(col); setSortDir('asc'); }
  }

  function SortIcon({ col }) {
    if (sortBy !== col) return <ChevronDown size={12} className="opacity-30" />;
    return sortDir === 'asc' ? <ChevronUp size={12} /> : <ChevronDown size={12} />;
  }

  if (isLoading) return (
    <div className="flex flex-col items-center justify-center py-24 gap-3 text-slate-400">
      <RefreshCw size={24} className="animate-spin" />
      <span className="text-sm">Cargando empresas…</span>
    </div>
  );

  if (error) return (
    <div className="rounded-xl bg-red-50 border border-red-200 p-6 text-red-700 text-sm">
      <AlertTriangle size={16} className="inline mr-2" />
      Error: {error.message}
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="font-serif text-3xl text-slate-900">Panel Admin</h1>
          <p className="text-slate-500 text-sm mt-0.5">Gestión de empresas, planes y suscripciones</p>
        </div>
        <button
          onClick={() => refetch()}
          disabled={isFetching}
          className="btn btn-ghost text-sm flex items-center gap-2 border border-slate-200"
        >
          <RefreshCw size={14} className={isFetching ? 'animate-spin' : ''} />
          Actualizar
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <StatCard icon={Building2}       label="Total empresas" value={stats.total}          color="brand"   />
        <StatCard icon={CheckCircle2}    label="Activas"        value={stats.active}          color="emerald" />
        <StatCard icon={Clock}           label="En trial"       value={stats.trial}           color="amber"   />
        <StatCard icon={AlertTriangle}   label="Trial vencido"  value={stats.expired}         color="rose"    />
        <StatCard icon={BadgeDollarSign} label="MRR estimado"   value={fmtPrice(stats.mrr)}   color="purple"  sub="clientes activos" />
      </div>

      {/* Filtros */}
      <div className="card py-3 px-4 flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[180px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            className="input pl-8 text-sm w-full"
            placeholder="Buscar empresa o email…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <select className="input text-sm py-1.5" value={filterStatus} onChange={e => setFilter(e.target.value)}>
          <option value="all">Todos los estados</option>
          {STATUS_OPTS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        <select className="input text-sm py-1.5" value={filterPlan} onChange={e => setFilterPlan(e.target.value)}>
          <option value="all">Todos los planes</option>
          {PLAN_OPTS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        {(search || filterStatus !== 'all' || filterPlan !== 'all') && (
          <button
            onClick={() => { setSearch(''); setFilter('all'); setFilterPlan('all'); }}
            className="text-xs text-slate-400 hover:text-slate-600 flex items-center gap-1"
          >
            <X size={12} /> Limpiar
          </button>
        )}
        <span className="text-xs text-slate-400 ml-auto">
          {filtered.length} de {companies.length} empresas
        </span>
      </div>

      {/* Cards — solo en móvil */}
      <div className="space-y-3 md:hidden">
        {filtered.map(c => (
          <CompanyCard key={c.id} c={c} onEdit={setEditing} />
        ))}
        {filtered.length === 0 && (
          <div className="card text-center py-10 text-slate-400">
            <Building2 size={32} className="mx-auto mb-3 opacity-30" />
            <p className="text-sm">Sin empresas que coincidan</p>
          </div>
        )}
      </div>

      {/* Tabla — solo en md+ */}
      <div className="card overflow-hidden p-0 hidden md:block">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-100">
              <tr>
                {[
                  { key: 'name',   label: 'Empresa' },
                  { key: 'plan',   label: 'Plan' },
                  { key: 'status', label: 'Estado' },
                  { key: null,     label: 'Límites' },
                  { key: null,     label: 'Precio' },
                  { key: 'date',   label: 'Registro' },
                  { key: null,     label: '' },
                ].map((col, i) => (
                  <th
                    key={i}
                    onClick={col.key ? () => toggleSort(col.key) : undefined}
                    className={`px-5 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide ${col.key ? 'cursor-pointer select-none hover:text-slate-700' : ''}`}
                  >
                    <span className="inline-flex items-center gap-1">
                      {col.label}
                      {col.key && <SortIcon col={col.key} />}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map(c => (
                <CompanyRow key={c.id} c={c} onEdit={setEditing} />
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-16 text-center text-slate-400">
                    <Building2 size={32} className="mx-auto mb-3 opacity-30" />
                    <p className="text-sm">Sin empresas que coincidan con los filtros</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal de edición */}
      {editing && (
        <EditModal
          company={editing}
          onClose={() => setEditing(null)}
          onSave={(body) => mutation.mutate(body)}
          isPending={mutation.isPending}
        />
      )}
    </div>
  );
}
