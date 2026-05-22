import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api.js';
import { CheckCircle2, XCircle, Clock, Zap, Crown, Building2, AlertTriangle, ExternalLink, Loader2, PartyPopper, RefreshCw, Calendar, CreditCard } from 'lucide-react';

const PLANS = {
  starter: {
    label: 'Starter',
    price: 49900,
    color: 'blue',
    icon: Zap,
    features: ['1 empleado activo', '200 verificaciones / mes', '1 cuenta bancaria', 'Soporte por email']
  },
  business: {
    label: 'Business',
    price: 129900,
    color: 'emerald',
    icon: Building2,
    features: ['20 empleados activos', '1.000 verificaciones / mes', '3 cuentas bancarias', 'Soporte por WhatsApp']
  },
  enterprise: {
    label: 'Enterprise',
    price: 299900,
    color: 'purple',
    icon: Crown,
    features: ['Empleados ilimitados', 'Verificaciones ilimitadas', 'Cuentas bancarias ilimitadas', 'Soporte dedicado']
  }
};

const STATUS_LABELS = {
  trial:     { label: 'Período de prueba',   color: 'amber',   icon: Clock },
  active:    { label: 'Activa',              color: 'emerald', icon: CheckCircle2 },
  suspended: { label: 'Suspendida',          color: 'red',     icon: XCircle },
  cancelled: { label: 'Cancelada',           color: 'slate',   icon: XCircle }
};

function fmt(n) { return `$${Number(n).toLocaleString('es-CO')}`; }

function UsageBar({ used, max, label }) {
  const pct = max >= 999999 ? 0 : Math.min((used / max) * 100, 100);
  const color = pct >= 90 ? 'bg-red-500' : pct >= 70 ? 'bg-amber-500' : 'bg-emerald-500';
  return (
    <div>
      <div className="flex justify-between text-xs text-slate-500 mb-1">
        <span>{label}</span>
        <span className="font-medium text-slate-700">
          {used} / {max >= 999999 ? '∞' : max}
        </span>
      </div>
      <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
        {max < 999999 && <div className={`h-full ${color} rounded-full transition-all duration-700`} style={{ width: `${pct}%` }} />}
        {max >= 999999 && <div className="h-full bg-emerald-400 rounded-full w-full opacity-30" />}
      </div>
    </div>
  );
}

export default function Subscription() {
  const qc = useQueryClient();
  const { data: sub, isLoading, error } = useQuery({
    queryKey: ['subscription'],
    queryFn: () => api('/api/subscription')
  });
  const [months, setMonths] = useState(1);
  const [verifyDone, setVerifyDone] = useState(false);

  // Detectar retorno desde Wompi
  const params = new URLSearchParams(window.location.search);
  const paymentParam  = params.get('payment');
  const returnedPlan  = params.get('plan');
  const transactionId = params.get('id'); // Wompi incluye ?id=TX_ID en el redirect
  const isPending = paymentParam === 'pending';

  // Al volver desde Wompi, verificar el pago directamente con la API
  const verifyMutation = useMutation({
    mutationFn: (txId) => api('/api/subscription', {
      method: 'POST',
      body: { action: 'verify', transactionId: txId, plan: returnedPlan, months: params.get('months') },
    }),
    onSuccess: () => {
      setVerifyDone(true);
      qc.invalidateQueries({ queryKey: ['subscription'] });
    },
    onError: () => {
      // Si falla la verificación directa, hacer polling (webhook puede llegar)
      setVerifyDone(false);
    },
  });

  useEffect(() => {
    if (!isPending || verifyDone || verifyMutation.isPending) return;
    if (transactionId) {
      // Wompi dio el ID → verificar directamente
      verifyMutation.mutate(transactionId);
    } else {
      // Sin ID → polling hasta que el webhook active la suscripción
      const interval = setInterval(() => {
        qc.invalidateQueries({ queryKey: ['subscription'] });
      }, 4000);
      return () => clearInterval(interval);
    }
  }, [isPending, transactionId, verifyDone]);

  // El plan en DB ya coincide con lo que se pagó
  const planActivated = isPending && sub?.plan === returnedPlan && sub?.subscription_status === 'active';

  const payMutation = useMutation({
    mutationFn: ({ plan, months }) => api('/api/subscription', { method: 'POST', body: { plan, months } }),
    onSuccess: (data) => { if (data?.url) window.location.href = data.url; },
  });

  if (isLoading) return <div className="text-slate-400 py-12 text-center">Cargando…</div>;
  if (error) return <div className="text-red-600 py-8 text-center">{error.message}</div>;

  const plan = PLANS[sub?.plan] || PLANS.starter;
  const PlanIcon = plan.icon;
  const status = STATUS_LABELS[sub?.subscription_status] || STATUS_LABELS.trial;
  const StatusIcon = status.icon;

  const trialEndsAt   = sub?.trial_ends_at       ? new Date(sub.trial_ends_at)       : null;
  const subExpiresAt  = sub?.subscription_expires_at ? new Date(sub.subscription_expires_at) : null;
  const daysLeft      = trialEndsAt ? Math.max(0, Math.ceil((trialEndsAt - new Date()) / 86400000)) : null;
  const subDaysLeft   = subExpiresAt ? Math.max(0, Math.ceil((subExpiresAt - new Date()) / 86400000)) : null;
  const isTrial = sub?.subscription_status === 'trial';
  const isExpired = isTrial && daysLeft !== null && daysLeft <= 0;

  return (
    <div className="max-w-4xl mx-auto">
      <header className="mb-8 animate-fade-up">
        <h1 className="font-serif text-3xl">Mi Suscripción</h1>
        <p className="text-slate-500 text-sm mt-1">Gestiona tu plan y revisa el uso del mes.</p>
      </header>

      {/* Banner retorno de pago */}
      {planActivated && (
        <div className="mb-6 bg-emerald-50 border border-emerald-200 rounded-xl p-4 flex items-start gap-3 animate-fade-up">
          <PartyPopper size={20} className="text-emerald-500 shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-emerald-700">¡Pago exitoso! Tu suscripción está activa</p>
            <p className="text-sm text-emerald-600 mt-0.5">Plan <strong>{PLANS[returnedPlan]?.label || returnedPlan}</strong> activado correctamente. Ya puedes usar todas las funciones.</p>
          </div>
        </div>
      )}
      {isPending && !planActivated && (
        <div className="mb-6 bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-center gap-3 animate-fade-up">
          <RefreshCw size={18} className="text-amber-500 shrink-0 animate-spin" />
          <div>
            <p className="font-semibold text-amber-700">Verificando tu pago…</p>
            <p className="text-sm text-amber-600 mt-0.5">
              {verifyMutation.isError
                ? 'No pudimos confirmar el pago automáticamente. Si completaste el pago, el plan se activará en unos minutos.'
                : 'Esto toma unos segundos. No cierres esta página.'}
            </p>
          </div>
        </div>
      )}

      {/* Banner de alerta */}
      {isExpired && (
        <div className="mb-6 bg-red-50 border border-red-200 rounded-xl p-4 flex items-start gap-3 animate-fade-up">
          <AlertTriangle size={20} className="text-red-500 shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-red-700">Tu período de prueba ha vencido</p>
            <p className="text-sm text-red-600 mt-0.5">Las verificaciones están suspendidas. Contacta a <strong>pagosviptourscol@gmail.com</strong> o escríbenos por WhatsApp para activar tu plan.</p>
          </div>
        </div>
      )}
      {isTrial && !isExpired && daysLeft !== null && daysLeft <= 5 && (
        <div className="mb-6 bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3 animate-fade-up">
          <Clock size={20} className="text-amber-500 shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-amber-700">Tu prueba vence en {daysLeft} día{daysLeft !== 1 ? 's' : ''}</p>
            <p className="text-sm text-amber-600 mt-0.5">Activa tu suscripción antes de que expire para no perder el acceso.</p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        {/* Plan actual */}
        <div className="card animate-fade-up delay-0">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Plan actual</p>
          <div className="flex items-center gap-2 mb-1">
            <PlanIcon size={18} className={`text-${plan.color}-600`} />
            <span className="text-2xl font-bold text-slate-800">{plan.label}</span>
          </div>
          <p className="text-slate-500 text-sm">{fmt(plan.price)}<span className="text-xs">/mes</span></p>
        </div>
        <div className="card animate-fade-up delay-100 col-span-1 md:col-span-2">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Estado de suscripción</p>

          {/* Trial activo */}
          {isTrial && !isExpired && trialEndsAt && (() => {
            const total = 14; // días de trial
            const used  = total - (daysLeft ?? 0);
            const pct   = Math.min(100, Math.round((used / total) * 100));
            const barColor = daysLeft <= 3 ? 'bg-red-400' : daysLeft <= 7 ? 'bg-amber-400' : 'bg-emerald-400';
            return (
              <div>
                <div className="flex items-center justify-between mb-1">
                  <div className={`flex items-center gap-1.5 text-amber-600`}><Clock size={15}/><span className="font-semibold text-sm">Período de prueba</span></div>
                  <span className={`text-sm font-bold ${daysLeft <= 3 ? 'text-red-600' : 'text-amber-600'}`}>{daysLeft} días restantes</span>
                </div>
                <div className="h-2.5 bg-slate-100 rounded-full overflow-hidden mb-1">
                  <div className={`h-full ${barColor} rounded-full transition-all duration-700`} style={{ width: `${pct}%` }} />
                </div>
                <p className="text-xs text-slate-400">Vence el {trialEndsAt.toLocaleDateString('es-CO', { day: '2-digit', month: 'long', year: 'numeric' })}</p>
              </div>
            );
          })()}

          {/* Trial vencido */}
          {isTrial && isExpired && (
            <div className="flex items-center gap-2 text-red-600">
              <XCircle size={16}/>
              <span className="font-semibold text-sm">Período de prueba vencido</span>
            </div>
          )}

          {/* Suscripción activa con fecha */}
          {!isTrial && subExpiresAt && (() => {
            const totalDays = 30; // referencia visual (1 mes)
            const pct       = Math.min(100, Math.round((subDaysLeft / totalDays) * 100));
            const barColor  = subDaysLeft <= 5 ? 'bg-red-400' : subDaysLeft <= 15 ? 'bg-amber-400' : 'bg-emerald-400';
            const textColor = subDaysLeft <= 5 ? 'text-red-600' : subDaysLeft <= 15 ? 'text-amber-600' : 'text-emerald-600';
            return (
              <div>
                <div className="flex items-center justify-between mb-1">
                  <div className={`flex items-center gap-1.5 ${textColor}`}><CheckCircle2 size={15}/><span className="font-semibold text-sm">Activa</span></div>
                  <span className={`text-sm font-bold ${textColor}`}>{subDaysLeft} días restantes</span>
                </div>
                <div className="h-2.5 bg-slate-100 rounded-full overflow-hidden mb-1">
                  <div className={`h-full ${barColor} rounded-full transition-all duration-700`} style={{ width: `${Math.max(2, pct)}%` }} />
                </div>
                <p className="text-xs text-slate-400">Vence el {subExpiresAt.toLocaleDateString('es-CO', { day: '2-digit', month: 'long', year: 'numeric' })}</p>
              </div>
            );
          })()}

          {/* Activa sin fecha */}
          {!isTrial && !subExpiresAt && (
            <div>
              <div className="flex items-center gap-1.5 text-emerald-600 mb-2">
                <CheckCircle2 size={15}/><span className="font-semibold text-sm">Activa</span>
              </div>
              <div className="h-2.5 bg-emerald-100 rounded-full overflow-hidden mb-1">
                <div className="h-full bg-emerald-400 rounded-full w-full opacity-40" />
              </div>
              <p className="text-xs text-slate-400">Fecha de vencimiento no registrada. Contacta soporte.</p>
            </div>
          )}
        </div>

        {/* Verificaciones del mes */}
        <div className="card animate-fade-up delay-200">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Este mes</p>
          <span className="text-2xl font-bold text-slate-800">{sub?.verifications_used ?? 0}</span>
          <span className="text-slate-400 text-sm ml-1">
            / {sub?.max_verifications_month >= 999999 ? '∞' : sub?.max_verifications_month} verif.
          </span>
        </div>
      </div>

      {/* Uso detallado */}
      <div className="card mb-8 animate-fade-up delay-200">
        <h2 className="font-semibold text-slate-800 mb-4">Uso del mes</h2>
        <div className="space-y-4">
          <UsageBar used={sub?.verifications_used ?? 0} max={sub?.max_verifications_month ?? 200} label="Verificaciones" />
          <UsageBar used={sub?.employees_count ?? 0} max={sub?.max_employees ?? 1} label="Empleados activos" />
          <UsageBar used={sub?.bank_accounts_count ?? 0} max={sub?.max_bank_accounts ?? 1} label="Cuentas bancarias" />
        </div>
      </div>

      {/* Historial de pagos */}
      {sub?.payments?.length > 0 && (
        <div className="card mb-8 animate-fade-up delay-250">
          <div className="flex items-center gap-2 mb-4">
            <CreditCard size={18} className="text-slate-500" />
            <h2 className="font-semibold text-slate-800">Historial de pagos</h2>
          </div>
          <div className="divide-y divide-slate-100">
            {sub.payments.map((p) => {
              const planInfo = PLANS[p.plan] || { label: p.plan, color: 'slate' };
              const fecha    = new Date(p.created_at).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' });
              const meses    = p.months === 1 ? '1 mes' : `${p.months} meses`;
              return (
                <div key={p.id} className="flex items-center justify-between py-3 gap-3">
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-full bg-${planInfo.color}-100 flex items-center justify-center shrink-0`}>
                      <Calendar size={14} className={`text-${planInfo.color}-600`} />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-slate-700">Plan {planInfo.label} · {meses}</p>
                      <p className="text-xs text-slate-400">{fecha}</p>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-semibold text-slate-800">{fmt(p.amount_cop)}</p>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${
                      p.status === 'approved' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
                    }`}>{p.status === 'approved' ? 'Aprobado' : p.status}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Comparativa de planes */}
      <div className="animate-fade-up delay-300">
        <div className="flex items-center justify-between flex-wrap gap-3 mb-5">
          <h2 className="font-semibold text-slate-800">Planes disponibles</h2>

          {/* Selector de duración */}
          <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-xl">
            {[
              { m: 1,  label: '1 mes' },
              { m: 3,  label: '3 meses', badge: '-5%' },
              { m: 6,  label: '6 meses', badge: '-10%' },
              { m: 12, label: '1 año',   badge: '-15%' },
            ].map(({ m, label, badge }) => (
              <button
                key={m}
                onClick={() => setMonths(m)}
                className={`flex items-center gap-1 px-3 py-1.5 text-sm font-medium rounded-lg transition-all duration-150 ${
                  months === m ? 'bg-white shadow-sm text-brand-700' : 'text-slate-500 hover:text-slate-800 hover:bg-white/60'
                }`}
              >
                {label}
                {badge && <span className={`text-[10px] font-bold px-1 rounded ${months === m ? 'text-emerald-600 bg-emerald-50' : 'text-emerald-500'}`}>{badge}</span>}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {Object.entries(PLANS).map(([key, p]) => {
            const Icon = p.icon;
            const isCurrent = key === sub?.plan;
            const discount = { 1: 0, 3: 5, 6: 10, 12: 15 }[months] ?? 0;
            const total = Math.round(p.price * months * (1 - discount / 100));
            const isPaying = payMutation.isPending && payMutation.variables?.plan === key;
            return (
              <div key={key} className={`card border-2 transition-all ${isCurrent ? `border-${p.color}-400 bg-${p.color}-50/30` : 'border-transparent'}`}>
                {isCurrent && (
                  <span className={`inline-block text-xs font-bold text-${p.color}-700 bg-${p.color}-100 px-2 py-0.5 rounded-full mb-3`}>
                    Plan actual
                  </span>
                )}
                <div className="flex items-center gap-2 mb-1">
                  <Icon size={16} className={`text-${p.color}-600`} />
                  <span className="font-bold text-slate-800">{p.label}</span>
                </div>
                <div className="mb-1">
                  <span className="text-2xl font-bold text-slate-900">{fmt(total)}</span>
                  {months > 1
                    ? <span className="text-sm font-normal text-slate-400"> / {months} meses</span>
                    : <span className="text-sm font-normal text-slate-400">/mes</span>
                  }
                </div>
                {discount > 0 && (
                  <p className="text-xs text-emerald-600 font-medium mb-3">
                    Ahorra {fmt(p.price * months - total)} ({discount}% descuento)
                  </p>
                )}
                <ul className="space-y-2 mb-5">
                  {p.features.map(f => (
                    <li key={f} className="flex items-center gap-2 text-sm text-slate-600">
                      <CheckCircle2 size={13} className={`text-${p.color}-500 shrink-0`} />
                      {f}
                    </li>
                  ))}
                </ul>
                <button
                  disabled={isPaying}
                  onClick={() => payMutation.mutate({ plan: key, months })}
                  className={`w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold transition ${
                    isCurrent
                      ? `bg-${p.color}-100 text-${p.color}-700 hover:bg-${p.color}-200`
                      : `bg-${p.color}-600 hover:bg-${p.color}-700 text-white`
                  } disabled:opacity-60`}
                >
                  {isPaying
                    ? <><Loader2 size={15} className="animate-spin" /> Procesando…</>
                    : <><ExternalLink size={14} /> {isCurrent ? 'Renovar' : `Suscribirme`}</>
                  }
                </button>
                {payMutation.isError && payMutation.variables?.plan === key && (
                  <p className="text-xs text-red-600 mt-2 text-center">{payMutation.error?.message}</p>
                )}
              </div>
            );
          })}
        </div>

        {/* Badge Wompi */}
        <div className="flex items-center justify-center gap-2 mt-6 text-slate-400 text-xs">
          <svg width="18" height="18" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" className="opacity-60">
            <rect width="32" height="32" rx="8" fill="#7B3FE4"/>
            <text x="6" y="22" fontSize="14" fontWeight="bold" fill="white">W</text>
          </svg>
          Pagos procesados de forma segura por <span className="font-semibold text-slate-500">Wompi</span>
          · Tarjeta, PSE, Nequi y Bancolombia
        </div>
      </div>
    </div>
  );
}
