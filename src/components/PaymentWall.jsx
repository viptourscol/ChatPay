import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { api } from '../lib/api.js';
import {
  Crown, Zap, Building2, CheckCircle2, Loader2,
  ShieldCheck, Clock, AlertTriangle, CreditCard,
  Sparkles, LogOut, ExternalLink
} from 'lucide-react';

/* ─── Datos de planes ─────────────────────────────────── */
const PLANS = [
  {
    key:      'starter',
    label:    'Starter',
    price:    49900,
    icon:     Zap,
    color:    'blue',
    features: ['1 empleado', '200 verificaciones/mes', '1 cuenta bancaria'],
  },
  {
    key:      'business',
    label:    'Business',
    price:    129900,
    icon:     Building2,
    color:    'emerald',
    popular:  true,
    features: ['20 empleados', '1.000 verificaciones/mes', '3 cuentas bancarias', 'Soporte WhatsApp'],
  },
  {
    key:      'enterprise',
    label:    'Enterprise',
    price:    299900,
    icon:     Crown,
    color:    'purple',
    features: ['Empleados ilimitados', 'Verificaciones ilimitadas', 'Cuentas ilimitadas', 'Soporte dedicado'],
  },
];

const DURATIONS = [
  { months: 1,  label: '1 mes',    discount: 0,  badge: null },
  { months: 3,  label: '3 meses',  discount: 5,  badge: '5% off' },
  { months: 6,  label: '6 meses',  discount: 10, badge: '10% off' },
  { months: 12, label: '12 meses', discount: 15, badge: 'Mejor valor' },
];

const colorMap = {
  blue:    { ring: 'ring-blue-500',    bg: 'bg-blue-600',    light: 'bg-blue-50',    text: 'text-blue-700',    border: 'border-blue-200' },
  emerald: { ring: 'ring-emerald-500', bg: 'bg-emerald-600', light: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200' },
  purple:  { ring: 'ring-purple-500',  bg: 'bg-purple-600',  light: 'bg-purple-50',  text: 'text-purple-700',  border: 'border-purple-200' },
};

const fmtCOP  = (n) => `$${Math.round(n).toLocaleString('es-CO')}`;
const fmtDate = (d) => d ? new Date(d).toLocaleDateString('es-CO', { day: '2-digit', month: 'long', year: 'numeric' }) : null;

/* ─── PaymentWall ─────────────────────────────────────── */
export default function PaymentWall({ companyInfo = {}, onSignOut }) {
  const currentPlanKey = companyInfo.plan || 'starter';
  const [selectedPlan,   setSelectedPlan]   = useState(currentPlanKey);
  const [selectedMonths, setSelectedMonths] = useState(1);

  const isTrialExpired = companyInfo.subscription_status === 'trial_expired';
  const isSuspended    = companyInfo.subscription_status === 'suspended' || companyInfo.subscription_status === 'cancelled';

  const plan     = PLANS.find(p => p.key === selectedPlan) || PLANS[0];
  const duration = DURATIONS.find(d => d.months === selectedMonths) || DURATIONS[0];
  const base     = plan.price * selectedMonths;
  const total    = Math.round(base * (1 - duration.discount / 100));

  const mutation = useMutation({
    mutationFn: () => api('/api/subscription', {
      method: 'POST',
      body:   { plan: selectedPlan, months: selectedMonths },
    }),
    onSuccess: ({ url }) => {
      if (url) window.location.href = url;
    },
  });

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-brand-50 flex flex-col">
      {/* Top bar */}
      <header className="border-b border-slate-200 bg-white/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-brand-600 grid place-items-center">
              <ShieldCheck size={14} className="text-white" />
            </div>
            <span className="font-bold text-slate-800 text-sm">ChatPay</span>
          </div>
          {onSignOut && (
            <button onClick={onSignOut} className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-600 transition">
              <LogOut size={13} /> Cerrar sesión
            </button>
          )}
        </div>
      </header>

      <main className="flex-1 max-w-5xl mx-auto w-full px-4 py-10 space-y-8">

        {/* Alert */}
        <div className={`rounded-2xl border px-5 py-4 flex items-start gap-3 ${
          isSuspended
            ? 'bg-red-50 border-red-200 text-red-800'
            : 'bg-amber-50 border-amber-200 text-amber-800'
        }`}>
          {isSuspended ? <AlertTriangle size={18} className="shrink-0 mt-0.5" /> : <Clock size={18} className="shrink-0 mt-0.5" />}
          <div>
            <p className="font-semibold text-sm">
              {isSuspended ? 'Cuenta suspendida' : 'Período de prueba finalizado'}
            </p>
            <p className="text-sm mt-0.5 opacity-80">
              {isSuspended
                ? 'Tu cuenta ha sido suspendida. Activa tu suscripción para reanudar el servicio.'
                : `Tu trial${companyInfo.trial_ends_at ? ` venció el ${fmtDate(companyInfo.trial_ends_at)}` : ' ha finalizado'}. Elige un plan para continuar usando ChatPay.`
              }
            </p>
          </div>
        </div>

        {/* Título */}
        <div className="text-center">
          <h1 className="text-3xl font-bold text-slate-900">Activa tu plan</h1>
          <p className="text-slate-500 mt-1.5 text-sm">Sin contratos. Cancela cuando quieras.</p>
        </div>

        {/* Planes */}
        <div className="grid md:grid-cols-3 gap-4">
          {PLANS.map(p => {
            const clr    = colorMap[p.color];
            const active = selectedPlan === p.key;
            const Icon   = p.icon;
            return (
              <button
                key={p.key}
                onClick={() => setSelectedPlan(p.key)}
                className={`relative text-left rounded-2xl border-2 p-5 transition-all ${
                  active
                    ? `${clr.ring} ring-2 ring-offset-2 border-transparent shadow-lg`
                    : 'border-slate-200 hover:border-slate-300 bg-white'
                }`}
              >
                {p.popular && (
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-emerald-500 text-white text-xs font-bold px-3 py-0.5 rounded-full flex items-center gap-1">
                    <Sparkles size={10} /> Popular
                  </span>
                )}
                {active && (
                  <CheckCircle2 size={18} className={`absolute top-4 right-4 ${clr.text}`} />
                )}
                <div className={`w-10 h-10 rounded-xl grid place-items-center mb-3 ${active ? clr.bg : clr.light}`}>
                  <Icon size={18} className={active ? 'text-white' : clr.text} />
                </div>
                <div className="font-bold text-slate-900">{p.label}</div>
                <div className={`text-2xl font-extrabold mt-1 ${active ? clr.text : 'text-slate-800'}`}>
                  {fmtCOP(p.price)}
                  <span className="text-sm font-normal text-slate-400">/mes</span>
                </div>
                <ul className="mt-3 space-y-1.5">
                  {p.features.map(f => (
                    <li key={f} className="flex items-center gap-2 text-xs text-slate-500">
                      <CheckCircle2 size={12} className={clr.text} /> {f}
                    </li>
                  ))}
                </ul>
              </button>
            );
          })}
        </div>

        {/* Duración */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5">
          <p className="text-sm font-semibold text-slate-700 mb-3">¿Por cuánto tiempo?</p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {DURATIONS.map(d => {
              const active = selectedMonths === d.months;
              const price  = Math.round(plan.price * d.months * (1 - d.discount / 100));
              return (
                <button
                  key={d.months}
                  onClick={() => setSelectedMonths(d.months)}
                  className={`relative rounded-xl border-2 p-3 text-center transition-all ${
                    active
                      ? 'border-brand-500 bg-brand-50 ring-2 ring-brand-200'
                      : 'border-slate-200 hover:border-slate-300 bg-white'
                  }`}
                >
                  {d.badge && (
                    <span className={`absolute -top-2.5 left-1/2 -translate-x-1/2 text-xs font-bold px-2 py-0.5 rounded-full ${
                      d.months === 12 ? 'bg-brand-600 text-white' : 'bg-slate-700 text-white'
                    }`}>
                      {d.badge}
                    </span>
                  )}
                  <p className="font-semibold text-slate-800 text-sm">{d.label}</p>
                  <p className={`text-lg font-bold mt-0.5 ${active ? 'text-brand-600' : 'text-slate-700'}`}>
                    {fmtCOP(price)}
                  </p>
                  {d.discount > 0 && (
                    <p className="text-xs text-slate-400 line-through">{fmtCOP(plan.price * d.months)}</p>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Resumen + Botón */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5 flex flex-col md:flex-row items-center justify-between gap-4">
          <div>
            <p className="text-sm text-slate-500">Resumen del pago</p>
            <p className="font-bold text-slate-900 text-lg mt-0.5">
              Plan {plan.label} · {duration.label}
              {duration.discount > 0 && (
                <span className="ml-2 text-sm font-normal text-emerald-600">−{duration.discount}%</span>
              )}
            </p>
            <div className="flex items-baseline gap-1 mt-1">
              <span className="text-3xl font-extrabold text-brand-600">{fmtCOP(total)}</span>
              <span className="text-sm text-slate-400">COP</span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">Pago único · incluye IVA</p>
          </div>

          <button
            onClick={() => mutation.mutate()}
            disabled={mutation.isPending}
            className="btn btn-primary px-8 py-3 text-base font-bold rounded-xl flex items-center gap-2 min-w-[220px] justify-center shadow-lg shadow-brand-200"
          >
            {mutation.isPending ? (
              <><Loader2 size={18} className="animate-spin" /> Preparando pago…</>
            ) : (
              <><CreditCard size={18} /> Pagar con Bold <ExternalLink size={14} /></>
            )}
          </button>
        </div>

        {mutation.isError && (
          <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-red-700 text-sm flex items-center gap-2">
            <AlertTriangle size={15} />
            {mutation.error?.message || 'Error al crear el link de pago. Intenta de nuevo.'}
          </div>
        )}

        <p className="text-center text-xs text-slate-400">
          Pagos procesados de forma segura por <strong>Bold</strong> · Aceptamos tarjetas, PSE y Nequi.
          <br />¿Preguntas? Escríbenos a <a href="mailto:pagosviptourscol@gmail.com" className="underline">pagosviptourscol@gmail.com</a>
        </p>
      </main>
    </div>
  );
}

