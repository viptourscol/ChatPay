import { supabaseAdmin } from './supabase.js';

export async function readSystemState(keys = []) {
  let query = supabaseAdmin.from('system_state').select('key,value,updated_at');
  if (Array.isArray(keys) && keys.length > 0) {
    query = query.in('key', keys);
  }

  const { data, error } = await query;
  if (error) throw error;

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

  if (error) throw error;
}
