import { useEffect, useState } from 'react';\nimport { Routes, Route, Navigate } from 'react-router-dom';\nimport { supabase } from './lib/supabase.js';\nimport Landing from './pages/Landing.jsx';\nimport Login from './pages/Login.jsx';\nimport Register from './pages/Register.jsx';\nimport Layout from './components/Layout.jsx';\nimport Dashboard from './pages/Dashboard.jsx';\nimport Verifications from './pages/Verifications.jsx';\nimport Employees from './pages/Employees.jsx';\nimport Reports from './pages/Reports.jsx';\nimport Ingresos from './pages/Ingresos.jsx';\nimport Egresos from './pages/Egresos.jsx';\nimport Settings from './pages/Settings.jsx';\nimport Admin from './pages/Admin.jsx';\n\nconst SUPER_ADMIN_EMAIL = 'pagosviptourscol@gmail.com';

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
        <Route path="/configuracion" element={<Settings />} />
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
