import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api.js';
import { UserPlus, Search, MessageCircle, ToggleLeft, ToggleRight, Trash2, Users, CheckCircle2, XCircle } from 'lucide-react';

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
  const { data, isLoading } = useQuery({
    queryKey: ['employees'],
    queryFn: () => api('/api/employees'),
  });
  const [form, setForm] = useState({ name: '', whatsapp_number: '' });
  const [search, setSearch] = useState('');

  const create = useMutation({
    mutationFn: (body) => api('/api/employees', { method: 'POST', body }),
    onSuccess: () => {
      setForm({ name: '', whatsapp_number: '' });
      qc.invalidateQueries({ queryKey: ['employees'] });
    },
  });
  const toggle = useMutation({
    mutationFn: (e) => api('/api/employees', { method: 'PATCH', body: { id: e.id, is_active: !e.is_active } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['employees'] }),
  });
  const remove = useMutation({
    mutationFn: (id) => api('/api/employees', { method: 'DELETE', query: { id } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['employees'] }),
  });

  const employees = (data?.items || []).filter((e) => {
    const q = search.toLowerCase();
    return e.name?.toLowerCase().includes(q) || e.whatsapp_number?.includes(q);
  });

  const total = data?.items?.length ?? 0;
  const active = data?.items?.filter((e) => e.is_active).length ?? 0;

  return (
    <div>
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
            {create.error && <div className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{String(create.error.message)}</div>}
            <button className="btn btn-primary w-full" disabled={create.isPending}>{create.isPending ? 'Guardando...' : 'Agregar empleado'}</button>
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
