import { Link } from 'react-router-dom';

const NAV_LINKS = [
  { href: '#problema', label: 'El Problema' },
  { href: '#solucion', label: 'La Solución' },
  { href: '#como-funciona', label: 'Cómo Funciona' }
];

const PROBLEMS = [
  { icon: '📱', title: 'Le tomas foto al comprobante', desc: 'El cliente te muestra el comprobante en su celular, le tomas foto y entregas el servicio confiando en que es real.' },
  { icon: '🕐', title: 'Verificas después, muy tarde', desc: 'Al final del día o al siguiente, cuando tienes tiempo, entras al banco para confirmar. Pero ya es demasiado tarde.' },
  { icon: '💸', title: 'Descubres pagos falsos', desc: 'Encuentras comprobantes editados, transferencias que nunca llegaron o duplicadas. Ya perdiste el servicio y el dinero.' },
  { icon: '👥', title: 'Solo tú tienes acceso al banco', desc: 'Tus empleados no pueden verificar porque no tienen acceso a cuentas bancarias. Todo depende de ti.' },
  { icon: '⏰', title: 'Pierdes tiempo valioso', desc: 'Pasas horas verificando pagos, tiempo que podrías usar para hacer crecer tu negocio.' },
  { icon: '💰', title: 'Contratas personal solo para esto', desc: 'Necesitas contratar personal de confianza solo para verificar pagos, aumentando costos innecesarios.' }
];

const FEATURES = [
  '📱 Verificación instantánea por WhatsApp',
  '🕵️ Detecta comprobantes falsos y duplicados',
  '🏦 Funciona con Bancolombia',
  '💻 Dashboard web responsive para administrar',
  '📊 Ve todos los pagos, montos y empleados',
  '📥 Descarga reportes y comprobantes',
  '✏️ Modifica información de pagos',
  '🔒 Solo tú tienes acceso bancario, nadie más'
];

const STEPS = [
  { n: '1', title: 'Creas tu cuenta en ChatPay', desc: 'Te registras en nuestra plataforma web. Es gratis crear la cuenta y te damos acceso inmediato al dashboard para que veas cómo funciona.' },
  { n: '2', title: 'Conectas tu correo de Bancolombia', desc: 'De forma segura autorizas el acceso a los emails de notificación de Bancolombia. Solo consultamos, nunca movemos dinero.' },
  { n: '3', title: 'Tus empleados usan nuestro WhatsApp', desc: 'Les das el número de WhatsApp. Cuando reciban un pago, envían la foto del comprobante y en segundos saben si es válido.' }
];

export default function Landing() {
  return (
    <div className="min-h-screen font-sans text-slate-900">
      {/* NAVBAR */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-white/80 backdrop-blur border-b border-slate-100">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <span className="font-serif text-xl font-semibold">ChatPay</span>
          <nav className="hidden md:flex items-center gap-6 text-sm text-slate-600">
            {NAV_LINKS.map((l) => (
              <a key={l.href} href={l.href} className="hover:text-slate-900 transition">{l.label}</a>
            ))}
          </nav>
          <div className="flex items-center gap-3">
            <Link to="/registro" className="btn btn-ghost text-sm hidden md:inline-flex">Crear cuenta</Link>
            <Link to="/login" className="btn btn-primary text-sm">Ingresar</Link>
          </div>
        </div>
      </header>

      {/* HERO */}
      <section className="pt-32 pb-24 px-6 bg-gradient-to-b from-slate-50 to-white text-center">
        <div className="inline-flex items-center gap-2 bg-white border border-slate-200 rounded-full px-4 py-1.5 text-xs text-slate-600 mb-8 shadow-sm">
          📱 Verificación por WhatsApp
        </div>
        <h1 className="text-5xl md:text-6xl font-serif leading-tight max-w-3xl mx-auto">
          <em className="not-italic font-serif italic">Verifica</em> transferencias<br />desde WhatsApp
        </h1>
        <p className="mt-6 text-slate-500 text-lg max-w-xl mx-auto leading-relaxed">
          Tus empleados envían foto del comprobante a nuestro WhatsApp. En segundos
          les confirmamos si el pago es real, falso o duplicado.
        </p>
        <div className="mt-8 flex flex-col sm:flex-row gap-3 justify-center">
          <Link to="/registro" className="btn btn-primary text-base px-8 py-3">Crear cuenta gratis</Link>
          <a href="#como-funciona" className="btn btn-ghost text-base px-8 py-3">Ver cómo funciona</a>
        </div>
        <p className="mt-8 text-sm text-slate-400">Verificación 100% automática · Bancolombia · Respuesta en segundos</p>
      </section>

      {/* PROBLEMA */}
      <section id="problema" className="py-20 px-6 bg-white">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-4xl font-serif text-center mb-3">¿Te ha pasado esto?</h2>
          <p className="text-center text-slate-500 mb-12">Estos problemas te cuestan dinero todos los días. Ya no más.</p>
          <div className="grid md:grid-cols-3 gap-5">
            {PROBLEMS.map((p) => (
              <div key={p.title} className="card hover:shadow-md transition">
                <div className="text-2xl mb-3">{p.icon}</div>
                <h3 className="font-semibold mb-2">{p.title}</h3>
                <p className="text-sm text-slate-500 leading-relaxed">{p.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* SOLUCIÓN */}
      <section id="solucion" className="py-20 px-6 bg-slate-50">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-4xl font-serif text-center mb-3">La solución: WhatsApp + Dashboard web</h2>
          <p className="text-center text-slate-500 mb-12 max-w-xl mx-auto">
            Tus empleados envían fotos por WhatsApp. ChatPay verifica en tus bancos y responde al instante. Tú controlas todo desde el dashboard.
          </p>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-3">
            {FEATURES.map((f) => (
              <div key={f} className="bg-white rounded-xl border border-slate-200 px-4 py-3 text-sm flex items-start gap-2">
                <span className="text-brand-500 mt-0.5">✓</span>
                <span>{f}</span>
              </div>
            ))}
          </div>

          {/* 3 pilares */}
          <div className="grid md:grid-cols-3 gap-6 mt-12">
            <div className="card text-center">
              <div className="text-3xl mb-3">📱</div>
              <h3 className="font-semibold mb-2">WhatsApp para empleados</h3>
              <p className="text-sm text-slate-500">Tus empleados solo envían la foto del comprobante. En 5 segundos reciben confirmación si es válido o falso.</p>
            </div>
            <div className="card text-center">
              <div className="text-3xl mb-3">💻</div>
              <h3 className="font-semibold mb-2">Dashboard web para ti</h3>
              <p className="text-sm text-slate-500">Desde tu computadora o celular ves todos los pagos, qué empleado los envió, descargas reportes y modificas información.</p>
            </div>
            <div className="card text-center">
              <div className="text-3xl mb-3">🔒</div>
              <h3 className="font-semibold mb-2">Máxima seguridad</h3>
              <p className="text-sm text-slate-500">Solo tú autorizas el correo de notificaciones. Nosotros solo consultamos, nunca movemos dinero. Tus empleados nunca ven datos bancarios.</p>
            </div>
          </div>
        </div>
      </section>

      {/* CÓMO FUNCIONA */}
      <section id="como-funciona" className="py-20 px-6 bg-white">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-4xl font-serif text-center mb-3">Así de simple funciona</h2>
          <p className="text-center text-slate-500 mb-12">3 pasos y ya no vuelves a verificar pagos manualmente.</p>
          <div className="grid md:grid-cols-3 gap-6">
            {STEPS.map((s) => (
              <div key={s.n} className="card relative">
                <div className="w-8 h-8 rounded-full bg-brand-50 border border-brand-500/30 text-brand-600 text-sm font-semibold flex items-center justify-center mb-4">
                  {s.n}
                </div>
                <h3 className="font-semibold mb-2">{s.title}</h3>
                <p className="text-sm text-slate-500 leading-relaxed">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA FINAL */}
      <section className="py-20 px-6 bg-slate-900 text-white text-center">
        <h2 className="text-4xl font-serif mb-3">Empieza a verificar pagos hoy</h2>
        <p className="text-slate-400 mb-8 max-w-md mx-auto">
          Crea tu cuenta gratis y en minutos tus empleados pueden verificar pagos por WhatsApp.
        </p>
        <Link to="/registro" className="btn bg-white text-slate-900 hover:bg-slate-100 text-base px-10 py-3">
          Crear cuenta gratis
        </Link>
      </section>

      {/* FOOTER */}
      <footer className="py-8 px-6 bg-slate-900 border-t border-slate-800 text-center text-sm text-slate-500">
        © {new Date().getFullYear()} ChatPay · VipToursCol. Todos los derechos reservados.
      </footer>
    </div>
  );
}
