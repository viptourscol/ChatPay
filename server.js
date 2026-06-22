/**
 * Servidor Express local â€” emula las Vercel Serverless Functions.
 * Corre en puerto 3001. Vite hace proxy /api â†’ 3001 (ver vite.config.js).
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
import gmailHandler from './api/gmail.js';
import adminCompaniesHandler, { userInfoHandler as adminUserInfoHandler } from './api/admin/companies.js';
import bankAccountsHandler from './api/bank-accounts/index.js';
import subscriptionHandler from './api/subscription/index.js';
import nominaReportHandler from './api/reports/index.js';

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
app.all('/api/gmail', adapt(gmailHandler));
app.all('/api/admin/companies', adapt(adminCompaniesHandler));
app.all('/api/admin/user-info', (req, res) => adminUserInfoHandler(req, res, null));
app.all('/api/bank-accounts', adapt(bankAccountsHandler));
app.all('/api/subscription', adapt(subscriptionHandler));
app.all('/api/reports/nomina', adapt(nominaReportHandler));

app.use((req, res) => res.status(404).json({ error: 'Not found' }));

const PORT = 3001;
app.listen(PORT, () => {
  console.log(`[server] API local corriendo en http://localhost:${PORT}`);
});

