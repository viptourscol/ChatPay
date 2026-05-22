import { useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase.js';

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
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center px-4 py-10">
      {/* Contenedor principal estilo Wompi */}
      <div className="w-full max-w-4xl flex flex-col lg:flex-row items-center gap-10">

        {/* Banner izquierda — tarjeta contenida */}
        <div className="hidden lg:block flex-shrink-0 w-80 xl:w-96">
          <img
            src="/banner-chatpay.png"
            alt="ChatPay – verifica pagos automáticamente por WhatsApp"
            className="w-full rounded-3xl shadow-xl object-cover"
          />
        </div>

        {/* Formulario derecha */}
        <div className="w-full max-w-sm">
          {/* Logo */}
          <div className="mb-1">
            <Link to="/">
              <img src="/logo.svg" alt="ChatPay" className="h-10 w-auto" />
            </Link>
          </div>

          <div className="mb-7 mt-5">
            <h1 className="text-2xl font-bold text-slate-900">¡Bienvenido de vuelta!</h1>
          </div>

          <form onSubmit={submit} className="space-y-4">
            <div>
              <label className="label">Correo electrónico</label>
              <input className="input" type="email" required placeholder="tu@empresa.com" value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <div>
              <label className="label">Contraseña</label>
              <input className="input" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} />
            </div>
            {error && <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-600">{error}</div>}
            <button className="btn btn-primary w-full py-3 rounded-full" disabled={loading}>
              {loading ? 'Entrando…' : 'Inicia sesión →'}
            </button>
          </form>

          <div className="mt-5 flex items-center gap-3">
            <span className="text-sm text-slate-500">¿No tienes una cuenta?</span>
            <Link to="/registro" className="text-sm border border-slate-300 rounded-full px-4 py-1.5 font-medium text-slate-700 hover:border-brand-500 hover:text-brand-600 transition-colors">
              Regístrate aquí
            </Link>
          </div>
          <p className="text-xs text-slate-400 mt-4">
            <Link to="/" className="hover:underline">← Volver al inicio</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
