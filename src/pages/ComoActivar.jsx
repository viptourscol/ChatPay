import { Link } from 'react-router-dom';
import { CheckCircle2, UserPlus, Mail, Smartphone, Play } from 'lucide-react';
import Footer from '../components/Footer';
import { useEffect, useRef, useState } from 'react';

const STEPS = [
  {
    n: 1,
    icon: UserPlus,
    title: 'Crea tu cuenta gratis',
    desc: 'Ingresa a chatpay.com y haz clic en "Crear cuenta gratis". Solo necesitas tu nombre, empresa y correo electrónico. Sin tarjeta de crédito.',
    detail: 'El registro toma menos de 2 minutos. Recibirás un correo de confirmación para activar tu cuenta.',
  },
  {
    n: 2,
    icon: Mail,
    title: 'Conecta tu correo de Bancolombia',
    desc: 'Ve a Configuración → Cuenta bancaria y autoriza el acceso al correo que recibe las notificaciones de Bancolombia.',
    detail: 'ChatPay solo lee los correos de notificación de pagos. Nunca accede a tu saldo ni puede mover dinero.',
  },
  {
    n: 3,
    icon: UserPlus,
    title: 'Agrega a tus empleados',
    desc: 'En la sección Empleados, añade los números de WhatsApp de tu equipo. Tú decides quién puede verificar pagos.',
    detail: 'Puedes activar o desactivar empleados en cualquier momento desde el dashboard.',
  },
  {
    n: 4,
    icon: Smartphone,
    title: 'Comparte el número de WhatsApp',
    desc: 'Dale a tus empleados el número de WhatsApp de ChatPay. Cuando reciban un comprobante, solo deben enviarlo al chat.',
    detail: 'No requiere instalación de ninguna app adicional. Funciona con el WhatsApp que ya tienen.',
  },
  {
    n: 5,
    icon: Play,
    title: '¡Listo! Empieza a verificar',
    desc: 'ChatPay responde en segundos si el pago es válido, falso o duplicado. Todo queda registrado en tu dashboard.',
    detail: 'Cada verificación queda con fecha, hora, empleado y resultado guardado para tus reportes.',
  },
];

export default function ComoActivar() {
  const stepsRef = useRef(null);
  const [stepsVisible, setStepsVisible] = useState(false);
  useEffect(() => {
    const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) setStepsVisible(true); }, { threshold: 0.08 });
    if (stepsRef.current) obs.observe(stepsRef.current);
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
      <section className="pt-32 pb-16 px-6 text-center"
        style={{ background: 'linear-gradient(160deg, #14532d 0%, #166534 60%, #15803d 100%)' }}>
        <span className="inline-block bg-emerald-400/20 border border-emerald-400/30 text-emerald-300 text-xs font-bold rounded-full px-4 py-1.5 mb-4 tracking-widest uppercase animate-fade-up" style={{ animationDelay: '0ms' }}>
          Guía de activación
        </span>
        <h1 className="text-4xl md:text-5xl font-bold text-white mb-4 animate-fade-up" style={{ animationDelay: '80ms' }}>
          Cómo activar tu cuenta<br />en ChatPay
        </h1>
        <p className="text-emerald-200 text-lg max-w-lg mx-auto animate-fade-up" style={{ animationDelay: '160ms' }}>
          5 pasos simples y en menos de 10 minutos tus empleados ya pueden verificar pagos por WhatsApp.
        </p>
      </section>

      {/* Steps */}
      <section className="py-20 px-6">
        <div className="max-w-3xl mx-auto">
          <div ref={stepsRef} className="space-y-8">
            {STEPS.map((step, i) => (
              <div key={step.n} className={`flex gap-6 inview-hidden ${['delay-0','delay-150','delay-300','delay-400','delay-500'][i]} ${stepsVisible ? 'is-visible' : ''}`}>
                {/* Indicador vertical */}
                <div className="flex flex-col items-center">
                  <div className={`w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0 font-black text-lg shadow-sm transition-transform duration-300 hover:scale-110 ${
                    i === 0 ? 'bg-emerald-600 text-white shadow-emerald-200' : 'bg-emerald-50 text-emerald-700 border border-emerald-100'
                  }`}>
                    {step.n}
                  </div>
                  {i < STEPS.length - 1 && (
                    <div className="w-px flex-1 bg-emerald-100 mt-2 mb-0 min-h-[2rem]" />
                  )}
                </div>

                {/* Contenido */}
                <div className="pb-8 flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <step.icon size={16} className="text-emerald-600" />
                    <h3 className="font-bold text-slate-900 text-lg">{step.title}</h3>
                  </div>
                  <p className="text-slate-600 leading-relaxed mb-2">{step.desc}</p>
                  <p className="text-sm text-slate-400 leading-relaxed">{step.detail}</p>
                </div>
              </div>
            ))}
          </div>

          {/* CTA final */}
          <div className="mt-10 rounded-3xl p-8 text-center animate-zoom-in" style={{ background: 'linear-gradient(135deg, #14532d 0%, #15803d 100%)' }}>
            <CheckCircle2 size={40} className="text-emerald-300 mx-auto mb-4" />
            <h3 className="text-2xl font-bold text-white mb-2">¿Listo para empezar?</h3>
            <p className="text-emerald-200 text-sm mb-6">Crea tu cuenta gratis y sigue esta guía paso a paso.</p>
            <Link to="/registro"
              className="inline-block bg-white text-emerald-800 font-bold text-sm rounded-full px-10 py-3.5 hover:bg-emerald-50 transition-colors">
              Crear cuenta gratis →
            </Link>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
