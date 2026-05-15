import { supabase } from './supabase.js';

async function authHeader() {
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ? { Authorization: `Bearer ${data.session.access_token}` } : {};
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
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(txt || `HTTP ${res.status}`);
  }
  return res.json();
}
