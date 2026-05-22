import { Link } from 'react-router-dom';
import { Zap, Building2, Crown, Check } from 'lucide-react';
import Footer from '../components/Footer';
import { useEffect, useRef, useState } from 'react';

const PLANS = [
  {
    key: 'starter',
    label: 'Starter',
    price: 49900,
    tagline: 'Para negocios que empiezan',
    color: 'blue',
    Icon: Zap,
    features: [
      '1 empleado activo',
      '200 verificaciones / mes',
      '1 cuenta bancaria',
      'Dashboard básico',
      'Soporte por email',
    ],
  },
  {
    key: 'business',
    label: 'Business',
    price: 129900,
    tagline: 'Para equipos en crecimiento',
    color: 'emerald',
    Icon: Building2,
    popular: true,
    features: [
      '20 empleados activos',
      '1.000 verificaciones / mes',
      '3 cuentas bancarias',
      'Dashboard completo + reportes',
      'Soporte por WhatsApp',
    ],
  },
  {
    key: 'enterprise',
    label: 'Enterprise',
    price: 299900,
    tagline: 'Para operaciones de alto volumen',
    color: 'purple',
    Icon: Crown,
    features: [
      'Empleados ilimitados',
      'Verificaciones ilimitadas',
      'Cuentas bancarias ilimitadas',
      'Dashboard + reportes avanzados',
      'Soporte dedicado prioritario',
    ],
  },
];

function fmt(n) { return `$${Number(n).toLocaleString('es-CO')}`; }

const colorMap = {
  blue:    { bg: 'bg-blue-50',    text: 'text-blue-600',    border: 'border-blue-200',   icon: 'bg-blue-100',   btn: 'bg-blue-600 hover:bg-blue-700' },
  emerald: { bg: 'bg-emerald-600', text: 'text-white',       border: 'border-emerald-500', icon: 'bg-emerald-500', btn: 'bg-white hover:bg-emerald-50 !text-emerald-700' },
  purple:  { bg: 'bg-purple-50',  text: 'text-purple-600',  border: 'border-purple-200', icon: 'bg-purple-100', btn: 'bg-purple-600 hover:bg-purple-700' },
};

export default function Planes() {
  const plansRef = useRef(null);
  const faqRef = useRef(null);
  const [plansVisible, setPlansVisible] = useState(false);
  const [faqVisible, setFaqVisible] = useState(false);
  useEffect(() => {
    const obs = new IntersectionObserver((entries) => {
      entries.forEach(e => {
        if (e.target === plansRef.current && e.isIntersecting) setPlansVisible(true);
        if (e.target === faqRef.current && e.isIntersecting) setFaqVisible(true);
      });
    }, { threshold: 0.1 });
    if (plansRef.current) obs.observe(plansRef.current);
    if (faqRef.current) obs.observe(faqRef.current);
    return () => obs.disconnect();
  }, []);
  return (
    <div className="min-h-screen bg-white">
      {/* Navbar */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-white/80 backdrop-blur border-b border-slate-100">
        <div className="max-w-5xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link to="/"><img src="/logo.svg" alt="ChatPay" className="h-8 w-auto" /></Link>
          <div className="flex items-center gap-3">
            <Link to="/login" className="text-sm text-slate-600 hover:text-slate-900 font-medium">Iniciar sesión</Link>
            <Link to="/registro" className="bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold rounded-full px-5 py-2 transition-colors">
              Crear cuenta gratis
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="pt-32 pb-16 px-6 text-center bg-slate-50">
        <span className="inline-block bg-emerald-100 text-emerald-700 text-xs font-bold rounded-full px-4 py-1.5 mb-4 tracking-widest uppercase animate-fade-up" style={{ animationDelay: '0ms' }}>
          Planes y precios
        </span>
        <h1 className="text-4xl md:text-5xl font-bold text-slate-900 mb-4 animate-fade-up" style={{ animationDelay: '80ms' }}>
          Un plan para cada negocio
        </h1>
        <p className="text-slate-500 text-lg max-w-lg mx-auto animate-fade-up" style={{ animationDelay: '160ms' }}>
          Empieza gratis con el período de prueba y actualiza cuando lo necesites. Sin contratos, cancela cuando quieras.
        </p>
        <div className="mt-6 inline-flex items-center gap-2 bg-emerald-50 border border-emerald-200 rounded-full px-5 py-2 text-sm text-emerald-700 font-medium">
          ✓ 14 días de prueba gratis en todos los planes
        </div>
      </section>

      {/* Planes */}
      <section className="py-20 px-6">
        <div ref={plansRef} className="max-w-5xl mx-auto grid md:grid-cols-3 gap-6 items-start">
          {PLANS.map((plan, i) => {
            const c = colorMap[plan.color];
            const isEmerald = plan.color === 'emerald';
            return (
              <div key={plan.key}
                className={`rounded-3xl overflow-hidden shadow-sm border relative inview-scale card-lift ${['delay-0','delay-150','delay-300'][i]} ${plansVisible ? 'is-visible' : ''} ${
                  isEmerald ? 'bg-emerald-600 border-emerald-500 shadow-lg shadow-emerald-200 scale-105' : 'bg-white border-slate-200'
                }`}>
                {plan.popular && (
                  <div className="absolute top-4 right-4 bg-white text-emerald-700 text-xs font-bold rounded-full px-3 py-1 shadow-sm">
                    Más popular
                  </div>
                )}
                <div className="p-8">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-4 ${c.icon}`}>
                    <plan.Icon size={18} className={isEmerald ? 'text-white' : c.text} />
                  </div>
                  <h3 className={`text-xl font-bold mb-1 ${isEmerald ? 'text-white' : 'text-slate-900'}`}>{plan.label}</h3>
                  <p className={`text-sm mb-6 ${isEmerald ? 'text-emerald-200' : 'text-slate-400'}`}>{plan.tagline}</p>
                  <div className="mb-6">
                    <span className={`text-4xl font-black ${isEmerald ? 'text-white' : 'text-slate-900'}`}>{fmt(plan.price)}</span>
                    <span className={`text-sm ml-1 ${isEmerald ? 'text-emerald-200' : 'text-slate-400'}`}>/mes</span>
                  </div>
                  <ul className="space-y-3 mb-8">
                    {plan.features.map((f) => (
                      <li key={f} className="flex items-start gap-2">
                        <Check size={15} className={`mt-0.5 shrink-0 ${isEmerald ? 'text-emerald-300' : 'text-emerald-500'}`} />
                        <span className={`text-sm ${isEmerald ? 'text-emerald-100' : 'text-slate-600'}`}>{f}</span>
                      </li>
                    ))}
                  </ul>
                  <Link to="/registro"
                    className={`block text-center font-bold text-sm rounded-full py-3 transition-colors ${c.btn} ${isEmerald ? '' : 'text-white'}`}>
                    Empezar con {plan.label} →
                  </Link>
                </div>
              </div>
            );
          })}
        </div>

        {/* FAQ corta */}
        <div ref={faqRef} className="max-w-2xl mx-auto mt-16">
          <h2 className="text-2xl font-bold text-slate-900 text-center mb-8">Preguntas frecuentes</h2>
          <div className="space-y-4">
            {[
              { q: '¿El período de prueba requiere tarjeta?', a: 'No. La cuenta es completamente gratuita para empezar. Solo necesitas un correo electrónico.' },
              { q: '¿Puedo cambiar de plan en cualquier momento?', a: 'Sí. Puedes actualizar o bajar tu plan desde la sección Suscripción en tu dashboard.' },
              { q: '¿Qué pasa si supero el límite de verificaciones?', a: 'Te notificamos cuando estés cerca del límite. Puedes subir de plan o esperar al siguiente mes.' },
              { q: '¿Cómo se realiza el pago?', a: 'A través de Wompi, la plataforma de pagos más confiable de Colombia. Aceptamos tarjetas y PSE.' },
            ].map((item, i) => (
              <div key={item.q} className={`border border-slate-200 rounded-2xl p-5 card-lift inview-hidden ${['delay-0','delay-150','delay-300','delay-400'][i]} ${faqVisible ? 'is-visible' : ''}`}>
                <p className="font-semibold text-slate-900 mb-1">{item.q}</p>
                <p className="text-sm text-slate-500 leading-relaxed">{item.a}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
