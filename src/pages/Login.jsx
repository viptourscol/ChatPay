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
    <div className="min-h-screen grid place-items-center px-4 bg-gradient-to-b from-brand-50 to-white">
      <div className="w-full max-w-md card">
        <div className="text-center mb-6">
          <Link to="/" className="inline-block">
            <img src="/logo.svg" alt="ChatPay Bot" className="h-16 w-auto mx-auto" />
          </Link>
          <p className="text-slate-500 text-sm mt-2">Verificación de pagos por WhatsApp</p>
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
          <button className="btn btn-primary w-full" disabled={loading}>
            {loading ? 'Entrando…' : 'Ingresar'}
          </button>
        </form>
        <p className="mt-4 text-center text-sm text-slate-500">
          ¿No tienes cuenta?{' '}
          <Link to="/registro" className="text-brand-600 hover:underline">Crear cuenta gratis</Link>
        </p>
        <p className="text-center text-xs text-slate-400 mt-2">
          <Link to="/" className="hover:underline">← Volver al inicio</Link>
        </p>
      </div>
    </div>
  );
}
