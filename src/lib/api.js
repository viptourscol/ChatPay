import { supabase } from './supabase.js';

async function authHeader() {
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ? { Authorization: `Bearer ${data.session.access_token}` } : {};
}

/** Error especial lanzado cuando el servidor devuelve 402 (pago requerido / cuenta suspendida) */
export class PaymentRequiredError extends Error {
  constructor(data) {
    super('payment_required');
    this.name    = 'PaymentRequiredError';
    this.company = data?.company || null;
    this.trialExpired = data?.trialExpired || false;
  }
}

export async function api(path, { method = 'GET', body, query } = {}) {
  const url = new URL(path, window.location.origin);
  if (query) Object.entries(query).forEach(([k, v]) => v != null && v !== '' && url.searchParams.set(k, v));
  const headers = { 'Content-Type': 'application/json', ...(await authHeader()) };
  const res = await fetch(url.pathname + url.search, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined
  });
  if (res.status === 402) {
    const data = await res.json().catch(() => ({}));
    const err  = new PaymentRequiredError(data);
    // Emitir evento global para que Layout lo intercepte aunque venga desde cualquier componente
    window.dispatchEvent(new CustomEvent('chatpay:payment_required', { detail: data }));
    throw err;
  }
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(txt || `HTTP ${res.status}`);
  }
  return res.json();
}
