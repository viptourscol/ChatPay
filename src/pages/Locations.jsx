import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api.js';
import { MapPin, Plus, Pencil, Users, X, Check, Building2, Loader2, ToggleLeft, ToggleRight, AlertTriangle } from 'lucide-react';
import { useSubscription } from '../hooks/useSubscription.js';

function LocationCard({ loc, onEdit, onToggle }) {
  return (
    <div className={`bg-white rounded-2xl border-2 p-5 flex flex-col gap-3 transition-all ${loc.is_active ? 'border-slate-200 hover:border-brand-300' : 'border-slate-100 opacity-60'}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className={`w-9 h-9 rounded-xl grid place-items-center shrink-0 ${loc.is_active ? 'bg-brand-100 text-brand-600' : 'bg-slate-100 text-slate-400'}`}>
            <Building2 size={18} />
          </div>
          <div>
            <p className="font-semibold text-slate-800 leading-tight">{loc.name}</p>
            {loc.city && <p className="text-xs text-slate-400">{loc.city}</p>}
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={() => onEdit(loc)}
            className="w-8 h-8 rounded-lg hover:bg-slate-100 grid place-items-center text-slate-400 transition"
          >
            <Pencil size={14} />
          </button>
          <button
            onClick={() => onToggle(loc)}
            className="w-8 h-8 rounded-lg hover:bg-slate-100 grid place-items-center text-slate-400 transition"
            title={loc.is_active ? 'Desactivar sede' : 'Activar sede'}
          >
            {loc.is_active ? <ToggleRight size={18} className="text-emerald-500" /> : <ToggleLeft size={18} />}
          </button>
        </div>
      </div>

      {loc.address && (
        <p className="text-xs text-slate-500 flex items-center gap-1">
          <MapPin size={11} className="shrink-0" />
          {loc.address}
        </p>
      )}

      <div className="flex items-center gap-2 pt-1 border-t border-slate-100">
        <Users size={13} className="text-slate-400" />
        <span className="text-xs text-slate-500">
          {loc.employee_count === 0
            ? 'Sin empleados asignados'
            : `${loc.employee_count} empleado${loc.employee_count === 1 ? '' : 's'}`}
        </span>
      </div>
    </div>
  );
}

function LocationModal({ initial, onClose, onSave, saving, error }) {
  const [form, setForm] = useState({
    name:    initial?.name    || '',
    city:    initial?.city    || '',
    address: initial?.address || '',
  });
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-slate-100">
          <h3 className="font-bold text-slate-800">{initial ? 'Editar sede' : 'Nueva sede'}</h3>
          <button onClick={onClose} className="w-8 h-8 rounded-lg hover:bg-slate-100 grid place-items-center text-slate-400">
            <X size={16} />
          </button>
        </div>

        <div className="px-6 py-5 space-y-4">
          <div>
            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide block mb-1">Nombre *</label>
            <input
              value={form.name}
              onChange={e => set('name', e.target.value)}
              placeholder="Ej: Sede Medellín, Sucursal Norte..."
              className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100"
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide block mb-1">Ciudad</label>
            <input
              value={form.city}
              onChange={e => set('city', e.target.value)}
              placeholder="Medellín, Bogotá..."
              className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100"
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide block mb-1">Dirección</label>
            <input
              value={form.address}
              onChange={e => set('address', e.target.value)}
              placeholder="Calle 50 #10-20..."
              className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100"
            />
          </div>

          {error && (
            <div className="flex items-start gap-2 bg-red-50 text-red-700 rounded-xl px-3 py-2.5 text-sm">
              <AlertTriangle size={15} className="shrink-0 mt-0.5" />
              {error}
            </div>
          )}
        </div>

        <div className="px-6 pb-5 flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 rounded-xl border border-slate-200 text-sm text-slate-600 hover:bg-slate-50 transition">
            Cancelar
          </button>
          <button
            onClick={() => onSave(form, initial?.id)}
            disabled={!form.name.trim() || saving}
            className="px-5 py-2 rounded-xl bg-brand-500 hover:bg-brand-600 text-white text-sm font-medium disabled:opacity-50 transition flex items-center gap-2"
          >
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
            {initial ? 'Guardar cambios' : 'Crear sede'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function Locations() {
  const qc = useQueryClient();
  const { plan } = useSubscription();
  const [modal, setModal] = useState(null); // null | { mode: 'create'|'edit', loc?: {} }
  const [modalError, setModalError] = useState('');
  const [toggleError, setToggleError] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['locations'],
    queryFn: () => api('/api/locations'),
  });

  const locations   = data?.items || [];
  const maxLoc      = data?.max_locations ?? 1;
  const activeLocs  = locations.filter(l => l.is_active);
  const atLimit     = activeLocs.length >= maxLoc;

  const saveMut = useMutation({
    mutationFn: ({ form, id }) =>
      id
        ? api('/api/locations', { method: 'PATCH', body: { id, ...form } })
        : api('/api/locations', { method: 'POST', body: form }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['locations'] });
      setModal(null);
      setModalError('');
    },
    onError: e => setModalError(e.message),
  });

  const toggleMut = useMutation({
    mutationFn: ({ id, is_active }) =>
      is_active
        ? api('/api/locations', { method: 'DELETE', body: { id } })
        : api('/api/locations', { method: 'PATCH', body: { id, is_active: true } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['locations'] }),
    onError: e => setToggleError(e.message),
  });

  const openCreate = () => {
    setModalError('');
    setModal({ mode: 'create' });
  };
  const openEdit = (loc) => {
    setModalError('');
    setModal({ mode: 'edit', loc });
  };

  return (
    <div className="p-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <Building2 size={24} className="text-brand-500" />
            Sedes
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            {activeLocs.length} de {maxLoc === 999 ? '∞' : maxLoc} sedes activas
          </p>
        </div>
        <button
          onClick={openCreate}
          disabled={atLimit && maxLoc !== 999}
          className="flex items-center gap-2 bg-brand-500 hover:bg-brand-600 disabled:opacity-50 text-white px-4 py-2.5 rounded-xl text-sm font-medium transition"
          title={atLimit ? `Límite de ${maxLoc} sedes alcanzado` : 'Nueva sede'}
        >
          <Plus size={16} />
          Nueva sede
        </button>
      </div>

      {/* Límite alcanzado */}
      {atLimit && maxLoc !== 999 && (
        <div className="mb-5 flex items-start gap-2 bg-amber-50 border border-amber-200 text-amber-800 rounded-xl px-4 py-3 text-sm">
          <AlertTriangle size={16} className="shrink-0 mt-0.5" />
          <span>Tu plan <strong>{plan}</strong> permite máximo {maxLoc} sede{maxLoc === 1 ? '' : 's'}.
            {' '}<a href="/suscripcion" className="underline font-medium">Actualiza tu plan</a> para agregar más.</span>
        </div>
      )}

      {/* Error toggle */}
      {toggleError && (
        <div className="mb-4 flex items-start gap-2 bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm">
          <AlertTriangle size={15} className="shrink-0 mt-0.5" />
          {toggleError}
          <button onClick={() => setToggleError('')} className="ml-auto"><X size={14} /></button>
        </div>
      )}

      {/* Grid de sedes */}
      {isLoading ? (
        <div className="grid place-items-center py-20">
          <Loader2 size={28} className="animate-spin text-slate-300" />
        </div>
      ) : locations.length === 0 ? (
        <div className="text-center py-20 text-slate-400">
          <Building2 size={40} className="mx-auto mb-3 opacity-30" />
          <p>No tienes sedes configuradas</p>
          <button onClick={openCreate} className="mt-3 text-brand-500 text-sm underline">Crear primera sede</button>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {locations.map(loc => (
            <LocationCard
              key={loc.id}
              loc={loc}
              onEdit={openEdit}
              onToggle={loc => {
                setToggleError('');
                toggleMut.mutate({ id: loc.id, is_active: loc.is_active });
              }}
            />
          ))}
        </div>
      )}

      {/* Modal crear/editar */}
      {modal && (
        <LocationModal
          initial={modal.loc}
          onClose={() => setModal(null)}
          onSave={(form, id) => saveMut.mutate({ form, id })}
          saving={saveMut.isPending}
          error={modalError}
        />
      )}
    </div>
  );
}
