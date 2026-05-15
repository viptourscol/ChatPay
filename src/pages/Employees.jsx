import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api.js';

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
        <h1 className="font-serif text-3xl">Empleados</h1>
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

        <div className="card lg:col-span-2 p-0 overflow-hidden">
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
              {isLoading && <tr><td colSpan={4} className="px-4 py-6 text-center text-slate-500">Cargando…</td></tr>}
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
      </div>
    </div>
  );
}
