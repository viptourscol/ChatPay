import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api.js';
import {
  UserPlus, Search, MessageCircle, ToggleLeft, ToggleRight, Trash2,
  Users, CheckCircle2, XCircle
} from 'lucide-react';

function initials(name) {
  if (!name) return '?';
  return name.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase();
}

const AVATAR_COLORS = [
  'from-brand-400 to-brand-600 text-white',
  'from-emerald-400 to-emerald-600 text-white',
  'from-purple-400 to-purple-600 text-white',
  'from-amber-400 to-amber-600 text-white',
  'from-rose-400 to-rose-600 text-white',
  'from-teal-400 to-teal-600 text-white',
];
function avatarColor(name) {
  const code = [...(name || '')].reduce((s, c) => s + c.charCodeAt(0), 0);
  return AVATAR_COLORS[code % AVATAR_COLORS.length];
}

export default function Employees() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ['employees'], queryFn: () => api('/api/employees') });
  const [form, setForm] = useState({ name: '', whatsapp_number: '' });
  const [search, setSearch] = useState('');

  const create = useMutation({
    mutationFn: (body) => api('/api/employees', { method: 'POST', body }),
    onSuccess: () => { setForm({ name: '', whatsapp_number: '' }); qc.invalidateQueries({ queryKey: ['employees'] }); }
  });
  const toggle = useMutation({
    mutationFn: (e) => api('/api/employees', { method: 'PATCH', body: { id: e.id, is_active: !e.is_active } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['employees'] })
  });
  const remove = useMutation({
    mutationFn: (id) => api('/api/employees', { method: 'DELETE', query: { id } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['employees'] })
  });

  const all = data?.items || [];
  const filtered = search ? all.filter(e => e.name?.toLowerCase().includes(search.toLowerCase()) || e.whatsapp_number?.includes(search)) : all;
  const activeCount = all.filter(e => e.is_active).length;

  return (
    <div>
      <header className="mb-6">
        <h1 className="font-serif text-2xl md:text-3xl">Empleados</h1>
        <p className="text-slate-500 text-sm">Solo los números registrados aquí pueden verificar pagos por WhatsApp.</p>
      </header>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Formulario */}
        <div className="card">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-8 h-8 rounded-lg bg-brand-100 text-brand-700 grid place-items-center">
              <UserPlus size={16} />
            </div>
            <h3 className="font-semibold text-slate-800">Agregar empleado</h3>
          </div>
          <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); create.mutate(form); }}>
            <div>
              <label className="label">Nombre completo</label>
              <input className="input" required placeholder="Ej: Ana Gómez" value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div>
              <label className="label">Número WhatsApp</label>
              <input className="input" placeholder="+573001234567" required value={form.whatsapp_number}
                onChange={(e) => setForm({ ...form, whatsapp_number: e.target.value })} />
              <p className="text-xs text-slate-400 mt-1">Formato internacional con código de país.</p>
            </div>
            {create.error && <div className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">{String(create.error.message)}</div>}
            <button className="btn btn-primary w-full" disabled={create.isPending}>
              {create.isPending ? 'Guardando…' : <><UserPlus size={15} /> Agregar empleado</>}
            </button>
          </form>

          {/* Stats rápidas */}
          <div className="mt-5 pt-4 border-t border-slate-100 grid grid-cols-2 gap-3">
            <div className="rounded-xl bg-slate-50 p-3 text-center">
              <div className="text-2xl font-bold text-slate-800">{all.length}</div>
              <div className="text-xs text-slate-500 flex items-center justify-center gap-1 mt-0.5"><Users size={10}/> Total</div>
            </div>
            <div className="rounded-xl bg-emerald-50 p-3 text-center">
              <div className="text-2xl font-bold text-emerald-700">{activeCount}</div>
              <div className="text-xs text-emerald-600 flex items-center justify-center gap-1 mt-0.5"><CheckCircle2 size={10}/> Activos</div>
            </div>
          </div>
        </div>

        {/* Lista */}
        <div className="lg:col-span-2">
          {/* Buscador */}
          <div className="relative mb-4">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input className="input w-full pl-9" placeholder="Buscar por nombre o número…"
              value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>

          {isLoading && (
            <div className="card text-center py-10 text-slate-400">
              <div className="w-6 h-6 border-2 border-brand-400 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
              Cargando empleados…
            </div>
          )}

          {!isLoading && filtered.length === 0 && (
            <div className="card text-center py-10">
              <Users size={36} className="mx-auto text-slate-300 mb-2" />
              <div className="text-slate-500 font-medium">{search ? 'Sin coincidencias' : 'Sin empleados registrados'}</div>
              <div className="text-slate-400 text-sm mt-1">{search ? 'Intenta con otro nombre o número' : 'Agrega el primero con el formulario.'}</div>
            </div>
          )}

          {/* Tabla — md+ */}
          {!isLoading && filtered.length > 0 && (
            <div className="card p-0 overflow-hidden hidden md:block">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 border-b border-slate-100">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Empleado</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">WhatsApp</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Estado</th>
                    <th className="px-4 py-3"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {filtered.map((e) => (
                    <tr key={e.id} className="hover:bg-slate-50 transition-colors group">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className={`w-9 h-9 rounded-full bg-gradient-to-br ${avatarColor(e.name)} grid place-items-center font-bold text-sm shrink-0`}>
                            {initials(e.name)}
                          </div>
                          <span className="font-medium text-slate-800">{e.name}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5 text-slate-500 font-mono text-xs">
                          <MessageCircle size={13} className="text-green-500 shrink-0" />
                          {e.whatsapp_number}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          e.is_active
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : 'bg-slate-100 text-slate-500 border border-slate-200'
                        }`}>
                          {e.is_active ? <CheckCircle2 size={11} /> : <XCircle size={11} />}
                          {e.is_active ? 'Activo' : 'Inactivo'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1 justify-end opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            title={e.is_active ? 'Desactivar' : 'Activar'}
                            onClick={() => toggle.mutate(e)}
                            className={`p-1.5 rounded-lg transition text-sm ${
                              e.is_active
                                ? 'text-slate-400 hover:text-amber-600 hover:bg-amber-50'
                                : 'text-slate-400 hover:text-emerald-600 hover:bg-emerald-50'
                            }`}
                          >
                            {e.is_active ? <ToggleRight size={18} /> : <ToggleLeft size={18} />}
                          </button>
                          <button
                            title="Eliminar empleado"
                            onClick={() => confirm(`¿Eliminar a ${e.name}?`) && remove.mutate(e.id)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition"
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Cards — móvil */}
          {!isLoading && filtered.length > 0 && (
            <div className="space-y-3 md:hidden">
              {filtered.map((e) => (
                <div key={e.id} className="card">
                  <div className="flex items-center gap-3">
                    <div className={`w-11 h-11 rounded-full bg-gradient-to-br ${avatarColor(e.name)} grid place-items-center font-bold text-base shrink-0`}>
                      {initials(e.name)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-slate-800 truncate">{e.name}</div>
                      <div className="flex items-center gap-1 text-xs text-slate-500 font-mono mt-0.5">
                        <MessageCircle size={11} className="text-green-500 shrink-0" />
                        <span className="truncate">{e.whatsapp_number}</span>
                      </div>
                    </div>
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium shrink-0 ${
                      e.is_active
                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                        : 'bg-slate-100 text-slate-500 border border-slate-200'
                    }`}>
                      {e.is_active ? <CheckCircle2 size={10} /> : <XCircle size={10} />}
                      {e.is_active ? 'Activo' : 'Inactivo'}
                    </span>
                  </div>
                  <div className="flex gap-2 mt-3 pt-3 border-t border-slate-100">
                    <button
                      onClick={() => toggle.mutate(e)}
                      className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-sm font-medium border transition ${
                        e.is_active
                          ? 'border-amber-200 text-amber-700 bg-amber-50 hover:bg-amber-100'
                          : 'border-emerald-200 text-emerald-700 bg-emerald-50 hover:bg-emerald-100'
                      }`}
                    >
                      {e.is_active ? <><ToggleRight size={15}/> Desactivar</> : <><ToggleLeft size={15}/> Activar</>}
                    </button>
                    <button
                      onClick={() => confirm(`¿Eliminar a ${e.name}?`) && remove.mutate(e.id)}
                      className="flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium border border-red-200 text-red-600 bg-red-50 hover:bg-red-100 transition"
                    >
                      <Trash2 size={14} /> Eliminar
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

export default function Employees() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ['employees'], queryFn: () => api('/api/employees') });
  const [form, setForm] = useState({ name: '', whatsapp_number: '' });

  const create = useMutation({
    mutationFn: (body) => api('/api/employees', { method: 'POST', body }),
    onSuccess: () => {
      setForm({ name: '', whatsapp_number: '' });
      qc.invalidateQueries({ queryKey: ['employees'] });
    }
  });
  const toggle = useMutation({
    mutationFn: (e) => api('/api/employees', { method: 'PATCH', body: { id: e.id, is_active: !e.is_active } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['employees'] })
  });
  const remove = useMutation({
    mutationFn: (id) => api('/api/employees', { method: 'DELETE', query: { id } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['employees'] })
  });

  return (
    <div>
      <header className="mb-6">
        <h1 className="font-serif text-2xl md:text-3xl">Empleados</h1>
        <p className="text-slate-500 text-sm">Solo los números registrados aquí pueden verificar pagos por WhatsApp.</p>
      </header>

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="card">
          <h3 className="font-semibold mb-3">Agregar empleado</h3>
          <form
            className="space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              create.mutate(form);
            }}
          >
            <div>
              <label className="label">Nombre</label>
              <input className="input" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div>
              <label className="label">WhatsApp (con país)</label>
              <input
                className="input"
                placeholder="+573001234567"
                required
                value={form.whatsapp_number}
                onChange={(e) => setForm({ ...form, whatsapp_number: e.target.value })}
              />
            </div>
            {create.error && <div className="text-sm text-red-600">{String(create.error.message)}</div>}
            <button className="btn btn-primary w-full" disabled={create.isPending}>
              {create.isPending ? 'Guardando…' : 'Agregar'}
            </button>
          </form>
        </div>

        <div className="lg:col-span-2 space-y-3">
          {isLoading && <div className="card text-center text-slate-500 py-6">Cargando…</div>}

          {/* Vista de tabla — solo en md+ */}
          <div className="card p-0 overflow-hidden hidden md:block">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-left">
                <tr>
                  <th className="px-4 py-3">Nombre</th>
                  <th className="px-4 py-3">WhatsApp</th>
                  <th className="px-4 py-3">Estado</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {(data?.items || []).map((e) => (
                  <tr key={e.id} className="border-t border-slate-100">
                    <td className="px-4 py-3">{e.name}</td>
                    <td className="px-4 py-3 font-mono text-xs">{e.whatsapp_number}</td>
                    <td className="px-4 py-3">
                      <span className={`badge ${e.is_active ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-600'}`}>
                        {e.is_active ? 'Activo' : 'Inactivo'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right space-x-3">
                      <button className="text-brand-600 hover:underline" onClick={() => toggle.mutate(e)}>
                        {e.is_active ? 'Desactivar' : 'Activar'}
                      </button>
                      <button
                        className="text-red-600 hover:underline"
                        onClick={() => confirm(`Eliminar a ${e.name}?`) && remove.mutate(e.id)}
                      >
                        Eliminar
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Vista de cards — solo en móvil */}
          <div className="space-y-3 md:hidden">
            {(data?.items || []).map((e) => (
              <div key={e.id} className="card flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-brand-100 flex items-center justify-center text-brand-700 font-bold text-sm shrink-0">
                  {e.name?.[0]?.toUpperCase() || '?'}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-slate-800 truncate">{e.name}</div>
                  <div className="font-mono text-xs text-slate-500 truncate">{e.whatsapp_number}</div>
                </div>
                <div className="flex flex-col items-end gap-2 shrink-0">
                  <span className={`badge text-xs ${e.is_active ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-600'}`}>
                    {e.is_active ? 'Activo' : 'Inactivo'}
                  </span>
                  <div className="flex gap-2">
                    <button className="text-xs text-brand-600 hover:underline" onClick={() => toggle.mutate(e)}>
                      {e.is_active ? 'Desactivar' : 'Activar'}
                    </button>
                    <button
                      className="text-xs text-red-600 hover:underline"
                      onClick={() => confirm(`Eliminar a ${e.name}?`) && remove.mutate(e.id)}
                    >
                      Eliminar
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
