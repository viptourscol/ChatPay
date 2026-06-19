import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api.js';
import { useToast } from '../components/Toast.jsx';
import { UserPlus, Search, MessageCircle, ToggleLeft, ToggleRight, Trash2, Users, CheckCircle2, XCircle, BarChart2, X, TrendingUp, AlertTriangle, Clock, DollarSign } from 'lucide-react';

// ── Helpers ───────────────────────────────────────────────────────
function fmtMoney(n) {
  if (!n && n !== 0) return '—';
  return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(n);
}
function fmtDate(s) {
  if (!s) return '—';
  return new Date(s).toLocaleDateString('es-CO', { timeZone: 'America/Bogota', day: '2-digit', month: 'short', year: 'numeric' });
}

// ── Employee Drawer ───────────────────────────────────────────────
const STATUS_CFG = {
  real:      { label: 'Real',      bg: 'bg-emerald-100', text: 'text-emerald-700', dot: 'bg-emerald-500' },
  fake:      { label: 'Falso',     bg: 'bg-red-100',     text: 'text-red-700',     dot: 'bg-red-500' },
  duplicate: { label: 'Dup.',      bg: 'bg-amber-100',   text: 'text-amber-700',   dot: 'bg-amber-500' },
  pending:   { label: 'Pendiente', bg: 'bg-slate-100',   text: 'text-slate-500',   dot: 'bg-slate-400' },
  error:     { label: 'Error',     bg: 'bg-slate-100',   text: 'text-slate-500',   dot: 'bg-slate-400' },
};

function EmployeeDrawer({ employee, onClose, avatarGradient }) {
  const { data, isLoading } = useQuery({
    queryKey: ['employee-stats', employee.id],
    queryFn: () => api('/api/verifications', { query: { employee_id: employee.id, limit: 10000 } }),
    enabled: !!employee,
  });

  const items = data?.items || [];
  const real  = items.filter(v => v.status === 'real');
  const fakes = items.filter(v => v.status === 'fake' || v.status === 'duplicate');
  const pend  = items.filter(v => v.status === 'pending');
  const totalMonto = real.reduce((s, v) => s + (v.extracted_amount || 0), 0);
  const avgMonto   = real.length > 0 ? totalMonto / real.length : 0;
  const accuracy   = items.length > 0 ? Math.round((real.length / items.length) * 100) : null;
  const recent     = [...items].sort((a,b) => b.created_at?.localeCompare(a.created_at)).slice(0, 6);

  return (
    <>
      {/* Overlay */}
      <div className="fixed inset-0 bg-black/30 backdrop-blur-sm z-40 animate-fade-in" onClick={onClose} />
      {/* Drawer */}
      <div className="fixed right-0 top-0 h-full w-full max-w-md bg-white shadow-2xl z-50 flex flex-col animate-slide-in-right overflow-hidden">
        {/* Header */}
        <div className="relative overflow-hidden shrink-0" style={{ background: 'linear-gradient(135deg, #bbf7d0 0%, #22c55e 100%)' }}>
          <svg className="absolute inset-0 w-full h-full opacity-10 pointer-events-none"><defs><pattern id="dr" width="48" height="48" patternUnits="userSpaceOnUse"><polygon points="24,4 44,24 24,44 4,24" fill="none" stroke="#16a34a" strokeWidth="1.5"/></pattern></defs><rect width="100%" height="100%" fill="url(#dr)"/></svg>
          <div className="relative z-10 flex items-start justify-between p-5">
            <div className="flex items-center gap-3">
              <div className={`w-12 h-12 rounded-2xl bg-gradient-to-br ${avatarGradient} flex items-center justify-center text-white font-bold text-lg shrink-0 shadow-sm`}>
                {employee.name.split(' ').slice(0,2).map(w=>w[0]).join('').toUpperCase()}
              </div>
              <div>
                <h2 className="font-serif text-xl text-emerald-950 leading-tight">{employee.name}</h2>
                <p className="text-emerald-800/70 text-xs font-mono mt-0.5">{employee.whatsapp_number}</p>
              </div>
            </div>
            <button onClick={onClose} className="w-8 h-8 rounded-xl bg-white/30 hover:bg-white/50 grid place-items-center transition-colors">
              <X size={16} className="text-emerald-900" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {isLoading ? (
            <div className="flex items-center justify-center py-16 text-slate-400">
              <div className="w-5 h-5 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin mr-2" /> Cargando…
            </div>
          ) : (
            <>
              {/* KPIs */}
              <div className="grid grid-cols-2 gap-3">
                {[
                  { Icon: CheckCircle2, label: 'Pagos reales',    value: real.length,   color: 'text-emerald-600', bg: 'bg-emerald-50' },
                  { Icon: AlertTriangle,label: 'Falsos/Dup.',     value: fakes.length,  color: 'text-red-500',     bg: 'bg-red-50'     },
                  { Icon: Clock,        label: 'Pendientes',      value: pend.length,   color: 'text-amber-500',   bg: 'bg-amber-50'   },
                  { Icon: TrendingUp,   label: 'Tasa aprobación', value: accuracy != null ? `${accuracy}%` : '—', color: 'text-emerald-700', bg: 'bg-emerald-100' },
                ].map(({ Icon, label, value, color, bg }) => (
                  <div key={label} className="rounded-2xl border border-emerald-100/60 bg-white p-4 shadow-sm">
                    <div className={`w-8 h-8 rounded-xl grid place-items-center mb-2 ${bg}`}><Icon size={15} className={color} /></div>
                    <div className="text-xl font-bold text-slate-900">{value}</div>
                    <div className="text-xs text-slate-500">{label}</div>
                  </div>
                ))}
              </div>

              {/* Montos */}
              <div className="bg-emerald-50 rounded-2xl border border-emerald-100 p-4 flex items-center justify-between">
                <div>
                  <div className="text-xs text-emerald-700 font-semibold uppercase tracking-widest mb-0.5">Total verificado</div>
                  <div className="text-2xl font-bold text-emerald-800">{fmtMoney(totalMonto)}</div>
                </div>
                <div className="text-right">
                  <div className="text-xs text-emerald-700 font-semibold uppercase tracking-widest mb-0.5">Promedio</div>
                  <div className="text-lg font-bold text-emerald-700">{fmtMoney(avgMonto)}</div>
                </div>
              </div>

              {/* Últimas verificaciones */}
              {recent.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-slate-700 mb-3">Últimas verificaciones</h3>
                  <div className="space-y-1.5">
                    {recent.map(v => {
                      const cfg = STATUS_CFG[v.status] || STATUS_CFG.pending;
                      return (
                        <div key={v.id} className="flex items-center justify-between px-3 py-2.5 rounded-xl hover:bg-slate-50 transition-colors">
                          <div>
                            <div className="text-xs font-medium text-slate-700">{fmtDate(v.created_at)}</div>
                            <div className="text-[11px] text-slate-400">{v.extracted_reference || '—'}</div>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-bold text-slate-800">{fmtMoney(v.extracted_amount)}</span>
                            <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${cfg.bg} ${cfg.text}`}>
                              <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`}/>{cfg.label}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {items.length === 0 && (
                <div className="flex flex-col items-center justify-center py-10 text-slate-400 gap-2">
                  <BarChart2 size={32} className="opacity-30" />
                  <span className="text-sm">Sin verificaciones registradas</span>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </>
  );
}

const GRADIENTS = [
  'from-violet-500 to-purple-600',
  'from-sky-500 to-blue-600',
  'from-emerald-500 to-teal-600',
  'from-orange-500 to-amber-600',
  'from-rose-500 to-pink-600',
  'from-indigo-500 to-blue-700',
];
function avatarColor(name = '') {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) & 0xffff;
  return GRADIENTS[h % GRADIENTS.length];
}
function initials(name = '') {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

export default function Employees() {
  const qc = useQueryClient();
  const toast = useToast();
  const [drawerEmp, setDrawerEmp] = useState(null);
  const { data, isLoading } = useQuery({
    queryKey: ['employees'],
    queryFn: () => api('/api/employees'),
  });
  const [form, setForm] = useState({ name: '', whatsapp_number: '', location_id: '' });
  const [search, setSearch] = useState('');

  const { data: locData } = useQuery({
    queryKey: ['locations'],
    queryFn: () => api('/api/employees', { query: { resource: 'locations' } }),
  });
  const locations = locData?.items?.filter(l => l.is_active) || [];
  const multiSede = locations.length > 1;
  const maxEmployees = data?.max_employees ?? null;

  const create = useMutation({
    mutationFn: (body) => api('/api/employees', { method: 'POST', body }),
    onSuccess: () => {
      setForm({ name: '', whatsapp_number: '', location_id: '' });
      qc.invalidateQueries({ queryKey: ['employees'] });
      toast.success('Empleado agregado correctamente');
    },
    onError: (err) => {
      const msg = err?.message || 'Error al agregar empleado';
      const isLimit = msg.toLowerCase().includes('máximo') || msg.toLowerCase().includes('límite');
      toast.error(msg, {
        title: isLimit ? 'Límite de plan alcanzado' : 'Error',
        ...(isLimit && { action: { label: 'Ver planes', href: '/suscripcion' } }),
      });
    },
  });
  const toggle = useMutation({
    mutationFn: (e) => api('/api/employees', { method: 'PATCH', body: { id: e.id, is_active: !e.is_active } }),
    onSuccess: (_, e) => {
      qc.invalidateQueries({ queryKey: ['employees'] });
      toast.success(e.is_active ? 'Empleado desactivado' : 'Empleado activado');
    },
    onError: (err) => toast.error(err?.message || 'Error al cambiar estado'),
  });
  const remove = useMutation({
    mutationFn: (id) => api('/api/employees', { method: 'DELETE', query: { id } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['employees'] });
      toast.success('Empleado eliminado');
    },
    onError: (err) => toast.error(err?.message || 'Error al eliminar empleado'),
  });

  const employees = (data?.items || []).filter((e) => {
    const q = search.toLowerCase();
    return e.name?.toLowerCase().includes(q) || e.whatsapp_number?.includes(q);
  });

  const total = data?.items?.length ?? 0;
  const active = data?.items?.filter((e) => e.is_active).length ?? 0;

  return (
    <div>
      {drawerEmp && (
        <EmployeeDrawer
          employee={drawerEmp}
          avatarGradient={avatarColor(drawerEmp.name)}
          onClose={() => setDrawerEmp(null)}
        />
      )}
      <header className="mb-6">
        <h1 className="font-serif text-2xl md:text-3xl font-bold text-slate-800">Empleados</h1>
        <p className="text-slate-500 text-sm mt-1">
          Solo los numeros registrados aqui pueden verificar pagos por WhatsApp.
        </p>
      </header>

      <div className="grid grid-cols-2 gap-3 mb-6">
        <div className="card flex items-center gap-3 py-3">
          <div className="w-10 h-10 rounded-xl bg-brand-50 grid place-items-center shrink-0">
            <Users size={19} className="text-brand-600" />
          </div>
          <div>
            <div className="text-xs text-slate-500">Total</div>
            <div className="text-2xl font-semibold text-slate-800">{total}</div>
          </div>
        </div>
        <div className="card flex items-center gap-3 py-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-50 grid place-items-center shrink-0">
            <CheckCircle2 size={19} className="text-emerald-600" />
          </div>
          <div>
            <div className="text-xs text-slate-500">Activos</div>
            <div className="text-2xl font-semibold text-emerald-700">{active}</div>
          </div>
        </div>
      </div>

      {/* Barra de cuota del plan */}
      {maxEmployees !== null && (
        <div className="card mb-6 py-3">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs text-slate-500 font-medium">Cupo de empleados según tu plan</span>
            <span className={`text-xs font-semibold ${active >= maxEmployees ? 'text-red-600' : 'text-slate-700'}`}>
              {active} / {maxEmployees} activos
            </span>
          </div>
          <div className="w-full bg-slate-100 rounded-full h-2">
            <div
              className={`h-2 rounded-full transition-all ${active >= maxEmployees ? 'bg-red-500' : active / maxEmployees >= 0.8 ? 'bg-amber-400' : 'bg-emerald-500'}`}
              style={{ width: `${Math.min((active / maxEmployees) * 100, 100)}%` }}
            />
          </div>
          {active >= maxEmployees && (
            <p className="text-xs text-red-500 mt-1.5">Límite alcanzado. Actualiza tu plan para agregar más empleados.</p>
          )}
        </div>
      )}

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="card">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-8 h-8 rounded-lg bg-brand-50 grid place-items-center">
              <UserPlus size={16} className="text-brand-600" />
            </div>
            <h3 className="font-semibold text-slate-800">Agregar empleado</h3>
          </div>
          <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); create.mutate(form); }}>
            <div>
              <label className="label">Nombre completo</label>
              <input className="input" required placeholder="Maria Garcia" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div>
              <label className="label">WhatsApp (con codigo de pais)</label>
              <div className="relative">
                <MessageCircle size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input className="input pl-8" placeholder="+573001234567" required value={form.whatsapp_number} onChange={(e) => setForm({ ...form, whatsapp_number: e.target.value })} />
              </div>
            </div>
            {multiSede && (
              <div>
                <label className="label">Sede</label>
                <select
                  className="input"
                  value={form.location_id}
                  onChange={e => setForm({ ...form, location_id: e.target.value })}
                >
                  <option value="">Selecciona una sede</option>
                  {locations.map(l => (
                    <option key={l.id} value={l.id}>{l.name}{l.city ? ` — ${l.city}` : ''}</option>
                  ))}
                </select>
              </div>
            )}            <button className="btn btn-primary w-full" disabled={create.isPending}>{create.isPending ? 'Guardando...' : 'Agregar empleado'}</button>
          </form>
        </div>

        <div className="lg:col-span-2">
          <div className="relative mb-4">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input className="input pl-9 w-full" placeholder="Buscar por nombre o numero..." value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>

          {isLoading && (
            <div className="card text-center py-10">
              <div className="w-5 h-5 border-2 border-brand-400 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
              <span className="text-slate-400 text-sm">Cargando empleados...</span>
            </div>
          )}

          {!isLoading && employees.length === 0 && (
            <div className="card text-center py-12">
              <Users size={36} className="mx-auto text-slate-300 mb-3" />
              <p className="text-slate-500 font-medium">{search ? 'Sin resultados' : 'Sin empleados registrados'}</p>
              {search && <button className="btn btn-ghost text-sm mt-2" onClick={() => setSearch('')}>Limpiar</button>}
            </div>
          )}

          {!isLoading && employees.length > 0 && (
            <div className="card p-0 overflow-hidden hidden md:block">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 border-b border-slate-100 text-left">
                  <tr>
                    <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Empleado</th>
                    <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">WhatsApp</th>
                    <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Estado</th>
                    <th className="px-4 py-3"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {employees.map((e) => (
                    <tr key={e.id} className="hover:bg-slate-50 transition group">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className={`w-8 h-8 rounded-full bg-gradient-to-br ${avatarColor(e.name)} flex items-center justify-center text-white text-xs font-bold shrink-0`}>{initials(e.name)}</div>
                          <span className="font-medium text-slate-800">{e.name}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-slate-600">{e.whatsapp_number}</td>
                      <td className="px-4 py-3">
                        {e.is_active
                          ? <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-700"><CheckCircle2 size={11} /> Activo</span>
                          : <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-600"><XCircle size={11} /> Inactivo</span>
                        }
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex gap-1.5 justify-end opacity-0 group-hover:opacity-100 transition-opacity">
                          <button onClick={() => setDrawerEmp(e)} className="flex items-center gap-1 px-2.5 py-1 rounded-lg border border-emerald-200 text-emerald-700 hover:bg-emerald-50 text-xs transition">
                            <BarChart2 size={12}/> Ver stats
                          </button>
                          <button onClick={() => toggle.mutate(e)} className="flex items-center gap-1 px-2.5 py-1 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-100 text-xs transition">
                            {e.is_active ? <ToggleLeft size={13}/> : <ToggleRight size={13}/>}{e.is_active ? 'Desactivar' : 'Activar'}
                          </button>
                          <button onClick={() => window.confirm(`Eliminar a ${e.name}?`) && remove.mutate(e.id)} className="flex items-center gap-1 px-2.5 py-1 rounded-lg border border-red-200 text-red-600 hover:bg-red-50 text-xs transition">
                            <Trash2 size={12}/> Eliminar
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {!isLoading && employees.length > 0 && (
            <div className="space-y-3 md:hidden">
              {employees.map((e) => (
                <div key={e.id} className="card">
                  <div className="flex items-center gap-3 mb-3">
                    <div className={`w-10 h-10 rounded-full bg-gradient-to-br ${avatarColor(e.name)} flex items-center justify-center text-white text-sm font-bold shrink-0`}>{initials(e.name)}</div>
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-slate-800 truncate">{e.name}</div>
                      <div className="font-mono text-xs text-slate-500 truncate">{e.whatsapp_number}</div>
                    </div>
                    {e.is_active
                      ? <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-700 shrink-0"><CheckCircle2 size={10}/> Activo</span>
                      : <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-600 shrink-0"><XCircle size={10}/> Inactivo</span>
                    }
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => setDrawerEmp(e)} className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium border border-emerald-200 text-emerald-700 bg-emerald-50 hover:bg-emerald-100 transition">
                      <BarChart2 size={14}/>
                    </button>
                    <button onClick={() => toggle.mutate(e)} className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium border border-slate-200 text-slate-700 bg-slate-50 hover:bg-slate-100 transition">
                      {e.is_active ? <ToggleLeft size={14}/> : <ToggleRight size={14}/>}{e.is_active ? 'Desactivar' : 'Activar'}
                    </button>
                    <button onClick={() => window.confirm(`Eliminar a ${e.name}?`) && remove.mutate(e.id)} className="flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium border border-red-200 text-red-600 bg-red-50 hover:bg-red-100 transition">
                      <Trash2 size={14}/> Eliminar
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
