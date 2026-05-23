import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api.js';
import {
  ShieldCheck, AlertTriangle, Users, TrendingUp,
  Clock, DollarSign, CheckCircle2, XCircle, AlertCircle,
  Zap, BarChart2, UserPlus, FileText
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
    hour: '2-digit', minute: '2-digit',
  });
}
function initials(name) {
  if (!name) return '?';
  return name.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase();
}
function greeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Buenos días';
  if (h < 18) return 'Buenas tardes';
  return 'Buenas noches';
}
function todayLabel() {
  return new Date().toLocaleDateString('es-CO', {
    weekday: 'long', day: 'numeric', month: 'long',
  });
}

const STATUS_CONFIG = {
  real:      { label: 'Real',      bg: 'bg-emerald-100', text: 'text-emerald-700', dot: 'bg-emerald-500' },
  fake:      { label: 'Falso',     bg: 'bg-red-100',     text: 'text-red-700',     dot: 'bg-red-500' },
  duplicate: { label: 'Duplicado', bg: 'bg-amber-100',   text: 'text-amber-700',   dot: 'bg-amber-500' },
  error:     { label: 'Error',     bg: 'bg-slate-100',   text: 'text-slate-500',   dot: 'bg-slate-400' },
  pending:   { label: 'Pendiente', bg: 'bg-slate-100',   text: 'text-slate-500',   dot: 'bg-slate-400' },
};

/* ── Accuracy bar ────────────────────────────────────────── */
function AccuracyBar({ value }) {
  if (value == null) return null;
  const color = value >= 80 ? 'bg-emerald-500' : value >= 60 ? 'bg-amber-500' : 'bg-red-500';
  return (
    <div className="mt-2">
      <div className="flex justify-between text-[10px] text-slate-400 mb-1">
        <span>Precisión</span><span className="font-semibold text-slate-700">{value}%</span>
      </div>
      <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${value}%` }} />
      </div>
    </div>
  );
}

/* ── KPI Card ────────────────────────────────────────────── */
function KpiCard({ Icon, label, value, sub, iconBg, iconColor, delay = 'delay-0', extra }) {
  const str = String(value ?? '');
  const fontSize = str.length > 12 ? 'text-base' : str.length > 8 ? 'text-xl' : 'text-2xl';
  return (
    <div className={`rounded-2xl bg-white border border-emerald-100/60 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 animate-fade-up ${delay}`}>
      <div className="p-4 sm:p-5">
        <div className="flex items-start justify-between mb-3">
          <div className={`w-10 h-10 rounded-xl grid place-items-center ${iconBg}`}>
            <Icon size={18} className={iconColor} />
          </div>
        </div>
        <div className={`${fontSize} font-bold text-slate-900 leading-none mb-1`}>{value}</div>
        <div className="text-xs font-medium text-slate-500 truncate">{label}</div>
        {sub && <div className="text-[11px] text-slate-400 mt-1 truncate">{sub}</div>}
        {extra}
      </div>
    </div>
  );
}

/* ── Bar Chart ───────────────────────────────────────────── */
function BarChart({ daily = [] }) {
  const max = Math.max(...daily.map(d => d.real + d.fake + d.duplicate + d.other), 1);
  const days = ['Do', 'Lu', 'Ma', 'Mi', 'Ju', 'Vi', 'Sá'];
  const totalWeek = daily.reduce((s, d) => s + d.real + d.fake + d.duplicate + d.other, 0);
  const todayStr = new Date().toISOString().slice(0, 10);

  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 animate-fade-up delay-300">
      <div className="flex items-start justify-between mb-4 gap-2 flex-wrap">
        <div>
          <h2 className="font-semibold text-slate-800 text-sm">Actividad últimos 7 días</h2>
          <p className="text-xs text-slate-400 mt-0.5">{totalWeek} verificaciones en total</p>
        </div>
        <div className="flex items-center gap-3 text-[11px] text-slate-500">
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" />Reales</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-400 inline-block" />Falsos</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-400 inline-block" />Dup.</span>
        </div>
      </div>
      <div className="flex items-end gap-1.5 h-36">
        {daily.map((d) => {
          const total = d.real + d.fake + d.duplicate + d.other;
          const hReal = Math.round((d.real / max) * 100);
          const hFake = Math.round((d.fake / max) * 100);
          const hDup  = Math.round((d.duplicate / max) * 100);
          const dow   = days[new Date(d.date + 'T12:00:00').getDay()];
          const isToday = d.date === todayStr;
          return (
            <div key={d.date} className="flex-1 flex flex-col items-center gap-1 group">
              <div className="text-[9px] text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity font-medium">{total || ''}</div>
              <div
                className="w-full flex flex-col justify-end gap-px rounded-lg overflow-hidden"
                style={{ height: '100px', background: isToday ? '#f0fdf4' : '#f8fafc' }}
              >
                {hDup  > 0 && <div style={{ height: `${hDup}%`  }} className="bg-amber-400 w-full" />}
                {hFake > 0 && <div style={{ height: `${hFake}%` }} className="bg-red-400 w-full" />}
                {hReal > 0 && <div style={{ height: `${hReal}%` }} className="bg-emerald-500 w-full" />}
              </div>
              <div className={`text-[10px] font-medium ${isToday ? 'text-emerald-600' : 'text-slate-400'}`}>{dow}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ── Recent Activity ─────────────────────────────────────── */
function RecentActivity({ items = [] }) {
  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 animate-fade-up delay-400">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-semibold text-slate-800 text-sm">Actividad reciente</h2>
        <span className="text-[11px] text-slate-400">{items.length} registros</span>
      </div>
      {items.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-8 text-slate-400 gap-2">
          <BarChart2 size={28} className="opacity-30" />
          <span className="text-sm">Sin actividad registrada aún</span>
        </div>
      ) : (
        <div className="space-y-1">
          {items.map((v, i) => {
            const cfg = STATUS_CONFIG[v.status] || STATUS_CONFIG.pending;
            return (
              <div
                key={v.id}
                className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-slate-50 transition-colors duration-150 animate-fade-up"
                style={{ animationDelay: `${400 + i * 50}ms` }}
              >
                <div className="w-8 h-8 rounded-full bg-brand-100 text-brand-700 text-xs font-bold grid place-items-center shrink-0">
                  {initials(v.employees?.name)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-slate-800 truncate">
                    {v.employees?.name || v.whatsapp_from || '—'}
                  </div>
                  <div className="text-[11px] text-slate-400 truncate">{fmtTime(v.created_at)}</div>
                </div>
                <div className="flex flex-col items-end gap-1 shrink-0">
                  <div className="text-sm font-bold text-slate-900">{fmtMoney(v.extracted_amount)}</div>
                  <span className={`inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded-full ${cfg.bg} ${cfg.text}`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
                    {cfg.label}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ── Quick Actions ───────────────────────────────────────── */
function QuickActions({ navigate }) {
  const actions = [
    { label: 'Nueva verificación', Icon: ShieldCheck, to: '/verifications', color: 'text-brand-600 bg-brand-50 hover:bg-brand-100' },
    { label: 'Agregar empleado',   Icon: UserPlus,    to: '/employees',    color: 'text-emerald-600 bg-emerald-50 hover:bg-emerald-100' },
    { label: 'Ver reportes',       Icon: FileText,    to: '/reports',      color: 'text-violet-600 bg-violet-50 hover:bg-violet-100' },
  ];
  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 animate-fade-up delay-200">
      <h2 className="font-semibold text-slate-800 text-sm mb-3">Acciones rápidas</h2>
      <div className="space-y-2">
        {actions.map(({ label, Icon, to, color }) => (
          <button
            key={to}
            onClick={() => navigate(to)}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors duration-150 ${color}`}
          >
            <Icon size={16} />
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}

export default function Dashboard() {
  const navigate = useNavigate();
  const [locationId, setLocationId] = useState('');

  const { data: locData } = useQuery({
    queryKey: ['locations'],
    queryFn: () => api('/api/locations'),
  });
  const locations = locData?.items?.filter(l => l.is_active) || [];
  const multiSede = locations.length > 1;

  const { data, isLoading } = useQuery({
    queryKey: ['stats', locationId],
    queryFn: () => api('/api/stats', { query: locationId ? { location_id: locationId } : {} }),
    refetchInterval: 60_000,
  });

  const weekReal  = (data?.daily || []).reduce((s, d) => s + d.real, 0);
  const weekTotal = data?.week || 0;
  const accuracy  = weekTotal > 0 ? Math.round((weekReal / weekTotal) * 100) : null;

  return (
    <div>
      {/* ── Header banner ── */}
      <header className="relative mb-6 rounded-2xl overflow-hidden animate-fade-up" style={{ background: 'linear-gradient(135deg, #bbf7d0 0%, #22c55e 100%)' }}>
        {/* Patrón de rombos */}
        <svg className="absolute inset-0 w-full h-full opacity-10 pointer-events-none" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <pattern id="diamonds" x="0" y="0" width="48" height="48" patternUnits="userSpaceOnUse">
              <polygon points="24,4 44,24 24,44 4,24" fill="none" stroke="#16a34a" strokeWidth="1.5" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#diamonds)" />
        </svg>
        <div className="relative z-10 flex items-center justify-between gap-4 flex-wrap px-6 py-5">
          <div>
            <p className="text-xs font-semibold text-emerald-900/60 uppercase tracking-widest mb-0.5">{greeting()}</p>
            <h1 className="font-serif text-2xl md:text-3xl text-emerald-950 leading-tight">Dashboard</h1>
            <p className="text-emerald-800/70 text-sm capitalize mt-0.5">{todayLabel()}</p>
          </div>
          <div className="flex items-center gap-2 bg-white/30 backdrop-blur-sm border border-white/40 rounded-xl px-3 py-2">
            <span className="w-2 h-2 rounded-full bg-emerald-900 animate-pulse" />
            <span className="text-xs font-semibold text-emerald-950">Sistema activo</span>
          </div>
        </div>
        {multiSede && (
          <div className="relative z-10 px-6 pb-4">
            <select
              value={locationId}
              onChange={e => setLocationId(e.target.value)}
              className="bg-white/70 backdrop-blur-sm border border-white/60 rounded-xl px-3 py-1.5 text-sm font-medium text-emerald-900 focus:outline-none focus:ring-2 focus:ring-white/50"
            >
              <option value="">Todas las sedes</option>
              {locations.map(l => (
                <option key={l.id} value={l.id}>{l.name}{l.city ? ` — ${l.city}` : ''}</option>
              ))}
            </select>
          </div>
        )}
      </header>

      {isLoading ? (
        <div className="flex items-center gap-3 text-slate-400 py-16 justify-center">
          <div className="w-5 h-5 border-2 border-brand-400 border-t-transparent rounded-full animate-spin" />
          <span className="text-sm">Cargando métricas…</span>
        </div>
      ) : (
        <div className="space-y-4">

          {/* KPIs fila 1 */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <KpiCard
              Icon={ShieldCheck} label="Verificaciones hoy" value={data?.today ?? 0}
              sub="Comprobantes procesados"
              iconBg="bg-emerald-50" iconColor="text-emerald-600" delay="delay-0"
            />
            <KpiCard
              Icon={TrendingUp} label="Esta semana" value={data?.week ?? 0}
              iconBg="bg-emerald-100" iconColor="text-emerald-700" delay="delay-75"
              extra={<AccuracyBar value={accuracy} />}
            />
            <KpiCard
              Icon={AlertTriangle} label="Falsos / duplicados (7d)" value={data?.fakes ?? 0}
              sub="Rechazados esta semana"
              iconBg="bg-red-50" iconColor="text-red-400" delay="delay-150"
            />
            <KpiCard
              Icon={Clock} label="Pagos pendientes" value={data?.pendingTransactions ?? 0}
              sub="Sin comprobante aún"
              iconBg="bg-amber-50" iconColor="text-amber-500" delay="delay-225"
            />
          </div>

          {/* KPIs fila 2 */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <KpiCard
              Icon={DollarSign} label="Monto verificado (30d)" value={fmtMoney(data?.totalAmountMonth)}
              sub="Solo pagos reales"
              iconBg="bg-emerald-50" iconColor="text-emerald-600" delay="delay-300"
            />
            <KpiCard
              Icon={Users} label="Empleados activos" value={data?.activeEmployees ?? 0}
              sub="Con acceso al sistema"
              iconBg="bg-emerald-50" iconColor="text-emerald-600" delay="delay-375"
            />
            <KpiCard
              Icon={Zap} label="Tasa de aprobación" value={accuracy != null ? `${accuracy}%` : '—'}
              sub="Reales vs total semana"
              iconBg="bg-emerald-100" iconColor="text-emerald-700" delay="delay-450"
            />
            <KpiCard
              Icon={CheckCircle2} label="Verificados reales (7d)" value={weekReal}
              sub="Pagos confirmados"
              iconBg="bg-emerald-50" iconColor="text-emerald-600" delay="delay-500"
            />
          </div>

          {/* Gráfico + Actividad + Acciones */}
          <div className="grid lg:grid-cols-3 gap-4">
            <div className="lg:col-span-2">
              <BarChart daily={data?.daily || []} />
            </div>
            <div className="space-y-4">
              <QuickActions navigate={navigate} />
              <RecentActivity items={(data?.recent || []).slice(0, 5)} />
            </div>
          </div>

        </div>
      )}
    </div>
  );
}
