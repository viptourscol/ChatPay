/**
 * Script único para obtener el GMAIL_REFRESH_TOKEN.
 *
 *   node scripts/gmail-auth.js
 *
 * 1. En Google Cloud Console → Credenciales → edita el cliente OAuth
 *    y asegúrate de tener http://localhost:3456 en "URIs de redireccionamiento autorizados".
 * 2. Corre este script, abre el link que aparece, autoriza.
 * 3. Copia el refresh_token que se imprime.
 */
import 'dotenv/config';
import { google } from 'googleapis';
import http from 'node:http';
import { URL } from 'node:url';

const REDIRECT_URI = 'http://localhost:3456';
const SCOPES = [
  'https://www.googleapis.com/auth/gmail.readonly',
  'https://www.googleapis.com/auth/gmail.modify',
];

const oauth2 = new google.auth.OAuth2(
  process.env.GMAIL_CLIENT_ID,
  process.env.GMAIL_CLIENT_SECRET,
  REDIRECT_URI
);

const authUrl = oauth2.generateAuthUrl({
  access_type: 'offline',
  prompt: 'consent',
  scope: SCOPES
});

console.log('\n1) Abre este link en tu navegador:\n');
console.log(authUrl);
console.log('\nEsperando respuesta de Google...\n');

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, REDIRECT_URI);
  const code = url.searchParams.get('code');
  if (!code) { res.end('Sin código'); return; }

  res.end('<h2>✅ Autorizado. Ya puedes cerrar esta ventana.</h2>');
  server.close();

  try {
    const { tokens } = await oauth2.getToken(code);
    console.log('\n✅ Refresh token obtenido:\n');
    console.log(`GMAIL_REFRESH_TOKEN=${tokens.refresh_token}`);
    console.log('\nCopia esa línea a tu .env y actualiza Vercel.\n');
  } catch (e) {
    console.error('Error al obtener tokens:', e.message);
  }
});

server.listen(3456, () => {
  console.log('Servidor local escuchando en http://localhost:3456\n');
});
