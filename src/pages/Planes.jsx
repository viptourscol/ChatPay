import { Link } from 'react-router-dom';
import { Zap, Building2, Crown, Check, X, Rocket, Clock, Hotel, ChevronRight, MessageCircle, TrendingDown, CheckCircle2 } from 'lucide-react';
import Footer from '../components/Footer';
import { useEffect, useRef, useState } from 'react';

const PLANS = [
  {
    key: 'basico',
    label: 'Básico',
    price: 49900,
    tagline: 'Para negocios pequeños que arrancan',
    color: 'blue',
    Icon: Zap,
    features: [      '1 empleado activo',
      '300 verificaciones / mes',
      '1 cuenta bancaria (Bancolombia)',
      'Dashboard básico',
      'Exportar CSV',
      'Soporte chat 48h',
    ],
    notIncluded: ['Alertas WA al admin', 'Egresos Gmail', 'Cierre de nómina'],
  },
  {
    key: 'estandar',
    label: 'Estándar',
    price: 99900,
    tagline: 'Para equipos medianos en crecimiento',
    color: 'emerald',
    Icon: Building2,
    popular: true,
    features: [      '2 empleados activos',
      '800 verificaciones / mes',
      '2 cuentas bancarias',
      '1 número admin · 20 alertas WA/mes',
      'Dashboard completo',
      'Exportar CSV + Excel',
      'Historial 90 días',
      'Soporte chat 24h',
    ],
    notIncluded: ['Egresos Gmail', 'Cierre de nómina'],
  },
  {
    key: 'pro',
    label: 'Pro',
    price: 199900,
    tagline: 'Para empresas con alto volumen',
    color: 'violet',
    Icon: Rocket,
    features: [      '5 empleados activos',
      '2.500 verificaciones / mes',
      '4 cuentas bancarias',
      '2 números admin · 50 alertas WA/mes',
      'Egresos automáticos desde Gmail',
      'Cierre de nómina PDF/Excel/CSV',
      'Dashboard por empleado',
      'Historial 1 año',
      'Soporte prioritario 8h',
    ],
  },  {
    key: 'empresarial',
    label: 'Empresarial',
    price: 349900,
    tagline: 'Para operaciones de alto volumen · 1 sede',
    color: 'purple',
    Icon: Crown,
    features: [      '10 empleados activos',
      '10.000 verificaciones / mes',
      '8 cuentas bancarias',
      '2 números admin · 200 alertas WA/mes',
      'Egresos Gmail + Cierre nómina',
      'Reportes programados por email',
      'Historial ilimitado',
      'Soporte WhatsApp directo + onboarding',
    ],
    notIncluded: ['Multi-sede (ver Plan Cadena)'],
    warning: 'Plan para una sola sede. Para múltiples sedes ver Plan Cadena.',
  },
];

function fmt(n) { return `$${Number(n).toLocaleString('es-CO')}`; }

const colorMap = {
  blue:    { bg: 'bg-blue-50',    text: 'text-blue-600',    border: 'border-blue-200',    icon: 'bg-blue-100',    btn: 'bg-blue-600 hover:bg-blue-700' },
  emerald: { bg: 'bg-emerald-600', text: 'text-white',       border: 'border-emerald-500', icon: 'bg-emerald-500', btn: 'bg-white hover:bg-emerald-50 !text-emerald-700' },
  violet:  { bg: 'bg-violet-50',  text: 'text-violet-600',  border: 'border-violet-200',  icon: 'bg-violet-100',  btn: 'bg-violet-600 hover:bg-violet-700' },
  purple:  { bg: 'bg-purple-50',  text: 'text-purple-600',  border: 'border-purple-200',  icon: 'bg-purple-100',  btn: 'bg-purple-600 hover:bg-purple-700' },
};

const CADENA_TIERS = [
  { min: 5,  max: 9,    price: 289900, discount: 17 },
  { min: 10, max: 19,   price: 249900, discount: 28 },
  { min: 20, max: null, price: 199900, discount: 43 },
];

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
        </p>        <div className="mt-6 inline-flex items-center gap-2 bg-emerald-50 border border-emerald-200 rounded-full px-5 py-2 text-sm text-emerald-700 font-medium">
          <Check size={14} className="text-emerald-600" /> 14 días de prueba gratis en todos los planes
        </div>
      </section>

      {/* Planes */}
      <section className="py-20 px-6">        <div ref={plansRef} className="max-w-6xl mx-auto grid md:grid-cols-2 lg:grid-cols-4 gap-6 items-start">
          {PLANS.map((plan, i) => {
            const c = colorMap[plan.color];
            const isEmerald = plan.color === 'emerald';
            return (
              <div key={plan.key}
                className={`rounded-3xl overflow-hidden shadow-sm border relative inview-scale ${'delay-0 delay-150 delay-300 delay-400'.split(' ')[i]} ${plansVisible ? 'is-visible' : ''} ${
                  isEmerald ? 'bg-emerald-600 border-emerald-500 shadow-lg shadow-emerald-200 scale-105' : 'bg-white border-slate-200'
                }`}>
                {plan.popular && (
                  <div className="absolute top-4 right-4 bg-white text-emerald-700 text-xs font-bold rounded-full px-3 py-1 shadow-sm">
                    Más popular
                  </div>
                )}
                <div className="p-6">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-4 ${c.icon}`}>
                    <plan.Icon size={18} className={isEmerald ? 'text-white' : c.text} />
                  </div>
                  <h3 className={`text-xl font-bold mb-1 ${isEmerald ? 'text-white' : 'text-slate-900'}`}>{plan.label}</h3>
                  <p className={`text-sm mb-4 ${isEmerald ? 'text-emerald-200' : 'text-slate-400'}`}>{plan.tagline}</p>
                  <div className="mb-5">
                    <span className={`text-3xl font-black ${isEmerald ? 'text-white' : 'text-slate-900'}`}>{fmt(plan.price)}</span>
                    <span className={`text-sm ml-1 ${isEmerald ? 'text-emerald-200' : 'text-slate-400'}`}>/mes</span>
                  </div>
                  <ul className="space-y-2 mb-4">
                    {plan.features.map((f) => (
                      <li key={f} className="flex items-start gap-2">
                        <Check size={14} className={`mt-0.5 shrink-0 ${isEmerald ? 'text-emerald-300' : 'text-emerald-500'}`} />
                        <span className={`text-xs ${isEmerald ? 'text-emerald-100' : 'text-slate-600'}`}>{f}</span>
                      </li>
                    ))}
                  </ul>
                  {plan.notIncluded?.length > 0 && (
                    <ul className="space-y-1 mb-3 border-t border-slate-100 pt-3">
                      {plan.notIncluded.map((f) => (
                        <li key={f} className="flex items-start gap-2 opacity-50">
                          <X size={12} className="text-slate-400 mt-0.5 shrink-0" />
                          <span className="text-xs text-slate-400">{f}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                  {/* Alerta 1 sola sede para Empresarial */}
                  {plan.warning && (
                    <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-lg p-2 mb-3">
                      <Hotel size={12} className="text-amber-500 shrink-0 mt-0.5" />
                      <p className="text-[11px] text-amber-700 leading-snug">{plan.warning}</p>
                    </div>
                  )}
                  <Link to="/registro"
                    className={`block text-center font-bold text-sm rounded-full py-3 transition-colors mt-2 ${c.btn} ${isEmerald ? '' : 'text-white'}`}>
                    Empezar con {plan.label} →
                  </Link>
                </div>
              </div>
            );
          })}
        </div>

        {/* ─── Plan Cadena / Red ─── */}
        <div id="plan-cadena" className={`max-w-6xl mx-auto mt-8 rounded-3xl border-2 border-amber-400 bg-gradient-to-br from-amber-50 to-orange-50 p-6 relative overflow-hidden inview-scale delay-400 ${plansVisible ? 'is-visible' : ''}`}>
          {/* Badge */}
          <div className="absolute top-5 right-5 flex items-center gap-1.5 bg-amber-400 text-white text-xs font-bold px-3 py-1.5 rounded-full shadow">
            <Hotel size={12} /> MULTI-SEDE
          </div>

          <div className="flex items-center gap-3 mb-1">
            <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center shrink-0">
              <Hotel size={18} className="text-amber-600" />
            </div>
            <div>
              <h3 className="text-xl font-bold text-slate-900">Cadena / Red</h3>
              <p className="text-sm text-slate-400">Para cadenas hoteleras, franquicias y grupos empresariales</p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 my-5">
            {CADENA_TIERS.map((tier) => (
              <div key={tier.min} className="bg-white/80 rounded-2xl p-4 border border-amber-200 text-center shadow-sm">
                <p className="text-xs text-slate-500 font-medium mb-1">
                  {tier.max ? `${tier.min}–${tier.max} sedes` : `${tier.min}+ sedes`}
                </p>
                <p className="text-2xl font-black text-slate-900">{fmt(tier.price)}</p>
                <p className="text-xs text-slate-400 mb-2">/sede · mes</p>
                <span className="inline-block text-[11px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full">
                  -{tier.discount}% vs individual
                </span>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-2 mb-5">
            {[
              'Todo el plan Empresarial en cada sede',
              'Admin independiente por sede',
              'Dashboard maestro del grupo',
              'Reportes consolidados de la red',
              'Facturación única al grupo',
              'Descuento automático por volumen de sedes',
              'Onboarding dedicado para toda la red',
              'Account manager asignado',
              'Soporte WhatsApp directo · SLA < 4h',
            ].map(f => (
              <div key={f} className="flex items-center gap-2 text-sm text-slate-700">
                <CheckCircle2 size={14} className="text-amber-500 shrink-0" />
                {f}
              </div>
            ))}
          </div>

          {/* Ejemplo de ahorro */}
          <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 mb-5 flex items-center gap-4">
            <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center shrink-0">
              <TrendingDown size={18} className="text-emerald-600" />
            </div>
            <div>
              <p className="text-sm font-semibold text-emerald-800">Ejemplo real: 20 hoteles</p>
              <p className="text-xs text-emerald-700 mt-0.5">
                Individual: <span className="line-through text-slate-400">{fmt(349900 * 20)}/mes</span>
                {' '}→ Plan Cadena: <strong>{fmt(199900 * 20)}/mes</strong>
                {' '}— <span className="font-bold">ahorras {fmt((349900 - 199900) * 20)}/mes</span>
              </p>
            </div>
          </div>

          <a
            href="https://wa.me/573000000000?text=Hola%2C%20quiero%20información%20del%20Plan%20Cadena%20para%20mi%20grupo%20de%20hoteles"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center gap-2 w-full sm:w-auto px-8 py-3.5 rounded-full text-sm font-bold bg-amber-500 hover:bg-amber-600 text-white transition shadow-md"
          >
            <MessageCircle size={16} /> Solicitar oferta personalizada <ChevronRight size={15} />
          </a>
          <p className="text-xs text-slate-400 mt-2">Te contactamos en menos de 24 horas</p>
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
