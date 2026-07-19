# ChatPay — Verificación de pagos por WhatsApp

App web para que tus empleados verifiquen comprobantes de transferencias **Bancolombia**
enviando una foto a tu WhatsApp Business. El bot responde en segundos si el pago es
**real ✅**, **falso ❌** o **duplicado ⚠️**.

## Stack

- **Frontend:** React + Vite + Tailwind + TanStack Query
- **Backend:** Node.js Serverless Functions (Vercel) en `api/`
- **DB / Auth / Storage:** Supabase
- **OCR:** Groq Vision (`llama-4-scout`)
- **Email:** Gmail API (notificaciones reales de Bancolombia)
- **WhatsApp:** Meta Cloud API (número `+57 323 480 7835`, phone id `1163745080145238`)
- **Hosting:** Vercel

## Estructura

```
api/                    # Serverless functions
  webhook/whatsapp.js   # Recibe mensajes de WhatsApp (verifica + responde)
  verifications/        # CRUD de verificaciones (dashboard)
  employees/            # CRUD de empleados
  stats/                # Stats del dashboard
lib/                    # Servicios compartidos (supabase, groq, whatsapp, gmail, matcher, auth)
src/                    # Frontend React
supabase/migrations/    # Schema SQL
scripts/gmail-auth.js   # Helper para obtener refresh token de Gmail
```

## Flujo

```
Empleado WhatsApp ──img──▶ Meta ──▶ /api/webhook/whatsapp
                                    │
                                    ├─ Valida número en `employees`
                                    ├─ Descarga imagen + sube a Supabase Storage
                                    ├─ Groq Vision → {amount, reference, date, sender}
                                    ├─ Sync Gmail (últimos 90 min) → tabla `transactions`
                                    ├─ Match: referencia o (monto + fecha ±3h)
                                    └─ Responde por WhatsApp + guarda `verifications`
```

## Setup

### 1. Supabase

1. Crea un proyecto en https://supabase.com.
2. SQL editor → copia y ejecuta `supabase/migrations/0001_init.sql`.
3. Storage → crea bucket **`comprobantes`** (privado).
4. Authentication → Users → "Add user" con tu email/password (admin).
5. Copia `Project URL`, `anon key` y `service_role key` al `.env`.

### 2. Meta WhatsApp Cloud API

1. En tu app de Meta Developers, ve a WhatsApp → Configuration.
2. **Callback URL:** `https://TU-APP.vercel.app/api/webhook/whatsapp`
3. **Verify token:** el mismo string que pongas en `WHATSAPP_VERIFY_TOKEN`.
4. Suscríbete al campo `messages`.
5. Copia el access token permanente a `WHATSAPP_TOKEN`.

### 3. Groq

1. Crea una API key en https://console.groq.com.
2. Pégala en `GROQ_API_KEY`.
3. Si quieres fijar otro modelo de OCR, usa `GROQ_OCR_MODEL` y deja un modelo de visión válido, por ejemplo `qwen/qwen3.6-27b`.
4. Si quieres un fallback adicional, usa `GROQ_OCR_MODEL_FALLBACK` con otro modelo de visión al que tu proyecto sí tenga acceso.

### 4. Gmail API

1. Google Cloud Console → nuevo proyecto → habilita **Gmail API**.
2. APIs & Services → Credentials → "Create credentials" → OAuth client ID → tipo **Desktop app**.
3. Pon `GMAIL_CLIENT_ID` y `GMAIL_CLIENT_SECRET` en `.env`.
4. Ejecuta:
   ```
   node scripts/gmail-auth.js
   ```
   Abre el link, autoriza con la cuenta donde llegan los emails de Bancolombia,
   pega el código en consola, copia el `refresh_token` resultante a `GMAIL_REFRESH_TOKEN`.
5. `GMAIL_USER` = tu correo Gmail.

### 5. Local

```powershell
npm.cmd install
copy .env.example .env   # y completa los valores
npm.cmd run dev
```

> En Windows el frontend corre en http://localhost:5173 pero las funciones `api/` solo
> corren en Vercel. Para probar en local usa `vercel dev`:
> ```
> npm.cmd install -g vercel
> vercel dev
> ```

### 6. Deploy a Vercel

1. Push a GitHub.
2. Import en https://vercel.com.
3. Settings → Environment Variables → carga **todas** las variables de `.env.example`.
4. Deploy.
5. Actualiza el Callback URL en Meta con la URL final.

## Primeros pasos (después del deploy)

1. Entra al dashboard con tu admin user de Supabase.
2. Sección **Empleados** → agrega cada empleado autorizado con su número en formato `+573001234567`.
3. Pídele a un empleado que envíe un comprobante de prueba al WhatsApp.
4. Revisa la sección **Verificaciones**.

## Notas

- El parser de emails Bancolombia (`lib/gmail.js`) es heurístico. Si el formato del email
  no coincide, ajusta los regex en `parseBancolombiaEmail()`.
- El bucket Storage es privado: el dashboard usa URLs firmadas con expiración corta.
- RLS está activo: solo usuarios autenticados pueden leer; solo el `service_role`
  (backend) escribe.
"# ChatPay" 
