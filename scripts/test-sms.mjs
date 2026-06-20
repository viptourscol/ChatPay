/**
 * Script de prueba para el endpoint de SMS backup
 * Uso: node scripts/test-sms.mjs
 */

const TOKEN = 'e5acb618-e0c6-4f3f-957f-f589996303e4';
const BASE  = 'https://chat-pay-six.vercel.app';

async function testSms(label, body) {
  console.log(`\n🧪 ${label}`);
  console.log('   Body:', JSON.stringify(body).slice(0, 80) + '...');
  try {
    const res = await fetch(`${BASE}/api/webhook?provider=sms`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${TOKEN}`,
      },
      body: JSON.stringify(body),
    });
    const contentType = res.headers.get('content-type') || '';
    let data;
    if (contentType.includes('json')) {
      data = await res.json();
    } else {
      const text = await res.text();
      data = text.slice(0, 200);
    }
    console.log(`   Status: ${res.status}`);
    console.log(`   Response:`, JSON.stringify(data, null, 2));
    return { status: res.status, data };
  } catch (err) {
    console.error(`   ❌ Error de red:`, err.message);
    return null;
  }
}

async function main() {
  console.log('='.repeat(60));
  console.log(' CHATPAY - Test SMS Backup');
  console.log(' Empresa: HOTEL AERO SANTA FE');
  console.log(' Token:', TOKEN);
  console.log('='.repeat(60));

  // ── Prueba 1: SMS válido de Bancolombia (formato Llaves) ──
  await testSms('SMS bancario válido — debe crear transacción', {
    text: 'Bancolombia: HOTEL AERO SANTA FE, recibiste un pago de JUAN PEREZ por $250.000 en tu cuenta *1234 el 19/06/2026 a las 14:30. Ref 98765432',
    source: 'android',
    received_at: new Date().toISOString(),
  });

  // ── Prueba 2: SMS formato clásico ──
  await testSms('SMS bancario clásico — "Recibió $X de NOMBRE"', {
    text: 'Bancolombia le informa: Recibio $150.000 de MARIA GARCIA. Ref 11223344. Saldo $800.000',
    source: 'android',
    received_at: new Date().toISOString(),
  });

  // ── Prueba 3: SMS no bancario — debe guardarse como "ignored" ──
  await testSms('SMS no bancario — debe guardarse como ignored', {
    text: 'Tu codigo de verificacion es 123456. No lo compartas.',
    source: 'android',
  });

  // ── Prueba 4: Token inválido — debe dar 401 ──
  console.log('\n🧪 Token inválido — debe dar 401');
  try {
    const res = await fetch(`${BASE}/api/webhook?provider=sms`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer token-invalido-123',
      },
      body: JSON.stringify({ text: 'test', source: 'android' }),
    });
    const data = await res.json();
    console.log(`   Status: ${res.status}`);
    console.log(`   Response:`, data);
  } catch (err) {
    console.error('   ❌ Error de red:', err.message);
  }

  console.log('\n' + '='.repeat(60));
  console.log(' ✅ Tests completados. Verifica en Supabase:');
  console.log(' SQL: SELECT * FROM transaction_sms ORDER BY received_at DESC LIMIT 5;');
  console.log('='.repeat(60) + '\n');
}

main();
