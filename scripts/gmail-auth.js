/**
 * Script único para obtener el GMAIL_REFRESH_TOKEN.
 *
 *   node scripts/gmail-auth.js
 *
 * 1. Crea credenciales OAuth2 tipo "Desktop app" en Google Cloud Console.
 * 2. Habilita Gmail API en el proyecto.
 * 3. Pon GMAIL_CLIENT_ID y GMAIL_CLIENT_SECRET en .env.
 * 4. Corre este script, abre el link, autoriza, pega el código.
 * 5. Copia el refresh_token al .env como GMAIL_REFRESH_TOKEN.
 */
import 'dotenv/config';
import { google } from 'googleapis';
import readline from 'node:readline';

const SCOPES = ['https://www.googleapis.com/auth/gmail.readonly'];

const oauth2 = new google.auth.OAuth2(
  process.env.GMAIL_CLIENT_ID,
  process.env.GMAIL_CLIENT_SECRET,
  'urn:ietf:wg:oauth:2.0:oob'
);

const url = oauth2.generateAuthUrl({
  access_type: 'offline',
  prompt: 'consent',
  scope: SCOPES
});

console.log('\n1) Abre este link en tu navegador:\n');
console.log(url);
console.log('\n2) Autoriza y pega aquí el código:\n');

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
rl.question('Código: ', async (code) => {
  rl.close();
  const { tokens } = await oauth2.getToken(code.trim());
  console.log('\n✅ Tokens obtenidos:\n');
  console.log(tokens);
  console.log('\nCopia este valor a tu .env:\n');
  console.log(`GMAIL_REFRESH_TOKEN=${tokens.refresh_token}`);
});
