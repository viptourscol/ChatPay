import { Link } from 'react-router-dom';
import { useInView } from '../hooks/useInView';
import Footer from '../components/Footer';
import {
  Smartphone, Clock, AlertTriangle, Users, TimerOff, DollarSign,
  CheckCircle, Search, Landmark, Monitor, BarChart2, Download,
  Pencil, ShieldCheck, Lock, Wallet, Zap, Bell
} from 'lucide-react';

const NAV_LINKS = [
  { href: '#problema', label: 'El Problema' },
  { href: '#solucion', label: 'La Solución' },
  { href: '#como-funciona', label: 'Cómo Funciona' }
];

const PROBLEMS = [
  { Icon: Smartphone,    title: 'Le tomas foto al comprobante',      desc: 'El cliente te muestra el comprobante en su celular, le tomas foto y entregas el servicio confiando en que es real.',                                          urgent: false },
  { Icon: Clock,         title: 'Verificas después, muy tarde',         desc: 'Al final del día, cuando tienes tiempo, entras al banco para confirmar. Pero ya es demasiado tarde.',                                                       urgent: false },
  { Icon: AlertTriangle, title: 'Descubres pagos falsos',                desc: 'Encuentras comprobantes editados, transferencias que nunca llegaron o duplicadas. Ya perdiste el servicio y el dinero.',                                    urgent: true  },
  { Icon: Users,         title: 'Solo tú tienes acceso al banco',       desc: 'Tus empleados no pueden verificar porque no tienen acceso a cuentas bancarias. Todo depende de ti.',                                                       urgent: false },
  { Icon: TimerOff,      title: 'Pierdes tiempo valioso',               desc: 'Pasas horas verificando pagos, tiempo que podrías usar para hacer crecer tu negocio.',                                                                     urgent: true  },
  { Icon: DollarSign,    title: 'Contratas personal solo para esto',    desc: 'Necesitas contratar personal de confianza solo para verificar pagos, aumentando costos innecesarios.',                                                       urgent: true  },
];

const FEATURES = [
  { Icon: Smartphone,  label: 'Verificación instantánea por WhatsApp' },
  { Icon: Search,      label: 'Detecta comprobantes falsos y duplicados' },
  { Icon: Landmark,    label: 'Funciona con Bancolombia' },
  { Icon: Monitor,     label: 'Dashboard web responsive para administrar' },
  { Icon: BarChart2,   label: 'Ve todos los pagos, montos y empleados' },
  { Icon: Download,    label: 'Descarga reportes y comprobantes' },
  { Icon: Pencil,      label: 'Modifica información de pagos' },
  { Icon: Lock,        label: 'Solo tú tienes acceso bancario, nadie más' },
];

const STEPS = [
  { n: '1', title: 'Creas tu cuenta en ChatPay', desc: 'Te registras en nuestra plataforma web. Es gratis crear la cuenta y te damos acceso inmediato al dashboard para que veas cómo funciona.' },
  { n: '2', title: 'Conectas tu correo de Bancolombia', desc: 'De forma segura autorizas el acceso a los emails de notificación de Bancolombia. Solo consultamos, nunca movemos dinero.' },
  { n: '3', title: 'Tus empleados usan nuestro WhatsApp', desc: 'Les das el número de WhatsApp. Cuando reciban un pago, envían la foto del comprobante y en segundos saben si es válido.' }
];

export default function Landing() {
  // ── Refs para IntersectionObserver ─────────────────────
  const [heroRef,     heroVisible]     = useInView(0.1, '0px', true);
  const [problemaRef, problemaVisible] = useInView(0.1, '0px 0px -40px 0px', true);
  const [solucionRef, solucionVisible] = useInView(0.1, '0px 0px -40px 0px', true);
  const [comoRef,     comoVisible]     = useInView(0.1, '0px 0px -40px 0px', true);
  const [bannerRef,   bannerVisible]   = useInView(0.15, '0px 0px -40px 0px', true);
  const [ctaRef,      ctaVisible]      = useInView(0.15, '0px 0px -40px 0px', true);

  return (
    <div className="min-h-screen font-sans text-slate-900">
      {/* NAVBAR */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-white/80 backdrop-blur border-b border-slate-100">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <img src="/logo.svg" alt="ChatPay Bot" className="h-8 w-auto" />
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
      <section className="pt-28 pb-16 px-6 bg-gradient-to-b from-slate-50 to-white">
        <div ref={heroRef} className="max-w-6xl mx-auto flex flex-col lg:flex-row items-center gap-10 lg:gap-16">

          {/* Texto izquierda */}
          <div className="flex-1 text-center lg:text-left">
            <div className={`inline-flex items-center gap-2 bg-white border border-slate-200 rounded-full px-4 py-1.5 text-xs text-slate-600 mb-6 shadow-sm inview-hidden delay-0 ${heroVisible ? 'is-visible' : ''}`}>
              <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 fill-[#25D366] shrink-0" xmlns="http://www.w3.org/2000/svg"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
              Verificación por WhatsApp
            </div>
            <h1 className={`text-5xl md:text-6xl font-serif leading-tight inview-hidden delay-75 ${heroVisible ? 'is-visible' : ''}`}>
              <em className="not-italic font-serif italic">Verifica</em> transferencias<br />desde WhatsApp
            </h1>
            <p className={`mt-6 text-slate-500 text-lg leading-relaxed max-w-lg mx-auto lg:mx-0 inview-hidden delay-150 ${heroVisible ? 'is-visible' : ''}`}>
              Tus empleados envían foto del comprobante a nuestro WhatsApp. En segundos
              les confirmamos si el pago es real, falso o duplicado.
            </p>
            <div className={`mt-8 flex flex-col sm:flex-row gap-3 justify-center lg:justify-start inview-hidden delay-300 ${heroVisible ? 'is-visible' : ''}`}>
              <Link to="/registro" className="btn btn-primary text-base px-8 py-3">Crear cuenta gratis</Link>
              <a href="#como-funciona" className="btn btn-ghost text-base px-8 py-3">Ver cómo funciona</a>
            </div>
            <p className={`mt-6 text-sm text-slate-400 inview-hidden delay-400 ${heroVisible ? 'is-visible' : ''}`}>Verificación 100% automática · Bancolombia · Respuesta en segundos</p>
          </div>

          {/* Imagen derecha */}
          <div className={`flex-1 flex justify-center lg:justify-end inview-hidden delay-200 ${heroVisible ? 'is-visible' : ''}`}>
            <img
              src="/hero-banner.png"
              alt="ChatPay verifica pagos por WhatsApp"
              className="w-full max-w-md lg:max-w-lg xl:max-w-xl object-contain drop-shadow-xl rounded-3xl animate-float"
            />
          </div>
        </div>
      </section>

      {/* PROBLEMA */}
      <section id="problema" className="py-24 px-6" style={{ background: 'linear-gradient(160deg, #f0fdf4 0%, #dcfce7 60%, #bbf7d0 100%)' }}>
        <div ref={problemaRef} className="max-w-5xl mx-auto">
          <div className={`text-center mb-14 inview-hidden delay-0 ${problemaVisible ? 'is-visible' : ''}`}>
            <span className="inline-block bg-red-100 text-red-600 text-xs font-semibold rounded-full px-4 py-1.5 mb-4 tracking-wide uppercase">El problema</span>
            <h2 className="text-4xl font-bold text-slate-900 mb-3">¿Te ha pasado esto?</h2>
            <p className="text-slate-500 text-lg max-w-xl mx-auto">Estos problemas te cuestan dinero todos los días. <strong className="text-slate-700">Ya no más.</strong></p>
          </div>
          <div className="grid md:grid-cols-3 gap-5">
            {PROBLEMS.map((p, i) => (
              <div key={p.title} className={`relative bg-white rounded-2xl px-6 py-5 shadow-sm border border-emerald-100 hover:shadow-md hover:-translate-y-0.5 transition-all inview-scale ${['delay-0','delay-150','delay-300'][i]} ${problemaVisible ? 'is-visible' : ''}`}>
                {p.urgent && (
                  <span className="absolute top-4 right-4 w-2.5 h-2.5 rounded-full bg-red-500" title="Impacto crítico" />
                )}
                <div className="w-11 h-11 rounded-2xl bg-emerald-50 border border-emerald-200 grid place-items-center mb-4 text-emerald-700">
                  <p.Icon size={20} />
                </div>
                <h3 className="font-bold text-slate-900 mb-2 leading-snug">{p.title}</h3>
                <p className="text-sm text-slate-500 leading-relaxed">{p.desc}</p>
              </div>
            ))}
          </div>
          <p className="text-center text-xs text-slate-400 mt-8 flex items-center justify-center gap-2">
            <span className="w-2 h-2 rounded-full bg-red-400 inline-block" /> Los puntos rojos indican mayor pérdida económica
          </p>
        </div>
      </section>

      {/* SOLUCIÓN */}
      <section id="solucion" className="py-24 px-6 bg-white">
        <div ref={solucionRef} className="max-w-5xl mx-auto">

          {/* Header */}
          <div className={`text-center mb-16 inview-hidden delay-0 ${solucionVisible ? 'is-visible' : ''}`}>
            <span className="inline-block bg-emerald-100 text-emerald-700 text-xs font-semibold rounded-full px-4 py-1.5 mb-4 tracking-wide uppercase">La solución</span>
            <h2 className="text-4xl font-bold text-slate-900 mb-3">WhatsApp + Dashboard web</h2>
            <p className="text-slate-500 text-lg max-w-xl mx-auto">
              Tus empleados verifican pagos desde WhatsApp. Tú controlas todo desde el dashboard.
            </p>
          </div>

          {/* 3 pilares principales */}
          <div className="grid md:grid-cols-3 gap-6 mb-14">
            <div className={`relative rounded-3xl p-7 text-center overflow-hidden inview-scale delay-0 card-lift border border-transparent ${solucionVisible ? 'is-visible' : ''}`}
              style={{ background: 'linear-gradient(145deg, #f0fdf4, #dcfce7)' }}>
              <div className="w-14 h-14 rounded-2xl bg-white shadow-sm border border-emerald-200 grid place-items-center mx-auto mb-5 icon-pop">
                <svg viewBox="0 0 24 24" className="w-7 h-7 fill-[#25D366]" xmlns="http://www.w3.org/2000/svg"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
              </div>
              <h3 className="font-bold text-slate-900 text-lg mb-2">WhatsApp para empleados</h3>
              <p className="text-sm text-slate-500 leading-relaxed">Envían foto del comprobante y en <strong className="text-slate-700">5 segundos</strong> reciben si el pago es válido, falso o duplicado.</p>
            </div>

            <div className={`relative rounded-3xl p-7 text-center overflow-hidden border-2 border-emerald-500 shadow-md inview-scale delay-150 card-lift ${solucionVisible ? 'is-visible' : ''}`}
              style={{ background: 'linear-gradient(145deg, #ffffff, #f0fdf4)' }}>
              <div className="absolute top-4 right-4 bg-emerald-500 text-white text-xs font-bold rounded-full px-3 py-0.5">Principal</div>
              <div className="w-14 h-14 rounded-2xl bg-emerald-500 shadow-sm grid place-items-center mx-auto mb-5 icon-pop">
                <Monitor size={26} className="text-white" />
              </div>
              <h3 className="font-bold text-slate-900 text-lg mb-2">Dashboard web para ti</h3>
              <p className="text-sm text-slate-500 leading-relaxed">Ves todos los pagos, qué empleado los envió, descargas reportes y modificas información <strong className="text-slate-700">desde cualquier dispositivo</strong>.</p>
            </div>

            <div className={`relative rounded-3xl p-7 text-center overflow-hidden inview-scale delay-300 card-lift border border-transparent ${solucionVisible ? 'is-visible' : ''}`}
              style={{ background: 'linear-gradient(145deg, #f0fdf4, #dcfce7)' }}>
              <div className="w-14 h-14 rounded-2xl bg-white shadow-sm border border-emerald-200 grid place-items-center mx-auto mb-5 icon-pop">
                <ShieldCheck size={26} className="text-emerald-600" />
              </div>
              <h3 className="font-bold text-slate-900 text-lg mb-2">Máxima seguridad</h3>
              <p className="text-sm text-slate-500 leading-relaxed">Solo tú autorizas el correo bancario. <strong className="text-slate-700">Nunca movemos dinero.</strong> Tus empleados nunca ven datos bancarios.</p>
            </div>
          </div>

          {/* Features grid */}
          <div className="rounded-3xl border border-emerald-100 bg-gradient-to-b from-emerald-50 to-white p-8">
            <p className="text-center text-sm font-semibold text-emerald-700 mb-6 uppercase tracking-wide">Todo incluido en tu plan</p>
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {FEATURES.map((f) => (
                <div key={f.label} className="bg-white rounded-xl border border-emerald-100 px-4 py-3 text-sm flex items-center gap-2.5 shadow-sm card-lift group cursor-default">
                  <div className="w-7 h-7 rounded-lg bg-emerald-50 flex items-center justify-center shrink-0 icon-pop">
                    <f.Icon size={14} className="text-emerald-600" />
                  </div>
                  <span className="text-slate-700 font-medium">{f.label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* CÓMO FUNCIONA */}
      <section id="como-funciona" className="py-24 px-6 bg-gradient-to-b from-white to-emerald-50">
        <div ref={comoRef} className="max-w-5xl mx-auto">
          {/* Encabezado */}
          <div className={`text-center mb-16 inview-hidden delay-0 ${comoVisible ? 'is-visible' : ''}`}>
            <span className="inline-block bg-emerald-100 text-emerald-700 text-xs font-bold rounded-full px-4 py-1.5 mb-4 tracking-widest uppercase">
              ¿Cómo funciona?
            </span>
            <h2 className="text-4xl md:text-5xl font-bold text-slate-900 mb-4">
              Así de simple funciona
            </h2>
            <p className="text-slate-500 text-lg max-w-md mx-auto">
              3 pasos y ya no vuelves a verificar pagos manualmente.
            </p>
          </div>

          {/* Pasos */}
          <div className="grid md:grid-cols-3 gap-6 relative">
            {/* Línea conectora (solo desktop) */}
            <div className={`hidden md:block absolute top-10 h-px bg-gradient-to-r from-emerald-200 via-emerald-400 to-emerald-200 inview-line ${comoVisible ? 'is-visible' : ''}`} style={{ left: '19%', right: '19%' }} />

            {/* Paso 1 */}
            <div className={`relative bg-white rounded-3xl p-8 shadow-sm border border-emerald-100 flex flex-col items-center text-center group hover:shadow-md inview-scale delay-150 card-lift ${comoVisible ? 'is-visible' : ''}`}>
              <div className="w-16 h-16 rounded-2xl bg-emerald-600 text-white text-2xl font-black flex items-center justify-center mb-6 shadow-lg shadow-emerald-200 icon-pop">
                1
              </div>
              <div className="w-12 h-12 rounded-2xl bg-emerald-50 flex items-center justify-center mb-4">
                <svg viewBox="0 0 24 24" className="w-6 h-6 fill-none stroke-emerald-600 stroke-2" xmlns="http://www.w3.org/2000/svg">
                  <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" strokeLinecap="round" strokeLinejoin="round"/>
                  <circle cx="9" cy="7" r="4" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="M22 21v-2a4 4 0 0 0-3-3.87" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="M16 3.13a4 4 0 0 1 0 7.75" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </div>
              <h3 className="font-bold text-slate-900 text-lg mb-2">Creas tu cuenta en ChatPay</h3>
              <p className="text-sm text-slate-500 leading-relaxed">Te registras gratis en la plataforma web y tienes acceso inmediato al dashboard.</p>
            </div>

            {/* Paso 2 */}
            <div className={`relative bg-emerald-600 rounded-3xl p-8 shadow-lg shadow-emerald-200 flex flex-col items-center text-center group hover:shadow-xl inview-scale delay-300 card-lift-white ${comoVisible ? 'is-visible' : ''}`}>
              <div className="w-16 h-16 rounded-2xl bg-white text-emerald-700 text-2xl font-black flex items-center justify-center mb-6 shadow icon-pop">
                2
              </div>
              <div className="w-12 h-12 rounded-2xl bg-white/20 flex items-center justify-center mb-4">
                <svg viewBox="0 0 24 24" className="w-6 h-6 fill-none stroke-white stroke-2" xmlns="http://www.w3.org/2000/svg">
                  <rect x="2" y="4" width="20" height="16" rx="2" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </div>
              <h3 className="font-bold text-white text-lg mb-2">Conectas tu correo de Bancolombia</h3>
              <p className="text-sm text-emerald-100 leading-relaxed">Autorizas el acceso a los emails de notificación. Solo consultamos, nunca movemos dinero.</p>
            </div>

            {/* Paso 3 */}
            <div className={`relative bg-white rounded-3xl p-8 shadow-sm border border-emerald-100 flex flex-col items-center text-center group hover:shadow-md inview-scale delay-500 card-lift ${comoVisible ? 'is-visible' : ''}`}>
              <div className="w-16 h-16 rounded-2xl bg-emerald-600 text-white text-2xl font-black flex items-center justify-center mb-6 shadow-lg shadow-emerald-200 icon-pop">
                3
              </div>
              <div className="w-12 h-12 rounded-2xl bg-emerald-50 flex items-center justify-center mb-4">
                <svg viewBox="0 0 24 24" className="w-6 h-6 fill-[#25D366]" xmlns="http://www.w3.org/2000/svg">
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                </svg>
              </div>
              <h3 className="font-bold text-slate-900 text-lg mb-2">Tus empleados usan WhatsApp</h3>
              <p className="text-sm text-slate-500 leading-relaxed">Les das el número. Envían el comprobante y en segundos saben si es válido, falso o duplicado.</p>
            </div>
          </div>

          {/* Tiempo estimado */}
          <p className="text-center text-sm text-emerald-600 font-semibold mt-10">
            ⏱ Configuración total: menos de 5 minutos
          </p>
        </div>
      </section>

      {/* SECCIÓN ¿QUÉ QUIERES HACER HOY? */}
      <section className="py-24 px-6 bg-slate-50">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-3xl md:text-4xl font-bold text-slate-900 text-center mb-14">
            ¿Qué quieres hacer o saber hoy?
          </h2>

          <div className="grid md:grid-cols-3 gap-6">

            {/* Card 1 — Cómo activar */}
            <div className="bg-white rounded-3xl overflow-hidden shadow-sm border border-slate-100 flex flex-col card-lift group">
              <div className="h-44 bg-emerald-50 relative overflow-hidden flex items-center justify-center">
                <div className="absolute inset-0 bg-gradient-to-br from-emerald-100 to-emerald-200" />
                {/* Mock tarjeta de activación */}
                <div className="relative bg-white rounded-2xl shadow-lg px-5 py-4 w-44 -rotate-2 group-hover:rotate-0 transition-transform duration-300">
                  <div className="w-9 h-9 rounded-full border-2 border-emerald-500 flex items-center justify-center mx-auto mb-3">
                    <svg viewBox="0 0 24 24" className="w-5 h-5 stroke-emerald-600 fill-none stroke-2"><path d="m5 12 5 5L20 7" strokeLinecap="round" strokeLinejoin="round"/></svg>
                  </div>
                  <div className="flex items-center gap-2 bg-slate-50 rounded-lg px-2 py-1.5 mb-2">
                    <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 stroke-slate-400 fill-none stroke-2 shrink-0"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" strokeLinecap="round"/><circle cx="12" cy="7" r="4" strokeLinecap="round"/></svg>
                    <span className="text-xs text-slate-400">Usuario</span>
                  </div>
                  <div className="flex items-center gap-2 bg-slate-50 rounded-lg px-2 py-1.5">
                    <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 stroke-slate-400 fill-none stroke-2 shrink-0"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4" strokeLinecap="round"/></svg>
                    <span className="text-xs text-slate-400">••••••••</span>
                  </div>
                </div>
              </div>
              <div className="p-6 flex flex-col flex-1">
                <h3 className="font-bold text-slate-900 mb-2">Cómo activar mi cuenta en ChatPay</h3>
                <p className="text-sm text-slate-500 leading-relaxed mb-5 flex-1">
                  Sigue los pasos para registrarte y conectar tu correo de Bancolombia. Listo en minutos.
                </p>
                <Link to="/como-activar" className="inline-flex items-center gap-1 text-sm font-bold text-emerald-600 hover:gap-2 transition-all">
                  Activa tu cuenta <span>→</span>
                </Link>
              </div>
            </div>

            {/* Card 2 — Tarifas (tarjeta central destacada) */}
            <div className="bg-emerald-600 rounded-3xl overflow-hidden shadow-lg flex flex-col card-lift-white group">
              <div className="h-44 bg-emerald-700 relative overflow-hidden flex items-center justify-center">
                <div className="absolute inset-0 bg-gradient-to-br from-emerald-800 to-emerald-600" />
                <span className="relative text-7xl font-black text-white/20 select-none group-hover:text-white/30 transition-colors">
                  $0
                </span>
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="text-center">
                    <p className="text-emerald-200 text-xs font-semibold uppercase tracking-widest mb-1">Desde</p>
                    <p className="text-white text-4xl font-black">$0</p>
                    <p className="text-emerald-300 text-sm">para empezar</p>
                  </div>
                </div>
              </div>
              <div className="p-6 flex flex-col flex-1">
                <h3 className="font-bold text-white mb-2">Conocer las tarifas</h3>
                <p className="text-sm text-emerald-100 leading-relaxed mb-5 flex-1">
                  Cuenta gratuita con verificaciones incluidas. Compara planes y encuentra el que se adapta a tu negocio.
                </p>
                <Link to="/planes" className="inline-flex items-center gap-1 text-sm font-bold text-emerald-300 hover:gap-2 transition-all">
                  Ver planes <span>→</span>
                </Link>
              </div>
            </div>

            {/* Card 3 — Bancos compatibles */}
            <div className="bg-white rounded-3xl overflow-hidden shadow-sm border border-slate-100 flex flex-col card-lift group">
              <div className="h-44 bg-yellow-50 relative overflow-hidden flex items-center justify-center">
                <div className="absolute inset-0 bg-gradient-to-br from-yellow-100 to-emerald-100" />
                <div className="relative flex flex-col items-center gap-3">
                  <div className="bg-white rounded-2xl shadow px-5 py-3 w-44 flex items-center justify-center">
                    <img src="/Bancolombia_S.A._logo.svg" alt="Bancolombia" className="h-7 w-auto object-contain" />
                  </div>
                  <div className="bg-white rounded-2xl shadow px-5 py-3 w-44 flex items-center justify-center">
                    <img src="/BBVA_2019.svg" alt="BBVA" className="h-7 w-auto object-contain" />
                  </div>
                  <div className="bg-white/60 rounded-xl px-4 py-2 text-xs font-medium text-slate-400 w-44 text-center border border-dashed border-slate-200">
                    + próximamente
                  </div>
                </div>
              </div>
              <div className="p-6 flex flex-col flex-1">
                <h3 className="font-bold text-slate-900 mb-2">¿Desde qué bancos se pueden verificar comprobantes?</h3>
                <p className="text-sm text-slate-500 leading-relaxed mb-5 flex-1">
                  Actualmente compatible con <strong>Bancolombia</strong> y <strong>BBVA</strong>. Integrando Nequi, Daviplata y más.
                </p>
                <Link to="/bancos-compatibles" className="inline-flex items-center gap-1 text-sm font-bold text-emerald-600 hover:gap-2 transition-all">
                  Ver compatibilidad <span>→</span>
                </Link>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* BANNER MÓVIL ESTILO APP */}
      <section className="py-20 px-6 bg-gradient-to-b from-emerald-50 to-emerald-100">
        <div ref={bannerRef} className="max-w-sm mx-auto">
          {/* Tarjeta mock de app */}
          <div className={`bg-white rounded-2xl shadow-lg px-5 py-4 mb-8 inview-scale delay-0 ${bannerVisible ? 'is-visible' : ''}`}>
            <div className="flex items-start justify-between mb-3">
              <div>
                <div className="flex items-center gap-2 mb-0.5">
                  <div className="w-7 h-7 rounded-full bg-emerald-500 flex items-center justify-center">
                    <Smartphone size={14} className="text-white" />
                  </div>
                  <span className="font-semibold text-sm text-slate-800">ChatPay Bot</span>
                </div>
                <p className="text-xs text-slate-400 ml-9">Verificación instantánea de pagos</p>
              </div>
              <div className="text-right">
                <span className="text-xs text-emerald-600 font-semibold flex items-center gap-1 justify-end">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block" /> Activo
                </span>
                <p className="text-xs text-slate-400 mt-0.5">Configurar &rsaquo;</p>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-2xl font-bold text-slate-900 tracking-tight">✓ Pago verificado</p>
                <p className="text-xs text-slate-400 mt-0.5">Hace 3 segundos · Bancolombia</p>
              </div>
              <button className="bg-emerald-600 text-white text-xs font-semibold rounded-xl px-4 py-2 shadow-sm">
                Ver detalle
              </button>
            </div>
          </div>

          {/* Texto principal */}
          <div className={`text-center mb-8 inview-hidden delay-150 ${bannerVisible ? 'is-visible' : ''}`}>
            <h2 className="text-3xl font-serif leading-snug text-slate-800 mb-1">
              Ahora con ChatPay<br />
              tus empleados verifican
            </h2>
            <h2 className="text-3xl font-bold leading-snug text-slate-900">
              pagos en segundos<br />por WhatsApp
            </h2>
          </div>

          {/* Caja descriptiva */}
          <div className="bg-white/70 border border-emerald-200 rounded-2xl px-5 py-4 text-center mb-8">
            <p className="text-sm text-slate-600 leading-relaxed">
              Tú decides qué empleados pueden verificar. Ellos envían el comprobante y ChatPay responde al instante si es <strong>real, falso o duplicado</strong>.
            </p>
          </div>

          {/* CTA */}
          <div className="text-center">
            <Link to="/registro" className="inline-block bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-base rounded-2xl px-8 py-3 shadow-md transition">
              Crear cuenta gratis
            </Link>
            <p className="text-xs text-emerald-700 mt-3 font-medium">Sin tarjeta · Sin instalaciones · 100% WhatsApp</p>
          </div>
        </div>
      </section>

      {/* SECCIÓN ESTILO WOMPI - Control de pagos */}
      <section className="overflow-hidden">
        <div className="max-w-7xl mx-auto flex flex-col lg:flex-row items-center min-h-[480px]">

          {/* Columna izquierda — texto e íconos */}
          <div className="flex-1 px-8 py-16 lg:py-24 lg:pl-16 xl:pl-24">
            <h2 className="text-4xl xl:text-5xl font-bold text-slate-900 leading-tight mb-4">
              Con ChatPay tienes el control<br />de tus cobros
            </h2>
            <p className="text-slate-500 text-lg mb-10 max-w-lg leading-relaxed">
              Tú decides quién puede verificar pagos. Tus empleados envían el comprobante y ChatPay responde al instante si es real, falso o duplicado.
            </p>
            <div className="flex flex-wrap gap-8">
              <div className="flex flex-col items-center text-center gap-2 w-24">
                <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center">
                  <Wallet size={22} className="text-slate-700" />
                </div>
                <p className="text-xs text-slate-600 font-medium leading-snug">Todos tus pagos en un solo lugar</p>
              </div>
              <div className="flex flex-col items-center text-center gap-2 w-24">
                <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center">
                  <Zap size={22} className="text-slate-700" />
                </div>
                <p className="text-xs text-slate-600 font-medium leading-snug">Verificación en segundos</p>
              </div>
              <div className="flex flex-col items-center text-center gap-2 w-24">
                <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center">
                  <Bell size={22} className="text-slate-700" />
                </div>
                <p className="text-xs text-slate-600 font-medium leading-snug">Alerta instantánea por WhatsApp</p>
              </div>
            </div>
          </div>

          {/* Columna derecha — imagen flotante tarjetas */}
          <div className="flex-1 flex items-center justify-center px-6 py-10 lg:py-0">
            <img
              src="/banner-cards.png"
              alt="ChatPay verifica pagos automáticamente"
              className="w-full max-w-lg xl:max-w-xl object-contain drop-shadow-xl"
            />
          </div>
        </div>
      </section>

      {/* CTA FINAL */}
      <section ref={ctaRef} className="py-24 px-6 relative overflow-hidden"
        style={{ background: 'linear-gradient(135deg, #14532d 0%, #166534 40%, #15803d 100%)' }}>
        {/* Formas decorativas de fondo */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute -top-20 -right-20 w-96 h-96 rounded-full opacity-10" style={{ background: 'radial-gradient(circle, #4ade80, transparent)' }} />
          <div className="absolute -bottom-16 -left-16 w-72 h-72 rounded-full opacity-10" style={{ background: 'radial-gradient(circle, #86efac, transparent)' }} />
        </div>

        <div className="relative max-w-4xl mx-auto text-center">
          {/* Badge */}
          <span className={`inline-block bg-emerald-400/20 border border-emerald-400/30 text-emerald-300 text-xs font-semibold rounded-full px-4 py-1.5 mb-6 tracking-wide uppercase inview-hidden delay-0 ${ctaVisible ? 'is-visible' : ''}`}>
            Comienza hoy gratis
          </span>

          <h2 className={`text-4xl md:text-5xl font-bold text-white mb-4 leading-tight inview-hidden delay-75 ${ctaVisible ? 'is-visible' : ''}`}>
            Deja de perder dinero<br />en pagos falsos
          </h2>
          <p className={`text-emerald-200 text-lg mb-10 max-w-lg mx-auto leading-relaxed inview-hidden delay-150 ${ctaVisible ? 'is-visible' : ''}`}>
            Crea tu cuenta gratis y en minutos tus empleados verifican pagos por WhatsApp. Sin instalaciones, sin contratos.
          </p>

          {/* CTAs */}
          <div className={`flex flex-col sm:flex-row gap-4 justify-center mb-10 inview-hidden delay-300 ${ctaVisible ? 'is-visible' : ''}`}>
            <Link to="/registro"
              className="inline-flex items-center justify-center gap-2 bg-white text-emerald-800 font-bold text-base rounded-full px-10 py-3.5 shadow-lg hover:bg-emerald-50 transition-colors animate-pulse-cta">
              Crear cuenta gratis →
            </Link>
            <Link to="/login"
              className="inline-flex items-center justify-center gap-2 border border-white/30 text-white font-semibold text-base rounded-full px-10 py-3.5 hover:bg-white/10 transition-colors">
              Ya tengo cuenta
            </Link>
          </div>

          {/* Trust badges */}
          <div className="flex flex-wrap items-center justify-center gap-6 text-sm text-emerald-300">
            <span className="flex items-center gap-1.5">
              <svg viewBox="0 0 24 24" className="w-4 h-4 fill-[#25D366]" xmlns="http://www.w3.org/2000/svg"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
              100% WhatsApp
            </span>
            <span className="text-emerald-600">·</span>
            <span>✓ Bancolombia</span>
            <span className="text-emerald-600">·</span>
            <span>✓ Sin tarjeta de crédito</span>
            <span className="text-emerald-600">·</span>
            <span>✓ Respuesta en segundos</span>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <Footer />
    </div>
  );
}
