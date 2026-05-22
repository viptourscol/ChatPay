import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase.js';
import { api } from '../lib/api.js';
import { CheckCircle2 } from 'lucide-react';

function RegisterBanner() {
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

export default function Register() {
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: '', password: '', confirm: '', name: '', company: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);

  const change = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    setError(null);
    if (form.password.length < 8) return setError('La contraseña debe tener mínimo 8 caracteres.');
    if (form.password !== form.confirm) return setError('Las contraseñas no coinciden.');
    if (!form.company.trim()) return setError('El nombre de la empresa es requerido.');
    setLoading(true);
    const { error: signUpError } = await supabase.auth.signUp({
      email: form.email,
      password: form.password,
      options: { data: { full_name: form.name, company_name: form.company.trim() } }
    });
    setLoading(false);
    if (signUpError) return setError(signUpError.message);
    setSuccess(true);
  };

  if (success) {
    return (
      <div className="min-h-screen grid place-items-center px-4 bg-gradient-to-b from-brand-50 to-white">
        <div className="w-full max-w-md card text-center">
          <div className="flex justify-center mb-4"><CheckCircle2 size={52} className="text-emerald-500" /></div>
          <h2 className="font-serif text-2xl mb-2">¡Cuenta creada!</h2>
          <p className="text-slate-500 text-sm mb-6">
            Revisa tu correo <strong>{form.email}</strong> y confirma tu cuenta. Luego podrás iniciar sesión.
          </p>
          <Link to="/login" className="btn btn-primary w-full">Ir al login</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-2">
      <RegisterBanner />
      <div className="min-h-screen flex items-center justify-center px-6 bg-gradient-to-b from-brand-50 to-white lg:bg-white py-12">
        <div className="w-full max-w-md">
          <div className="text-center mb-6 lg:hidden">
            <Link to="/"><img src="/logo.svg" alt="ChatPay Bot" className="h-14 w-auto mx-auto" /></Link>
          </div>
          <div className="mb-8">
            <h1 className="text-2xl font-bold text-slate-900">Crear cuenta gratis</h1>
            <p className="text-slate-500 text-sm mt-1">Empieza a verificar pagos por WhatsApp hoy</p>
          </div>
          <form onSubmit={submit} className="space-y-4">
            <div>
              <label className="label">Nombre completo</label>
              <input className="input" type="text" required placeholder="Juan Pérez" value={form.name} onChange={change('name')} />
            </div>
            <div>
              <label className="label">Nombre de tu empresa</label>
              <input className="input" type="text" required placeholder="Mi Negocio S.A.S." value={form.company} onChange={change('company')} />
            </div>
            <div>
              <label className="label">Correo electrónico</label>
              <input className="input" type="email" required placeholder="tu@correo.com" value={form.email} onChange={change('email')} />
            </div>
            <div>
              <label className="label">Contraseña</label>
              <input className="input" type="password" required minLength={8} placeholder="Mínimo 8 caracteres" value={form.password} onChange={change('password')} />
            </div>
            <div>
              <label className="label">Confirmar contraseña</label>
              <input className="input" type="password" required placeholder="Repite la contraseña" value={form.confirm} onChange={change('confirm')} />
            </div>
            {error && (
              <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-600">{error}</div>
            )}
            <button className="btn btn-primary w-full py-3" disabled={loading}>
              {loading ? 'Creando cuenta…' : 'Crear cuenta'}
            </button>
          </form>
          <p className="mt-5 text-center text-sm text-slate-500">
            ¿Ya tienes cuenta?{' '}
            <Link to="/login" className="text-brand-600 hover:underline font-medium">Ingresar</Link>
          </p>
          <p className="text-center text-xs text-slate-400 mt-2">
            <Link to="/" className="hover:underline">← Volver al inicio</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
