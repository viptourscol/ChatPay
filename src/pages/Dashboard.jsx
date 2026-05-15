import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api.js';

function Stat({ label, value, accent }) {
  return (
    <div className="card">
      <div className="text-sm text-slate-500">{label}</div>
      <div className={`text-3xl font-semibold mt-2 ${accent || 'text-slate-900'}`}>{value}</div>
    </div>
  );
}

export default function Dashboard() {
  const { data, isLoading } = useQuery({
    queryKey: ['stats'],
    queryFn: () => api('/api/stats')
  });

  return (
    <div>
      <header className="mb-6">
        <h1 className="font-serif text-3xl">Dashboard</h1>
        <p className="text-slate-500 text-sm">Resumen de actividad de verificaciones.</p>
      </header>

      {isLoading ? (
        <div className="text-slate-500">Cargando…</div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Stat label="Verificaciones hoy" value={data?.today ?? 0} accent="text-brand-600" />
            <Stat label="Esta semana" value={data?.week ?? 0} />
            <Stat label="Falsos / duplicados (7d)" value={data?.fakes ?? 0} accent="text-red-600" />
            <Stat label="Empleados activos" value={data?.activeEmployees ?? 0} />
          </div>

          <div className="card mt-6">
            <h2 className="font-semibold mb-4">Actividad últimos 7 días</h2>
            <div className="grid grid-cols-7 gap-2 items-end h-40">
              {(data?.daily || []).map((d) => {
                const total = d.real + d.fake + d.duplicate + d.other;
                const maxAll = Math.max(...(data.daily || []).map((x) => x.real + x.fake + x.duplicate + x.other), 1);
                const h = Math.round((total / maxAll) * 100);
                return (
                  <div key={d.date} className="flex flex-col items-center gap-1">
                    <div className="w-full bg-slate-100 rounded relative" style={{ height: '100%' }}>
                      <div
                        className="absolute bottom-0 left-0 right-0 bg-brand-500 rounded"
                        style={{ height: `${h}%` }}
                        title={`${total} verificaciones`}
                      />
                    </div>
                    <div className="text-[10px] text-slate-500">{d.date.slice(5)}</div>
                  </div>
                );
              })}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
