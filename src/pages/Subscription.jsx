import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api.js';
import { CheckCircle2, XCircle, Clock, Zap, Crown, Building2, AlertTriangle } from 'lucide-react';

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
  const { data: sub, isLoading, error } = useQuery({
    queryKey: ['subscription'],
    queryFn: () => api('/api/subscription')
  });

  if (isLoading) return <div className="text-slate-400 py-12 text-center">Cargando…</div>;
  if (error) return <div className="text-red-600 py-8 text-center">{error.message}</div>;

  const plan = PLANS[sub?.plan] || PLANS.starter;
  const PlanIcon = plan.icon;
  const status = STATUS_LABELS[sub?.subscription_status] || STATUS_LABELS.trial;
  const StatusIcon = status.icon;

  const trialEndsAt = sub?.trial_ends_at ? new Date(sub.trial_ends_at) : null;
  const daysLeft = trialEndsAt ? Math.max(0, Math.ceil((trialEndsAt - new Date()) / 86400000)) : null;
  const isTrial = sub?.subscription_status === 'trial';
  const isExpired = isTrial && daysLeft !== null && daysLeft <= 0;

  return (
    <div className="max-w-4xl mx-auto">
      <header className="mb-8 animate-fade-up">
        <h1 className="font-serif text-3xl">Mi Suscripción</h1>
        <p className="text-slate-500 text-sm mt-1">Gestiona tu plan y revisa el uso del mes.</p>
      </header>

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

        {/* Estado */}
        <div className="card animate-fade-up delay-100">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Estado</p>
          <div className={`flex items-center gap-2 text-${status.color}-600`}>
            <StatusIcon size={18} />
            <span className="text-xl font-bold">{status.label}</span>
          </div>
          {isTrial && daysLeft !== null && !isExpired && (
            <p className="text-slate-500 text-sm mt-1">{daysLeft} días restantes</p>
          )}
          {isTrial && trialEndsAt && !isExpired && (
            <p className="text-slate-400 text-xs mt-0.5">Vence: {trialEndsAt.toLocaleDateString('es-CO')}</p>
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

      {/* Comparativa de planes */}
      <div className="animate-fade-up delay-300">
        <h2 className="font-semibold text-slate-800 mb-4">Planes disponibles</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {Object.entries(PLANS).map(([key, p]) => {
            const Icon = p.icon;
            const isCurrent = key === sub?.plan;
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
                <p className="text-2xl font-bold text-slate-900 mb-4">
                  {fmt(p.price)}<span className="text-sm font-normal text-slate-400">/mes</span>
                </p>
                <ul className="space-y-2">
                  {p.features.map(f => (
                    <li key={f} className="flex items-center gap-2 text-sm text-slate-600">
                      <CheckCircle2 size={13} className={`text-${p.color}-500 shrink-0`} />
                      {f}
                    </li>
                  ))}
                </ul>
                {!isCurrent && (
                  <a
                    href="mailto:pagosviptourscol@gmail.com?subject=Cambio de plan ChatPay"
                    className={`btn mt-5 w-full text-center text-sm bg-${p.color}-600 hover:bg-${p.color}-700 text-white`}
                  >
                    Actualizar a {p.label}
                  </a>
                )}
              </div>
            );
          })}
        </div>

        <p className="text-center text-slate-400 text-xs mt-6">
          Para cambiar tu plan o activar tu suscripción escríbenos a{' '}
          <a href="mailto:pagosviptourscol@gmail.com" className="text-brand-600 underline">pagosviptourscol@gmail.com</a>
        </p>
      </div>
    </div>
  );
}
