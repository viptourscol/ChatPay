import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase.js';
import { api } from '../lib/api.js';
import { CheckCircle2, Smartphone } from 'lucide-react';

function RegisterBanner() {
  return (
    <div className="hidden lg:flex flex-col justify-between min-h-screen px-12 py-12"
      style={{ background: 'linear-gradient(160deg, #bbf7d0 0%, #86efac 40%, #4ade80 100%)' }}>
      <Link to="/">
        <img src="/logo.svg" alt="ChatPay" className="h-10 w-auto" />
      </Link>
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
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block animate-pulse" /> En línea
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
        <div className="mb-8">
          <p className="text-3xl text-slate-700 font-normal leading-snug">Crea tu cuenta gratis</p>
          <p className="text-3xl text-slate-700 font-normal leading-snug">y empieza a verificar</p>
          <p className="text-4xl text-slate-900 font-bold leading-snug">pagos por WhatsApp<br />hoy mismo</p>
        </div>
        <div className="bg-white/60 border border-emerald-200 rounded-2xl px-5 py-4">
          <p className="text-sm text-slate-700 leading-relaxed">
            Sin instalaciones. Sin contratos. Solo conecta tu correo de Bancolombia y en minutos tus empleados verifican pagos al instante.
          </p>
        </div>
      </div>
      <p className="text-center text-emerald-800 font-bold text-xl tracking-tight">ChatPay</p>
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

    if (form.password.length < 8) {
      return setError('La contraseña debe tener mínimo 8 caracteres.');
    }
    if (form.password !== form.confirm) {
      return setError('Las contraseñas no coinciden.');
    }
    if (!form.company.trim()) {
      return setError('El nombre de la empresa es requerido.');
    }

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
    <div className="min-h-screen grid place-items-center px-4 bg-gradient-to-b from-brand-50 to-white">
      <div className="w-full max-w-md">
        <div className="text-center mb-6">
          <Link to="/" className="inline-block">
            <img src="/logo.svg" alt="ChatPay Bot" className="h-16 w-auto mx-auto" />
          </Link>
          <p className="text-slate-500 text-sm mt-1">Crea tu cuenta gratis</p>
        </div>

        <div className="card">
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
              <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-600">
                {error}
              </div>
            )}

            <button className="btn btn-primary w-full" disabled={loading}>
              {loading ? 'Creando cuenta…' : 'Crear cuenta'}
            </button>
          </form>

          <p className="mt-4 text-center text-sm text-slate-500">
            ¿Ya tienes cuenta?{' '}
            <Link to="/login" className="text-brand-600 hover:underline">Ingresar</Link>
          </p>
        </div>

        <p className="text-center text-xs text-slate-400 mt-4">
          <Link to="/" className="hover:underline">← Volver al inicio</Link>
        </p>
      </div>
    </div>
  );
}
