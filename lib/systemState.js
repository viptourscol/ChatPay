import { supabaseAdmin } from './supabase.js';

function isSystemStateMissingError(error) {
  const msg = String(error?.message || '').toLowerCase();
  return msg.includes("could not find the table 'public.system_state'") ||
    msg.includes("relation \"public.system_state\" does not exist") ||
    msg.includes("relation \"system_state\" does not exist");
}

function wrapSystemStateError(error) {
  if (isSystemStateMissingError(error)) {
    return new Error('Falta la tabla public.system_state. Ejecuta la migracion supabase/migrations/0004_system_state.sql en Supabase SQL Editor.');
  }
  return error;
}

export async function readSystemState(keys = []) {
  let query = supabaseAdmin.from('system_state').select('key,value,updated_at');
  if (Array.isArray(keys) && keys.length > 0) {
    query = query.in('key', keys);
  }

  const { data, error } = await query;
  if (error) throw wrapSystemStateError(error);

  return (data || []).reduce((acc, row) => {
    acc[row.key] = row.value;
    return acc;
  }, {});
}

export async function writeSystemState(values) {
  const entries = Object.entries(values || {}).filter(([key]) => typeof key === 'string' && key.length > 0);
  if (entries.length === 0) return;

  const payload = entries.map(([key, value]) => ({ key, value: String(value) }));
  const { error } = await supabaseAdmin
    .from('system_state')
    .upsert(payload, { onConflict: 'key' });

  if (error) throw wrapSystemStateError(error);
}
