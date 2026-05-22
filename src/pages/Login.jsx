import { useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase.js';


function LoginBanner() {
  return (
    <div className="hidden lg:block min-h-screen">
      <img
        src="/banner-chatpay.png"
        alt="ChatPay – verifica pagos automáticamente por WhatsApp"
        className="w-full h-full object-cover object-center"
      />
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
