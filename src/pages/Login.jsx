import { useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase.js';

const WhatsAppIcon = () => (
  <svg viewBox="0 0 24 24" className="w-5 h-5 fill-[#25D366]" xmlns="http://www.w3.org/2000/svg">
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
  </svg>
);

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const submit = async (e) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) setError(error.message);
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-10 relative overflow-hidden"
      style={{ background: 'linear-gradient(160deg, #14532d 0%, #166534 55%, #15803d 100%)' }}>
      {/* Formas decorativas de fondo */}
      <div className="absolute -top-32 -left-32 w-96 h-96 rounded-full opacity-10" style={{ background: 'radial-gradient(circle, #4ade80, transparent)' }} />
      <div className="absolute -bottom-24 -right-24 w-80 h-80 rounded-full opacity-10" style={{ background: 'radial-gradient(circle, #86efac, transparent)' }} />
      <div className="absolute top-1/2 left-1/4 w-64 h-64 rounded-full opacity-5" style={{ background: 'radial-gradient(circle, #d1fae5, transparent)' }} />

      {/* Contenedor principal */}
      <div className="relative w-full max-w-5xl flex flex-col lg:flex-row items-center gap-12 lg:gap-20">

        {/* Columna izquierda — claims (sobre el fondo verde, sin caja) */}
        <div className="hidden lg:flex flex-col flex-1 px-4 animate-slide-left" style={{ animationDelay: '0ms' }}>
          <Link to="/" className="mb-12 block">
            <img src="/logo.svg" alt="ChatPay" className="h-9 w-auto brightness-0 invert" />
          </Link>
          <h2 className="text-4xl xl:text-5xl font-bold text-white leading-tight mb-8">
            Verifica pagos<br />en segundos<br />
            <span className="text-emerald-300">por WhatsApp</span>
          </h2>
          <div className="space-y-5">
            {[
              'Detecta comprobantes falsos automáticamente',
              'Tus empleados verifican sin acceso al banco',
              'Conectado a Bancolombia en tiempo real',
            ].map((text, i) => (
              <div key={text} className="flex items-center gap-3 animate-fade-up" style={{ animationDelay: `${300 + i * 80}ms` }}>
                <span className="w-6 h-6 rounded-full bg-white/20 text-white text-xs flex items-center justify-center flex-shrink-0 font-bold">✓</span>
                <p className="text-emerald-100 text-base">{text}</p>
              </div>
            ))}
          </div>
          <div className="mt-12 flex items-center gap-2">
            <WhatsAppIcon />
            <span className="text-emerald-300 text-sm font-medium">100% por WhatsApp · Sin apps extra</span>
          </div>
        </div>

        {/* Columna derecha — tarjeta blanca flotante */}
        <div className="w-full max-w-sm lg:max-w-md flex-shrink-0 animate-slide-right" style={{ animationDelay: '80ms' }}>
          {/* Logo mobile */}
          <div className="lg:hidden mb-8 text-center">
            <Link to="/"><img src="/logo.svg" alt="ChatPay" className="h-9 w-auto brightness-0 invert mx-auto" /></Link>
          </div>

          <div className="bg-white rounded-3xl shadow-2xl px-8 py-10 animate-zoom-in" style={{ animationDelay: '160ms' }}>
            <div className="mb-7">
              <h1 className="text-2xl font-bold text-slate-900 mb-1">¡Bienvenido de vuelta!</h1>
              <p className="text-slate-500 text-sm">Ingresa a tu cuenta de ChatPay</p>
            </div>

            <form onSubmit={submit} className="space-y-5">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Correo electrónico</label>
                <input
                  className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 transition bg-slate-50"
                  type="email" required placeholder="tu@empresa.com"
                  value={email} onChange={(e) => setEmail(e.target.value)} />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Contraseña</label>
                <input
                  className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 transition bg-slate-50"
                  type="password" required
                  value={password} onChange={(e) => setPassword(e.target.value)} />
              </div>
              {error && (
                <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-600">{error}</div>
              )}
              <button
                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm rounded-full py-3.5 transition-colors shadow-sm disabled:opacity-60"
                disabled={loading}>
                {loading ? 'Entrando…' : 'Iniciar sesión →'}
              </button>
            </form>

            <div className="mt-6 pt-6 border-t border-slate-100 text-center">
              <p className="text-sm text-slate-500">
                ¿No tienes cuenta?{' '}
                <Link to="/registro" className="text-emerald-600 font-semibold hover:underline">Regístrate gratis</Link>
              </p>
            </div>
            <p className="text-xs text-slate-400 mt-3 text-center">
              <Link to="/" className="hover:underline">← Volver al inicio</Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
