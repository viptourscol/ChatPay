import { Link } from 'react-router-dom';
import { Lock } from 'lucide-react';

const PLAN_LABELS = {
  pro:         'Pro',
  empresarial: 'Empresarial',
  estandar:    'Estándar',
};

/**
 * Envuelve contenido y muestra un banner de upgrade si `allowed` es false.
 *
 * Props:
 *  - allowed: boolean — si true, renderiza children normalmente
 *  - requiredPlan: 'estandar' | 'pro' | 'empresarial'
 *  - feature: string — nombre legible de la feature ("Egresos Gmail")
 *  - compact: boolean — banner pequeño inline en lugar del overlay completo
 */
export default function FeatureGate({ allowed, requiredPlan = 'pro', feature = 'esta función', compact = false, children }) {
  if (allowed) return children;

  const planLabel = PLAN_LABELS[requiredPlan] || requiredPlan;

  if (compact) {
    return (
      <div className="flex items-center gap-3 bg-slate-50 border border-slate-200 rounded-xl px-4 py-3">
        <Lock size={15} className="text-slate-400 shrink-0" />
        <p className="text-sm text-slate-500 flex-1">
          <span className="font-medium text-slate-700">{feature}</span> requiere el plan{' '}
          <span className="font-semibold text-brand-700">{planLabel}</span> o superior.
        </p>
        <Link to="/suscripcion" className="text-xs font-semibold text-brand-700 hover:underline whitespace-nowrap">
          Actualizar →
        </Link>
      </div>
    );
  }

  return (
    <div className="relative">
      {/* Contenido borroso detrás */}
      <div className="pointer-events-none select-none opacity-30 blur-sm">{children}</div>

      {/* Overlay */}
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="bg-white border border-slate-200 rounded-2xl shadow-lg px-8 py-6 text-center max-w-xs mx-4">
          <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-3">
            <Lock size={20} className="text-slate-500" />
          </div>
          <p className="font-bold text-slate-800 mb-1">{feature}</p>
          <p className="text-sm text-slate-500 mb-4">
            Disponible en el plan <span className="font-semibold text-brand-700">{planLabel}</span> o superior.
          </p>
          <Link
            to="/suscripcion"
            className="inline-flex items-center gap-1 bg-brand-700 hover:bg-brand-800 text-white text-sm font-semibold rounded-full px-5 py-2 transition"
          >
            Actualizar plan
          </Link>
        </div>
      </div>
    </div>
  );
}
