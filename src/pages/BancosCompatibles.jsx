import { Link } from 'react-router-dom';
import { CheckCircle2, Clock, ShieldCheck } from 'lucide-react';
import Footer from '../components/Footer';
import { useEffect, useRef, useState } from 'react';

const BANKS_ORIGIN = [
  { name: 'Bancolombia', status: 'active', note: 'Verificación de pagos entrantes vía email de notificación', logo: '/Bancolombia_S.A._logo.svg' },
  { name: 'BBVA Colombia', status: 'active', note: 'Verificación de comprobantes enviados por clientes', logo: '/BBVA_2019.svg' },
  { name: 'Nequi', status: 'soon', note: 'Integración en desarrollo', logo: '/Nequi_Colombia_logo.svg' },
  { name: 'Davivienda', status: 'soon', note: 'Integración en desarrollo', logo: '/davivienda-seeklogo.svg' },
  { name: 'Banco de Bogotá', status: 'soon', note: 'Próximamente disponible', logo: '/Banco_de_Bogotá_logo.svg' },
  { name: 'Banco Popular', status: 'soon', note: 'Próximamente disponible', logo: '/Banco_Popular_(Colombia)_logo.svg' },
  { name: 'Scotiabank Colpatria', status: 'soon', note: 'Próximamente disponible', logo: '/Scotiabank_logo.svg' },
  { name: 'Nubank', status: 'soon', note: 'Próximamente disponible', logo: '/Nubank_logo_2021.svg' },
];

const HOW_IT_WORKS = [
  {
    title: 'El cliente te envía el comprobante',
    desc: 'Tu cliente realiza una transferencia desde cualquier banco en Colombia y te envía la foto o captura del comprobante de pago.',
  },
  {
    title: 'Tu empleado lo reenvía por WhatsApp',
    desc: 'El empleado toma la foto del comprobante y la envía al número de WhatsApp de ChatPay.',
  },
  {
    title: 'ChatPay lo verifica con tu banco',
    desc: 'ChatPay compara el comprobante con las notificaciones reales de tu cuenta en Bancolombia o BBVA.',
  },
  {
    title: 'Respuesta instantánea: real, falso o duplicado',
    desc: 'En segundos recibes la respuesta. Todo queda registrado en tu dashboard con fecha, monto y empleado.',
  },
];

export default function BancosCompatibles() {
  const banksRef = useRef(null);
  const howRef = useRef(null);
  const [banksVisible, setBanksVisible] = useState(false);
  const [howVisible, setHowVisible] = useState(false);

  useEffect(() => {
    const obs = new IntersectionObserver((entries) => {
      entries.forEach(e => {
        if (e.target === banksRef.current && e.isIntersecting) setBanksVisible(true);
        if (e.target === howRef.current && e.isIntersecting) setHowVisible(true);
      });
    }, { threshold: 0.12 });
    if (banksRef.current) obs.observe(banksRef.current);
    if (howRef.current) obs.observe(howRef.current);
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
          Compatibilidad bancaria
        </span>
        <h1 className="text-4xl md:text-5xl font-bold text-white mb-4 animate-fade-up" style={{ animationDelay: '80ms' }}>
          ¿Con qué bancos<br />funciona ChatPay?
        </h1>
        <p className="text-emerald-200 text-lg max-w-xl mx-auto animate-fade-up" style={{ animationDelay: '160ms' }}>
          Verifica pagos de cuentas en <strong className="text-white">Bancolombia y BBVA</strong>. Los comprobantes pueden venir de <strong className="text-white">cualquier banco de Colombia</strong>.
        </p>
      </section>

      {/* Aclaración importante */}
      <section className="py-12 px-6 bg-emerald-50 border-b border-emerald-100">
        <div className="max-w-3xl mx-auto">
          <div className="flex items-start gap-4 bg-white rounded-2xl border border-emerald-200 p-6 shadow-sm">
            <ShieldCheck size={28} className="text-emerald-600 shrink-0 mt-0.5" />
            <div>
              <h3 className="font-bold text-slate-900 mb-1">¿Cómo funciona exactamente?</h3>
              <p className="text-slate-600 text-sm leading-relaxed">
                ChatPay verifica que el pago <strong>sí llegó a tu cuenta</strong> comparando el comprobante recibido con las notificaciones de tu banco. 
                Tu cuenta debe estar en <strong>Bancolombia o BBVA</strong>. El pago puede provenir de 
                <strong> cualquier banco colombiano</strong> — Nequi, Daviplata, Banco de Bogotá, etc.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Bancos donde tienes tu cuenta */}
      <section className="py-16 px-6">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-slate-900 mb-3">Tu cuenta empresarial</h2>
            <p className="text-slate-500">ChatPay se conecta al correo de notificaciones de estos bancos para verificar que el pago llegó</p>
          </div>

          <div ref={banksRef} className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {BANKS_ORIGIN.map((bank, i) => (
              <div key={bank.name}
                className={`rounded-2xl border p-5 flex flex-col gap-3 card-lift inview-scale ${i < 4 ? ['delay-0','delay-150','delay-300','delay-500'][i] : ['delay-0','delay-150','delay-300','delay-500'][i-4]} ${banksVisible ? 'is-visible' : ''} ${
                  bank.status === 'active'
                    ? 'bg-white border-emerald-200 shadow-sm'
                    : 'bg-slate-50 border-slate-200'
                }`}>
                {/* Badge arriba a la derecha, fuera del flujo del logo */}
                <div className="flex items-start justify-between gap-2 min-h-[2.5rem]">
                  <div className="flex-1 flex items-center min-w-0">
                    <img src={bank.logo} alt={bank.name} className="h-7 w-auto max-w-[110px] object-contain object-left" />
                  </div>
                  <div className="shrink-0">
                    {bank.status === 'active' ? (
                      <span className="inline-flex items-center gap-1 text-xs text-emerald-600 font-semibold bg-emerald-50 border border-emerald-200 rounded-full px-2 py-0.5 whitespace-nowrap">
                        <CheckCircle2 size={10} /> Activo
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-xs text-slate-400 font-semibold bg-slate-100 border border-slate-200 rounded-full px-2 py-0.5 whitespace-nowrap">
                        <Clock size={10} /> Pronto
                      </span>
                    )}
                  </div>
                </div>
                <div>
                  <p className="font-semibold text-slate-900 text-sm">{bank.name}</p>
                  <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">{bank.note}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Comprobantes de cualquier banco */}
      <section className="py-16 px-6 bg-slate-50">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-10">
            <h2 className="text-3xl font-bold text-slate-900 mb-3">Comprobantes de cualquier banco</h2>
            <p className="text-slate-500 max-w-xl mx-auto">
              Tus clientes pueden pagarte desde cualquier banco de Colombia. ChatPay verifica que ese dinero efectivamente llegó a tu cuenta.
            </p>
          </div>

          <div className="bg-white rounded-3xl border border-slate-200 p-8">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
              {[
                { name: 'Bancolombia', logo: '/Bancolombia_S.A._logo.svg' },
                { name: 'BBVA', logo: '/BBVA_2019.svg' },
                { name: 'Nequi', logo: '/Nequi_Colombia_logo.svg' },
                { name: 'Davivienda', logo: '/davivienda-seeklogo.svg' },
                { name: 'Banco de Bogotá', logo: '/Banco_de_Bogotá_logo.svg' },
                { name: 'Banco Popular', logo: '/Banco_Popular_(Colombia)_logo.svg' },
                { name: 'Scotiabank', logo: '/Scotiabank_logo.svg' },
                { name: 'Nubank', logo: '/Nubank_logo_2021.svg' },
              ].map((b) => (
                <div key={b.name} className="flex items-center gap-2 bg-slate-50 rounded-xl px-3 py-3 justify-center">
                  <img src={b.logo} alt={b.name} className="h-6 w-auto object-contain max-w-[90px]" />
                </div>
              ))}
            </div>
            <p className="text-sm text-slate-500 text-center">
              + todos los bancos colombianos habilitados para transferencias
            </p>
          </div>
        </div>
      </section>

      {/* Cómo funciona */}
      <section className="py-16 px-6">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-3xl font-bold text-slate-900 text-center mb-12">El proceso de verificación</h2>
          <div className="space-y-6">
            {HOW_IT_WORKS.map((item, i) => (
              <div key={i} className="flex gap-5">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-lg font-black shrink-0 ${
                  i === 0 ? 'bg-emerald-600 text-white' : 'bg-emerald-50 text-emerald-700 border border-emerald-100'
                }`}>
                  {i + 1}
                </div>
                <div className="pt-1">
                  <h3 className="font-bold text-slate-900 mb-1">{item.title}</h3>
                  <p className="text-sm text-slate-500 leading-relaxed">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-16 px-6">
        <div className="max-w-xl mx-auto text-center rounded-3xl p-10"
          style={{ background: 'linear-gradient(135deg, #14532d 0%, #15803d 100%)' }}>
          <h3 className="text-2xl font-bold text-white mb-3">¿Tu banco no aparece?</h3>
          <p className="text-emerald-200 text-sm mb-6 leading-relaxed">
            Estamos integrando más bancos colombianos. Crea tu cuenta gratis y te notificamos cuando llegue tu banco.
          </p>
          <Link to="/registro"
            className="inline-block bg-white text-emerald-800 font-bold text-sm rounded-full px-10 py-3.5 hover:bg-emerald-50 transition-colors">
            Crear cuenta gratis →
          </Link>
        </div>
      </section>

      <Footer />
    </div>
  );
}
