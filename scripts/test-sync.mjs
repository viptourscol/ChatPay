import 'dotenv/config';
import { syncBancolombiaEmails } from '../lib/gmail.js';

// Parchar el upsert para ver errores
import { supabaseAdmin } from '../lib/supabase.js';
const origFrom = supabaseAdmin.from.bind(supabaseAdmin);
supabaseAdmin.from = (table) => {
  const builder = origFrom(table);
  const origUpsert = builder.upsert?.bind(builder);
  if (origUpsert) {
    builder.upsert = (...args) => {
      return origUpsert(...args).then(res => {
        if (res.error) console.error('[upsert error]', res.error);
        return res;
      });
    };
  }
  return builder;
};

console.log('Corriendo sync de los últimos 120 minutos...');
const r = await syncBancolombiaEmails({ minutes: 120 });
console.log('Resultado:', JSON.stringify(r, null, 2));
