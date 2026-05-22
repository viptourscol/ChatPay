import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api.js';

// Planes que tienen acceso a cada feature
const FEATURE_PLANS = {
  egresos_gmail:   ['pro', 'empresarial', 'enterprise'],
  nomina:          ['pro', 'empresarial', 'enterprise'],
  admin_alerts:    ['estandar', 'business', 'pro', 'empresarial', 'enterprise'],
  kommo_crm:       ['empresarial', 'enterprise'],
  multi_sede:      ['empresarial', 'enterprise'],
  reportes_pdf:    ['pro', 'empresarial', 'enterprise'],
  reportes_excel:  ['estandar', 'business', 'pro', 'empresarial', 'enterprise'],
};

export function useSubscription() {
  const { data, isLoading } = useQuery({
    queryKey: ['subscription'],
    queryFn: () => api('/api/subscription'),
    staleTime: 5 * 60 * 1000,
  });

  const plan = data?.plan || 'free';

  function can(feature) {
    const allowed = FEATURE_PLANS[feature];
    if (!allowed) return true; // feature no gateada
    return allowed.includes(plan);
  }

  return { sub: data, plan, isLoading, can };
}
