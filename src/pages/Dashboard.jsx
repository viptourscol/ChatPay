import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api.js';
import {
  ShieldCheck, AlertTriangle, Users, TrendingUp,
  Clock, DollarSign, CheckCircle2, XCircle, AlertCircle
} from 'lucide-react';

function fmtMoney(n) {
  if (!n && n !== 0) return '—';
  return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(n);
}
function fmtTime(s) {
  if (!s) return '—';
  return new Date(s).toLocaleString('es-CO', {
    timeZone: 'America/Bogota',
    day: '2-digit', month: 'short',
    hour: '2-digit', minute: '2-digit'
  });
}
function initials(name) {
  if (!name) return '?';
  return name.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase();
}

const STATUS_ICON = {
  real:      { Icon: CheckCircle2,  cls: 'text-emerald-500' },
  fake:      { Icon: XCircle,       cls: 'text-red-500' },
  duplicate: { Icon: AlertTriangle, cls: 'text-amber-500' },
  error:     { Icon: AlertCircle,   cls: 'text-slate-400' },
  pending:   { Icon: Clock,         cls: 'text-slate-400' },
};

function KpiCard({ Icon, label, value, sub, accent, bg, delay = 'delay-0' }) {
  return (
    <div className={`card flex items-center gap-4 py-4 animate-fade-up ${delay} hover:shadow-md transition-shadow duration-200`}>
      <div className={`w-11 h-11 rounded-xl grid place-items-center shrink-0 transition-transform duration-200 hover:scale-110 ${bg || 'bg-slate-100'}`}>
        <Icon size={22} className={accent || 'text-slate-500'} />
      </div>
      <div className="min-w-0">
        <div className="text-xs text-slate-400 mb-0.5 truncate">{label}</div>
        <div className={`text-2xl font-semibold leading-none animate-count-up ${delay} ${accent || 'text-slate-900'}`}>{value}</div>
        {sub && <div className="text-[11px] text-slate-400 mt-1">{sub}</div>}
      </div>
    </div>
  );
}

function BarChart({ daily = [] }) {
  const max = Math.max(...daily.map(d => d.real + d.fake + d.duplicate + d.other), 1);
  const days = ['Do', 'Lu', 'Ma', 'Mi', 'Ju', 'Vi', 'Sá'];

  return (
    <div className="card animate-fade-up delay-300">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h2 className="font-semibold text-slate-800">Actividad últimos 7 días</h2>
          <p className="text-xs text-slate-400 mt-0.5">Verificaciones por día</p>
        </div>
        <div className="flex items-center gap-4 text-xs text-slate-500">
          <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-emerald-400 inline-block" />Reales</span>
          <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-red-400 inline-block" />Falsos</span>
          <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-amber-400 inline-block" />Dup.</span>
        </div>
      </div>
      <div className="flex items-end gap-2 h-40">
        {daily.map((d) => {
          const total = d.real + d.fake + d.duplicate + d.other;
          const hReal = Math.round((d.real / max) * 100);
          const hFake = Math.round((d.fake / max) * 100);
          const hDup  = Math.round((d.duplicate / max) * 100);
          const dow = days[new Date(d.date + 'T12:00:00').getDay()];
          return (
            <div key={d.date} className="flex-1 flex flex-col items-center gap-1 group">
              <div className="text-[10px] text-slate-400 opacity-0 group-hover:opacity-100 transition">
                {total}
              </div>
              <div className="w-full flex flex-col justify-end gap-px rounded overflow-hidden" style={{ height: '120px', background: '#f1f5f9' }}>
                {hDup  > 0 && <div style={{ height: `${hDup}%`  }} className="bg-amber-400 w-full animate-bar-grow" />}
                {hFake > 0 && <div style={{ height: `${hFake}%` }} className="bg-red-400 w-full animate-bar-grow delay-75" />}
                {hReal > 0 && <div style={{ height: `${hReal}%` }} className="bg-emerald-400 w-full animate-bar-grow delay-150" />}
              </div>
              <div className="text-[10px] text-slate-500">{dow}</div>
              <div className="text-[9px] text-slate-300">{d.date.slice(5)}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function RecentActivity({ items = [] }) {
  return (
    <div className="card animate-fade-up delay-400">
      <h2 className="font-semibold text-slate-800 mb-4">Actividad reciente</h2>
      {items.length === 0 ? (
        <div className="text-center py-8 text-slate-400 text-sm">Sin actividad registrada aún</div>
      ) : (
        <div className="space-y-3">
          {items.map((v, _i) => {
            const cfg = STATUS_ICON[v.status] || STATUS_ICON.pending;
            return (
              <div key={v.id} className="flex items-center gap-3 animate-fade-up" style={{ animationDelay: `${_i * 60}ms` }}>
                <div className="w-8 h-8 rounded-full bg-brand-100 text-brand-700 text-xs font-bold grid place-items-center shrink-0">
                  {initials(v.employees?.name)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-slate-800 truncate">
                    {v.employees?.name || v.whatsapp_from || '—'}
                  </div>
                  <div className="text-xs text-slate-400">
                    {v.extracted_sender ? `De: ${v.extracted_sender} · ` : ''}{fmtTime(v.created_at)}
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <div className="text-sm font-semibold text-slate-900">{fmtMoney(v.extracted_amount)}</div>
                  <cfg.Icon size={14} className={`${cfg.cls} ml-auto`} />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function Dashboard() {
  const { data, isLoading } = useQuery({
    queryKey: ['stats'],
    queryFn: () => api('/api/stats'),
    refetchInterval: 60_000,
  });

  const weekReal = (data?.daily || []).reduce((s, d) => s + d.real, 0);
  const weekTotal = data?.week || 0;
  const accuracy = weekTotal > 0 ? Math.round((weekReal / weekTotal) * 100) : null;

  return (
    <div>
      <header className="mb-6 animate-fade-up">
        <h1 className="font-serif text-3xl">Dashboard</h1>
        <p className="text-slate-500 text-sm">Resumen de actividad en tiempo real.</p>
      </header>

      {isLoading ? (
        <div className="flex items-center gap-2 text-slate-400 py-10">
          <div className="w-5 h-5 border-2 border-brand-400 border-t-transparent rounded-full animate-spin" />
          Cargando métricas…
        </div>
      ) : (
        <div className="space-y-5">
          {/* KPIs */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <KpiCard
              Icon={ShieldCheck}
              label="Verificaciones hoy"
              value={data?.today ?? 0}
              sub="Comprobantes procesados"
              bg="bg-brand-50" accent="text-brand-600" delay="delay-0"
            />
            <KpiCard
              Icon={TrendingUp}
              label="Esta semana"
              value={data?.week ?? 0}
              sub={accuracy != null ? `${accuracy}% aprobadas` : undefined}
              bg="bg-emerald-50" accent="text-emerald-600" delay="delay-75"
            />
            <KpiCard
              Icon={AlertTriangle}
              label="Falsos / duplicados (7d)"
              value={data?.fakes ?? 0}
              sub="Rechazados esta semana"
              bg="bg-red-50" accent="text-red-500" delay="delay-150"
            />
            <KpiCard
              Icon={Clock}
              label="Pagos pendientes"
              value={data?.pendingTransactions ?? 0}
              sub="Sin comprobante aún"
              delay="delay-225"
              bg="bg-amber-50" accent="text-amber-500"
            />
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <KpiCard
              Icon={DollarSign}
              label="Monto verificado (30d)"
              value={fmtMoney(data?.totalAmountMonth)}
              sub="Solo pagos confirmados reales"
              bg="bg-slate-100" accent="text-slate-700"
            />
            <KpiCard
              Icon={Users}
              label="Empleados activos"
              value={data?.activeEmployees ?? 0}
              sub="Con acceso al sistema"
              bg="bg-slate-100" accent="text-slate-700"
            />
          </div>

          {/* Gráfico + Actividad reciente */}
          <div className="grid lg:grid-cols-2 gap-5">
            <BarChart daily={data?.daily || []} />
            <RecentActivity items={data?.recent || []} />
          </div>
        </div>
      )}
    </div>
  );
}
