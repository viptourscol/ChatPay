import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase.js';
import { api } from '../lib/api.js';
import { CheckCircle2 } from 'lucide-react';

export default function Register() {
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: '', password: '', confirm: '', name: '', company: '', phone: '' });
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
    if (!form.phone.trim()) return setError('El número de celular es requerido.');
    setLoading(true);
    const { error: signUpError } = await supabase.auth.signUp({
      email: form.email,
      password: form.password,
      options: { data: { full_name: form.name, company_name: form.company.trim(), phone: form.phone.trim() } }
    });
    setLoading(false);
    if (signUpError) return setError(signUpError.message);
    setSuccess(true);
  };

  const inputCls = "w-full border border-slate-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 transition";

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4"
        style={{ background: 'linear-gradient(160deg, #14532d 0%, #166534 50%, #15803d 100%)' }}>
        <div className="w-full max-w-md bg-white rounded-3xl p-10 text-center shadow-2xl">
          <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-5">
            <CheckCircle2 size={36} className="text-emerald-600" />
          </div>
          <h2 className="text-2xl font-bold text-slate-900 mb-2">¡Cuenta creada!</h2>
          <p className="text-slate-500 text-sm mb-6">
            Revisa tu correo <strong>{form.email}</strong> y confirma tu cuenta. Luego podrás iniciar sesión.
          </p>
          <Link to="/login"
            className="block w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm rounded-full py-3.5 transition-colors text-center">
            Ir al login →
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-10 relative overflow-hidden"
      style={{ background: 'linear-gradient(160deg, #14532d 0%, #166534 55%, #15803d 100%)' }}>
      {/* Formas decorativas */}
      <div className="absolute -top-32 -left-32 w-96 h-96 rounded-full opacity-10" style={{ background: 'radial-gradient(circle, #4ade80, transparent)' }} />
      <div className="absolute -bottom-24 -right-24 w-80 h-80 rounded-full opacity-10" style={{ background: 'radial-gradient(circle, #86efac, transparent)' }} />

      {/* Contenedor principal */}
      <div className="relative w-full max-w-5xl flex flex-col lg:flex-row items-center gap-12 lg:gap-20">

        {/* Columna izquierda — claims sobre el fondo verde */}
        <div className="hidden lg:flex flex-col flex-1 px-4 animate-slide-left" style={{ animationDelay: '0ms' }}>
          <Link to="/" className="mb-12 block">
            <img src="/logo.svg" alt="ChatPay" className="h-9 w-auto brightness-0 invert" />
          </Link>
          <h2 className="text-4xl xl:text-5xl font-bold text-white leading-tight mb-8">
            Empieza a verificar<br />pagos hoy,
            <span className="text-emerald-300"> gratis</span>
          </h2>
          <div className="space-y-5">
            {[
              'Configuración en menos de 5 minutos',
              'Sin tarjeta de crédito requerida',
              'Tus empleados verifican pagos por WhatsApp',
              'Conectado a Bancolombia en tiempo real',
            ].map((text, i) => (
              <div key={text} className="flex items-center gap-3 animate-fade-up" style={{ animationDelay: `${300 + i * 80}ms` }}>
                <span className="w-6 h-6 rounded-full bg-white/20 text-white text-xs flex items-center justify-center flex-shrink-0 font-bold">✓</span>
                <p className="text-emerald-100 text-base">{text}</p>
              </div>
            ))}
          </div>
          <p className="mt-12 text-emerald-400 text-xs">© {new Date().getFullYear()} ChatPay · VipToursCol</p>
        </div>

        {/* Columna derecha — tarjeta blanca flotante */}
        <div className="w-full max-w-sm lg:max-w-md flex-shrink-0 animate-slide-right" style={{ animationDelay: '80ms' }}>
          {/* Logo mobile */}
          <div className="lg:hidden mb-8 text-center">
            <Link to="/"><img src="/logo.svg" alt="ChatPay" className="h-9 w-auto brightness-0 invert mx-auto" /></Link>
          </div>

          <div className="bg-white rounded-3xl shadow-2xl px-8 py-10 animate-zoom-in" style={{ animationDelay: '160ms' }}>
            <div className="mb-6">
              <h1 className="text-2xl font-bold text-slate-900 mb-1">Crear cuenta gratis</h1>
              <p className="text-slate-500 text-sm">Empieza a verificar pagos por WhatsApp hoy</p>
            </div>

            <form onSubmit={submit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Nombre completo</label>
                <input className={inputCls} type="text" required placeholder="Juan Pérez" value={form.name} onChange={change('name')} />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Nombre de tu empresa</label>
                <input className={inputCls} type="text" required placeholder="Mi Negocio S.A.S." value={form.company} onChange={change('company')} />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Celular / WhatsApp</label>
                <input className={inputCls} type="tel" required placeholder="3001234567" value={form.phone} onChange={change('phone')} />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Correo electrónico</label>
                <input className={inputCls} type="email" required placeholder="tu@correo.com" value={form.email} onChange={change('email')} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">Contraseña</label>
                  <input className={inputCls} type="password" required minLength={8} placeholder="Mín. 8 caracteres" value={form.password} onChange={change('password')} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">Confirmar</label>
                  <input className={inputCls} type="password" required placeholder="Repetir" value={form.confirm} onChange={change('confirm')} />
                </div>
              </div>
              {error && (
                <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-600">{error}</div>
              )}
              <button
                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm rounded-full py-3.5 transition-colors shadow-sm disabled:opacity-60"
                disabled={loading}>
                {loading ? 'Creando cuenta…' : 'Crear cuenta gratis →'}
              </button>
            </form>

            <div className="mt-6 pt-6 border-t border-slate-100 text-center">
              <p className="text-sm text-slate-500">
                ¿Ya tienes cuenta?{' '}
                <Link to="/login" className="text-emerald-600 font-semibold hover:underline">Iniciar sesión</Link>
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
