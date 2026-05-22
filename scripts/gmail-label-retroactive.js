/**
 * Script retroactivo: etiqueta en Gmail todos los emails bancarios ya procesados
 * con la etiqueta "ChatPay/NombreEmpresa".
 *
 *   node scripts/gmail-label-retroactive.js
 *
 * Requiere en .env: GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET, GMAIL_REFRESH_TOKEN
 * y las variables de Supabase (SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY).
 */
import 'dotenv/config';
import { google } from 'googleapis';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

function getGmailClient() {
  const oauth2 = new google.auth.OAuth2(
    process.env.GMAIL_CLIENT_ID,
    process.env.GMAIL_CLIENT_SECRET,
    'urn:ietf:wg:oauth:2.0:oob'
  );
  oauth2.setCredentials({ refresh_token: process.env.GMAIL_REFRESH_TOKEN });
  return google.gmail({ version: 'v1', auth: oauth2 });
}

async function getOrCreateLabel(gmail, labelName, listCache) {
  if (listCache.has(labelName)) return listCache.get(labelName);

  const existing = [...listCache.values()]; // no útil, usamos el map directamente

  // Buscar en la lista real de etiquetas de Gmail
  const listRes = await gmail.users.labels.list({ userId: 'me' });
  for (const l of listRes.data.labels || []) {
    listCache.set(l.name, l.id);
  }

  if (listCache.has(labelName)) return listCache.get(labelName);

  // No existe: crearla
  const created = await gmail.users.labels.create({
    userId: 'me',
    requestBody: {
      name: labelName,
      labelListVisibility: 'labelShow',
      messageListVisibility: 'show',
    },
  });
  listCache.set(labelName, created.data.id);
  console.log(`  ✔ Etiqueta creada: "${labelName}"`);
  return created.data.id;
}

async function main() {
  const gmail = getGmailClient();
  const labelCache = new Map();

  // 1. Obtener todas las transacciones con gmail_message_id
  console.log('Cargando transacciones desde Supabase...');
  const { data: transactions, error } = await supabase
    .from('transactions')
    .select('gmail_message_id, company_id')
    .not('gmail_message_id', 'is', null);

  if (error) { console.error('Error Supabase:', error.message); process.exit(1); }
  console.log(`  ${transactions.length} transacciones encontradas\n`);

  // 2. Obtener nombres de empresas
  const companyIds = [...new Set(transactions.map(t => t.company_id).filter(Boolean))];
  const { data: companies } = await supabase
    .from('companies')
    .select('id, name')
    .in('id', companyIds);

  const nameMap = Object.fromEntries((companies || []).map(c => [c.id, c.name]));

  // 3. Aplicar etiquetas en lotes
  let labeled = 0;
  let skipped = 0;
  let errors = 0;

  for (const tx of transactions) {
    if (!tx.gmail_message_id || !tx.company_id) { skipped++; continue; }

    const companyName = nameMap[tx.company_id] || tx.company_id;
    const labelName = `ChatPay/${companyName}`;

    try {
      const labelId = await getOrCreateLabel(gmail, labelName, labelCache);

      await gmail.users.messages.modify({
        userId: 'me',
        id: tx.gmail_message_id,
        requestBody: { addLabelIds: [labelId] },
      });

      labeled++;
      process.stdout.write(`\r  Etiquetados: ${labeled} / ${transactions.length}`);
    } catch (err) {
      // El mensaje puede ya no existir en Gmail (borrado manualmente)
      if (err.code === 404) { skipped++; }
      else { errors++; console.error(`\n  Error en ${tx.gmail_message_id}:`, err.message); }
    }

    // Pequeña pausa para no exceder el rate limit de Gmail API (250 quota units/s)
    await new Promise(r => setTimeout(r, 50));
  }

  console.log(`\n\nListo.`);
  console.log(`  Etiquetados: ${labeled}`);
  console.log(`  Omitidos (sin datos o no encontrado en Gmail): ${skipped}`);
  console.log(`  Errores: ${errors}`);
}

main().catch(err => { console.error(err); process.exit(1); });
