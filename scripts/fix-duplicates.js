import { supabaseAdmin } from '../lib/supabase.js';

const { data: confirmed } = await supabaseAdmin
  .from('transactions')
  .select('id,amount,transaction_date')
  .eq('status', 'confirmed');

let deleted = 0;
for (const c of (confirmed || [])) {
  const lo = new Date(new Date(c.transaction_date).getTime() - 2 * 60 * 1000).toISOString();
  const hi = new Date(new Date(c.transaction_date).getTime() + 2 * 60 * 1000).toISOString();
  const { data: dups } = await supabaseAdmin
    .from('transactions')
    .select('id')
    .eq('amount', c.amount)
    .eq('status', 'pending')
    .gte('transaction_date', lo)
    .lte('transaction_date', hi);
  for (const d of (dups || [])) {
    await supabaseAdmin.from('transactions').delete().eq('id', d.id);
    deleted++;
    console.log('Eliminado pending duplicado:', d.id);
  }
}
console.log('Total duplicados eliminados:', deleted);
