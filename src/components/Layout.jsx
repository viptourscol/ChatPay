import { useState, useEffect } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase.js';
import { PaymentRequiredError } from '../lib/api.js';
import PaymentWall from './PaymentWall.jsx';
import { useSubscription } from '../hooks/useSubscription.js';
import {
  LayoutDashboard, ShieldCheck, TrendingUp, TrendingDown,
  Users, BarChart2, Settings, LogOut, Building2, ShieldAlert, CreditCard, Lock
} from 'lucide-react';

// Email del super admin — debe coincidir con ADMIN_EMAILS en el backend
const SUPER_ADMIN_EMAIL = 'pagosviptourscol@gmail.com';

const MODULES = [
  { to: '/dashboard',     label: 'Dashboard',      Icon: LayoutDashboard },
  { to: '/verificaciones',label: 'Verificaciones',  Icon: ShieldCheck },
  { to: '/ingresos',      label: 'Ingresos',        Icon: TrendingUp },
  { to: '/egresos',       label: 'Egresos',         Icon: TrendingDown,  feature: 'egresos_gmail' },
  { to: '/empleados',     label: 'Empleados',       Icon: Users },
  { to: '/reportes',      label: 'Reportes',        Icon: BarChart2 },
];

export default function Layout() {
  const navigate = useNavigate();
  const [user,        setUser]        = useState(null);
  const [company,     setCompany]     = useState(null);
  // En móvil el sidebar empieza cerrado; en desktop abierto
  const [sidebarOpen, setSidebarOpen] = useState(() => window.innerWidth >= 768);
  const [suspended,   setSuspended]   = useState(null); // { company } si cuenta suspendida

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUser(data?.user || null));
  }, []);

  useEffect(() => {
    if (!user) return;
    import('../lib/api.js').then(({ api }) =>
      api('/api/settings')
        .then((s) => setCompany(s))
        .catch((err) => {
          if (err instanceof PaymentRequiredError) {
            setSuspended({ company: err.company });
          }
        })
    );
  }, [user]);

  // También interceptar errores 402 globalmente via evento personalizado
  useEffect(() => {
    function onPaymentRequired(e) { setSuspended({ company: e.detail?.company || null }); }
    window.addEventListener('chatpay:payment_required', onPaymentRequired);
    return () => window.removeEventListener('chatpay:payment_required', onPaymentRequired);
  }, []);

  if (suspended) {
    const handleSignOut = async () => { await supabase.auth.signOut(); navigate('/login', { replace: true }); };
    return <PaymentWall companyInfo={suspended.company} onSignOut={handleSignOut} />;
  }

  const logout = async () => {
    await supabase.auth.signOut();
    navigate('/login', { replace: true });
  };

  const initials = user?.email?.[0]?.toUpperCase() || '?';
  const companyName = company?.name || user?.email?.split('@')[0] || 'Mi empresa';
  const { can } = useSubscription();

  return (
    <div className="min-h-screen flex bg-slate-50">
      {/* Backdrop móvil — cierra el sidebar al tocar fuera */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/40 z-20 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        } fixed md:relative md:translate-x-0 z-50 md:z-auto
          w-64 h-full md:h-auto shrink-0 bg-white border-r border-slate-200
          flex flex-col transition-transform duration-300 animate-fade-in`}
      >
        {/* Logo */}
        <div className="px-5 pt-5 pb-3">
          <div className="flex items-center gap-2 mb-4">
            <img src="/logo.svg" alt="ChatPay Bot" className="h-8 w-auto" />
          </div>

          {/* Empresa selector */}
          <div className="rounded-lg border border-slate-200 px-3 py-2 mb-3">
            <div className="text-[10px] text-slate-400 uppercase tracking-wider mb-0.5 flex items-center gap-1"><Building2 size={10} /> Empresa</div>
            <div className="text-sm font-medium text-slate-800 truncate">{companyName}</div>
          </div>

          {/* Navegando como */}
          <div className="rounded-lg bg-slate-50 border border-slate-100 px-3 py-2 text-xs text-slate-500">
            <div className="font-medium text-slate-600 mb-0.5">Navegando como:</div>
            <div className="truncate">{user?.email || '—'}</div>
            <div className="font-mono text-[10px] text-slate-400 truncate mt-0.5">{user?.id?.slice(0, 20) || ''}…</div>
          </div>
        </div>

        {/* Módulos */}
        <nav className="flex-1 px-3 pb-3">
          <div className="text-[10px] uppercase tracking-widest text-slate-400 px-2 mb-2 mt-3">Módulos</div>
          <div className="space-y-0.5">
            {MODULES.map((l) => {
              const locked = l.feature && !can(l.feature);
              return (
              <NavLink
                key={l.to}
                to={l.to}
                end={l.to === '/dashboard'}
                onClick={() => window.innerWidth < 768 && setSidebarOpen(false)}
                className={({ isActive }) =>
                  `flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-150 active:scale-[0.97] ${
                    isActive
                      ? 'bg-brand-600 text-white shadow-sm'
                      : locked
                        ? 'text-slate-400 hover:bg-slate-50'
                        : 'text-slate-600 hover:bg-slate-100 hover:translate-x-0.5'
                  }`
                }
              >
                <l.Icon size={16} className="shrink-0" />
                <span className="flex-1">{l.label}</span>
                {locked && <Lock size={12} className="shrink-0 text-slate-300" />}
              </NavLink>
              );
            })}
          </div>

          {/* Configuración separada */}
          <div className="mt-3 space-y-0.5 border-t border-slate-100 pt-3">
            <NavLink
              to="/suscripcion"
              onClick={() => window.innerWidth < 768 && setSidebarOpen(false)}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-150 active:scale-[0.97] ${
                  isActive
                    ? 'bg-brand-600 text-white shadow-sm'
                    : 'text-slate-600 hover:bg-slate-100 hover:translate-x-0.5'
                }`
              }
            >
              <CreditCard size={16} className="shrink-0" />
              <span>Suscripción</span>
            </NavLink>
            <NavLink
              to="/configuracion"
              onClick={() => window.innerWidth < 768 && setSidebarOpen(false)}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-150 active:scale-[0.97] ${
                  isActive
                    ? 'bg-brand-600 text-white shadow-sm'
                    : 'text-slate-600 hover:bg-slate-100 hover:translate-x-0.5'
                }`
              }
            >
              <Settings size={16} className="shrink-0" />
              <span>Configuración</span>
            </NavLink>

            {/* Link de Super Admin — solo visible para el admin */}
            {user?.email?.toLowerCase() === SUPER_ADMIN_EMAIL && (
              <NavLink
                to="/admin"
                onClick={() => window.innerWidth < 768 && setSidebarOpen(false)}
                className={({ isActive }) =>
                  `flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition ${
                    isActive
                      ? 'bg-rose-600 text-white shadow-sm'
                      : 'text-rose-600 hover:bg-rose-50'
                  }`
                }
              >
                <ShieldAlert size={16} className="shrink-0" />
                <span>Super Admin</span>
              </NavLink>
            )}
          </div>
        </nav>

        {/* Cerrar sesión + user */}
        <div className="p-3 border-t border-slate-100">
          <button
            onClick={logout}
            className="flex items-center gap-2 w-full rounded-lg px-3 py-2 text-sm text-slate-500 hover:bg-slate-100 transition"
          >
            <LogOut size={15} />
            <span>Cerrar Sesión</span>
          </button>
          <div className="flex items-center gap-2 px-3 py-2 mt-1">
            <div className="w-7 h-7 rounded-full bg-brand-600 flex items-center justify-center text-white text-xs font-bold shrink-0">
              {initials}
            </div>
            <div className="min-w-0">
              <div className="text-xs font-medium text-slate-700 truncate">{user?.email?.split('@')[0] || '—'}</div>
              <div className="text-[10px] text-slate-400 truncate">{user?.email || ''}</div>
            </div>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top bar */}
        <header className="
          md:relative md:bg-white md:border-b md:border-slate-200 md:backdrop-filter-none md:shadow-none
          fixed top-0 left-0 right-0 z-40
          md:static
          h-12 flex items-center px-4 gap-3 shrink-0
          bg-white/60 backdrop-blur-xl backdrop-saturate-150
          border-b border-white/40
          shadow-sm shadow-black/5
        ">
          <button
            onClick={() => setSidebarOpen((v) => !v)}
            className="p-1.5 rounded hover:bg-slate-100 text-slate-500 transition"
            title="Toggle sidebar"
          >
            ☰
          </button>
          {/* Nombre empresa visible en móvil cuando sidebar está cerrado */}
          <span className="text-sm font-semibold text-slate-700 truncate md:hidden">{companyName}</span>
          <div className="flex-1" />
          <div className="w-7 h-7 rounded-full bg-brand-600 flex items-center justify-center text-white text-xs font-bold">
            {initials}
          </div>
        </header>

        <main className="flex-1 p-4 pt-16 md:pt-4 md:p-8 overflow-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
