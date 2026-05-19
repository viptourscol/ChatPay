import { useState, useEffect } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase.js';
import {
  LayoutDashboard, ShieldCheck, TrendingUp, TrendingDown,
  Users, BarChart2, Settings, LogOut, Building2
} from 'lucide-react';

const MODULES = [
  { to: '/dashboard',     label: 'Dashboard',      Icon: LayoutDashboard },
  { to: '/verificaciones',label: 'Verificaciones',  Icon: ShieldCheck },
  { to: '/ingresos',      label: 'Ingresos',        Icon: TrendingUp },
  { to: '/egresos',       label: 'Egresos',         Icon: TrendingDown },
  { to: '/empleados',     label: 'Empleados',       Icon: Users },
  { to: '/reportes',      label: 'Reportes',        Icon: BarChart2 },
];

export default function Layout() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [company, setCompany] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUser(data?.user || null));
  }, []);

  useEffect(() => {
    if (!user) return;
    // Cargar nombre de empresa desde settings
    import('../lib/api.js').then(({ api }) =>
      api('/api/settings').then((s) => setCompany(s)).catch(() => {})
    );
  }, [user]);

  const logout = async () => {
    await supabase.auth.signOut();
    navigate('/login', { replace: true });
  };

  const initials = user?.email?.[0]?.toUpperCase() || '?';
  const companyName = company?.name || user?.email?.split('@')[0] || 'Mi empresa';

  return (
    <div className="min-h-screen flex bg-slate-50">
      {/* Sidebar */}
      <aside
        className={`${
          sidebarOpen ? 'w-64' : 'w-0 overflow-hidden'
        } shrink-0 bg-white border-r border-slate-200 flex flex-col transition-all duration-200`}
      >
        {/* Logo */}
        <div className="px-5 pt-5 pb-3">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-8 h-8 rounded-lg bg-brand-600 flex items-center justify-center text-white font-bold text-sm">C</div>
            <div>
              <div className="font-semibold text-slate-900 leading-none">ChatPay</div>
              <div className="text-[10px] text-slate-400">Verificación de pagos</div>
            </div>
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
            {MODULES.map((l) => (
              <NavLink
                key={l.to}
                to={l.to}
                end={l.to === '/dashboard'}
                className={({ isActive }) =>
                  `flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition ${
                    isActive
                      ? 'bg-brand-600 text-white shadow-sm'
                      : 'text-slate-600 hover:bg-slate-100'
                  }`
                }
              >
                <l.Icon size={16} className="shrink-0" />
                <span>{l.label}</span>
              </NavLink>
            ))}
          </div>

          {/* Configuración separada */}
          <div className="mt-3 space-y-0.5 border-t border-slate-100 pt-3">
            <NavLink
              to="/configuracion"
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition ${
                  isActive
                    ? 'bg-brand-600 text-white shadow-sm'
                    : 'text-slate-600 hover:bg-slate-100'
                }`
              }
            >
              <Settings size={16} className="shrink-0" />
              <span>Configuración</span>
            </NavLink>
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
        <header className="bg-white border-b border-slate-200 h-12 flex items-center px-4 gap-3 shrink-0">
          <button
            onClick={() => setSidebarOpen((v) => !v)}
            className="p-1.5 rounded hover:bg-slate-100 text-slate-500 transition"
            title="Toggle sidebar"
          >
            ☰
          </button>
          <div className="flex-1" />
          <div className="w-7 h-7 rounded-full bg-brand-600 flex items-center justify-center text-white text-xs font-bold">
            {initials}
          </div>
        </header>

        <main className="flex-1 p-8 overflow-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
