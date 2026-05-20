/**
 * Servidor Express local — emula las Vercel Serverless Functions.
 * Corre en puerto 3001. Vite hace proxy /api → 3001 (ver vite.config.js).
 *
 * Uso:  node server.js
 */
import 'dotenv/config';
import express from 'express';
import cors from 'cors';

import webhookHandler from './api/webhook/whatsapp.js';
import kommoWebhookHandler from './api/webhook/kommo.js';
import verificationsHandler from './api/verifications/index.js';
import employeesHandler from './api/employees/index.js';
import statsHandler from './api/stats/index.js';
import ingresosHandler from './api/ingresos/index.js';
import egresosHandler from './api/egresos/index.js';
import settingsHandler from './api/settings/index.js';
import gmailSyncHandler from './api/gmail/sync.js';
import gmailPushHandler from './api/gmail/push.js';
import gmailWatchHandler from './api/gmail/watch.js';
import adminCompaniesHandler from './api/admin/companies.js';
import bankAccountsHandler from './api/bank-accounts/index.js';

const app = express();
app.use(cors());
app.use(express.json());

function adapt(handler) {
  return (req, res) => handler(req, res);
}

app.all('/api/webhook/whatsapp', adapt(webhookHandler));
app.all('/api/webhook/kommo', adapt(kommoWebhookHandler));
app.all('/api/verifications', adapt(verificationsHandler));
app.all('/api/employees', adapt(employeesHandler));
app.all('/api/stats', adapt(statsHandler));
app.all('/api/ingresos', adapt(ingresosHandler));
app.all('/api/egresos', adapt(egresosHandler));
app.all('/api/settings', adapt(settingsHandler));
app.all('/api/gmail/sync', adapt(gmailSyncHandler));
app.all('/api/gmail/push', adapt(gmailPushHandler));
app.all('/api/gmail/watch', adapt(gmailWatchHandler));
app.all('/api/admin/companies', adapt(adminCompaniesHandler));
app.all('/api/bank-accounts', adapt(bankAccountsHandler));

app.use((req, res) => res.status(404).json({ error: 'Not found' }));

const PORT = 3001;
app.listen(PORT, () => {
  console.log(`[server] API local corriendo en http://localhost:${PORT}`);
});
