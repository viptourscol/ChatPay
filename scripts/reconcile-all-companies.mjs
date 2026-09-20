#!/usr/bin/env node
/**
 * scripts/reconcile-all-companies.mjs
 * 
 * ⚡ FORMA MÁS FÁCIL: Usa el endpoint API con admin key
 * 
 * Requiere: Variable de entorno ADMIN_SECRET_KEY
 * 
 * PASOS:
 * 1. Obtén la admin key (desde Vercel o tu .env)
 * 2. Ejecuta: ADMIN_SECRET_KEY="..." node scripts/reconcile-all-companies.mjs
 * 
 * O con parámetro:
 *    node scripts/reconcile-all-companies.mjs "admin-key-aqui"
 */

async function main() {
  const adminKey = process.argv[2] || process.env.ADMIN_SECRET_KEY;
  
  if (!adminKey) {
    console.error('❌ Admin Key requerida\n');
    console.error('📝 OPCIÓN 1 - Pasar key como argumento:');
    console.error('   node scripts/reconcile-all-companies.mjs "your-admin-key"\n');
    console.error('📝 OPCIÓN 2 - Variable de entorno:');
    console.error('   ADMIN_SECRET_KEY="your-admin-key" node scripts/reconcile-all-companies.mjs\n');
    console.error('📝 CÓMO OBTENER LA ADMIN KEY:');
    console.error('   1. Ve a: https://vercel.com/dashboard/chatpay/settings/environment-variables');
    console.error('   2. Busca: ADMIN_SECRET_KEY');
    console.error('   3. Cópiala y úsala\n');
    process.exit(1);
  }

  const apiUrl = 'https://chat-pay-six.vercel.app/api/admin?action=reconcile-now';

  console.log('🚀 Iniciando reconciliación automática...\n');
  console.log('📡 Llamando:', apiUrl);
  console.log('');

  try {
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'X-Admin-Key': adminKey,
        'Content-Type': 'application/json'
      }
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('❌ Error en la API:');
      console.error('Status:', response.status);
      console.error('Response:', JSON.stringify(data, null, 2));
      process.exit(1);
    }

    // ✅ Éxito - Mostrar resultados
    console.log('════════════════════════════════════════════════════════════');
    console.log('✅ Reconciliación completada exitosamente!\n');
    
    console.log('📈 RESUMEN:');
    console.log(`   Empresas procesadas: ${data.summary.companiesProcessed}`);
    console.log(`   Total revisadas:     ${data.summary.totalChecked}`);
    console.log(`   Total actualizadas:  ${data.summary.totalUpdated}`);
    console.log(`   Total errores:       ${data.summary.totalErrors}`);
    
    if (data.summary.totalUpdated > 0) {
      const pct = Math.round((data.summary.totalUpdated / data.summary.totalChecked) * 100);
      console.log(`   Tasa de cambio:      ${pct}%`);
    }

    console.log('\n📋 DETALLE POR EMPRESA:');
    data.details.forEach((d, i) => {
      if (d.status === 'success') {
        console.log(`   ${i + 1}. ✅ ${d.companyName}`);
        console.log(`      → Revisadas: ${d.checked}, Actualizadas: ${d.updated}`);
      } else {
        console.log(`   ${i + 1}. ❌ ${d.companyName}`);
        console.log(`      → Error: ${d.error}`);
      }
    });

    console.log('\n════════════════════════════════════════════════════════════');
    console.log('\n' + data.message + '\n');
    process.exit(0);
  } catch (err) {
    console.error('❌ Error de conexión:', err.message);
    console.error('\n💡 Verifica que:');
    console.error('   • La admin key sea correcta');
    console.error('   • La URL sea accesible: https://chat-pay-six.vercel.app/');
    console.error('   • Tengas conectado a internet\n');
    process.exit(1);
  }
}

main();
}
