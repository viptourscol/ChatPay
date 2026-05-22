import { useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase.js';
import { Smartphone } from 'lucide-react';

function LoginBanner() {
  return (
    <div className="hidden lg:flex flex-col justify-between min-h-screen px-12 py-12"
      style={{ background: 'linear-gradient(160deg, #bbf7d0 0%, #86efac 40%, #4ade80 100%)' }}>

      {/* Logo top */}
      <Link to="/">
        <img src="/logo.svg" alt="ChatPay" className="h-10 w-auto" />
      </Link>

      {/* Tarjeta mock */}
      <div className="flex-1 flex flex-col justify-center max-w-sm mx-auto w-full">
        <div className="bg-white rounded-3xl shadow-xl px-6 py-5 mb-10">
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-emerald-500 flex items-center justify-center shadow-sm">
                <Smartphone size={16} className="text-white" />
              </div>
              <div>
                <p className="font-semibold text-sm text-slate-800 leading-none">ChatPay Bot</p>
                <p className="text-xs text-slate-400 mt-0.5">Verificación por WhatsApp</p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-xs text-emerald-600 font-semibold flex items-center gap-1 justify-end">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block animate-pulse" />
                En línea
              </p>
              <p className="text-xs text-slate-400 mt-0.5">Configurar &rsaquo;</p>
            </div>
          </div>
          <div className="border-t border-slate-100 pt-4 flex items-center justify-between">
            <div>
              <p className="text-2xl font-bold text-slate-900">✓ $850.000</p>
              <p className="text-xs text-slate-400 mt-0.5">Verificado · hace 2 seg</p>
            </div>
            <button className="bg-emerald-600 text-white text-xs font-semibold rounded-xl px-4 py-2.5 shadow">
              Ver pago
            </button>
          </div>
        </div>

        {/* Texto principal */}
        <div className="mb-8">
          <p className="text-3xl text-slate-700 font-normal leading-snug">Ahora con ChatPay</p>
          <p className="text-3xl text-slate-700 font-normal leading-snug">podrás verificar pagos</p>
          <p className="text-4xl text-slate-900 font-bold leading-snug">desde WhatsApp<br />en segundos</p>
        </div>

        {/* Caja descriptiva */}
        <div className="bg-white/60 border border-emerald-200 rounded-2xl px-5 py-4">
          <p className="text-sm text-slate-700 leading-relaxed">
            Tú decides quién puede verificar. Tus empleados envían el comprobante y ChatPay responde al instante si es <strong>real, falso o duplicado</strong>.
          </p>
        </div>
      </div>

      {/* Wordmark bottom */}
      <p className="text-center text-emerald-800 font-bold text-xl tracking-tight">ChatPay</p>
    </div>
  );
}

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
    <div className="min-h-screen lg:grid lg:grid-cols-2">
      <LoginBanner />

      {/* Formulario */}
      <div className="min-h-screen flex items-center justify-center px-6 bg-gradient-to-b from-brand-50 to-white lg:bg-white">
        <div className="w-full max-w-md">
          {/* Logo solo visible en móvil */}
          <div className="text-center mb-8 lg:hidden">
            <Link to="/">
              <img src="/logo.svg" alt="ChatPay Bot" className="h-14 w-auto mx-auto" />
            </Link>
          </div>

          <div className="mb-8">
            <h1 className="text-2xl font-bold text-slate-900">Ingresar a ChatPay</h1>
            <p className="text-slate-500 text-sm mt-1">Verificación de pagos por WhatsApp</p>
          </div>

          <form onSubmit={submit} className="space-y-4">
            <div>
              <label className="label">Correo</label>
              <input className="input" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <div>
              <label className="label">Contraseña</label>
              <input className="input" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} />
            </div>
            {error && <div className="text-sm text-red-600">{error}</div>}
            <button className="btn btn-primary w-full py-3" disabled={loading}>
              {loading ? 'Entrando…' : 'Ingresar'}
            </button>
          </form>
          <p className="mt-5 text-center text-sm text-slate-500">
            ¿No tienes cuenta?{' '}
            <Link to="/registro" className="text-brand-600 hover:underline font-medium">Crear cuenta gratis</Link>
          </p>
          <p className="text-center text-xs text-slate-400 mt-2">
            <Link to="/" className="hover:underline">← Volver al inicio</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
