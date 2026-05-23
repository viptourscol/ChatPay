import { useEffect, useState } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { supabase } from './lib/supabase.js';
import Landing from './pages/Landing.jsx';
import Login from './pages/Login.jsx';
import Register from './pages/Register.jsx';
import ComoActivar from './pages/ComoActivar.jsx';
import Planes from './pages/Planes.jsx';
import BancosCompatibles from './pages/BancosCompatibles.jsx';
import Layout from './components/Layout.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Verifications from './pages/Verifications.jsx';
import Employees from './pages/Employees.jsx';
import Reports from './pages/Reports.jsx';
import Ingresos from './pages/Ingresos.jsx';
import Egresos from './pages/Egresos.jsx';
import Settings from './pages/Settings.jsx';
import Admin from './pages/Admin.jsx';
import Subscription from './pages/Subscription.jsx';
import Locations from './pages/Locations.jsx';

const SUPER_ADMIN_EMAIL = 'pagosviptourscol@gmail.com';

export default function App() {
  const [session, setSession] = useState(undefined);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);

  if (session === undefined) {
    return <div className="grid h-screen place-items-center text-slate-500">Cargando…</div>;
  }

  if (!session) {
    return (
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/login" element={<Login />} />
        <Route path="/registro" element={<Register />} />
        <Route path="/como-activar" element={<ComoActivar />} />
        <Route path="/planes" element={<Planes />} />
        <Route path="/bancos-compatibles" element={<BancosCompatibles />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    );
  }

  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/verificaciones" element={<Verifications />} />
        <Route path="/empleados" element={<Employees />} />
        <Route path="/reportes" element={<Reports />} />
        <Route path="/ingresos" element={<Ingresos />} />
        <Route path="/egresos" element={<Egresos />} />
        <Route path="/sedes" element={<Locations />} />
        <Route path="/configuracion" element={<Settings />} />
        <Route path="/suscripcion" element={<Subscription />} />
        <Route
          path="/admin"
          element={
            session.user?.email?.toLowerCase() === SUPER_ADMIN_EMAIL
              ? <Admin />
              : <Navigate to="/dashboard" replace />
          }
        />
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Route>
    </Routes>
  );
}
