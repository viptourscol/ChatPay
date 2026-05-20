import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api.js';
import { supabase } from '../lib/supabase.js';
import {
  Building2, Users, Mail, Tag, Code2,
  Clipboard, Check, User, Lock, Smartphone, Landmark,
  RefreshCw, Loader2, CheckCircle2, Save, Zap,
  PlusCircle, Trash2, CreditCard
} from 'lucide-react';

const TAX_REGIMES = [
  { value: '', label: 'Seleccionar régimen' },
  { value: 'simplificado', label: 'Régimen Simplificado' },
  { value: 'comun', label: 'Régimen Común' },
  { value: 'gran_contribuyente', label: 'Gran Contribuyente' },
  { value: 'no_responsable', label: 'No Responsable de IVA' },
  { value: 'simple', label: 'Régimen Simple de Tributación' }
];

const TABS = [
  { id: 'empresa',    label: 'Empresa',    Icon: Building2 },
  { id: 'usuarios',   label: 'Usuarios',   Icon: Users },
  { id: 'conexiones', label: 'Conexiones', Icon: Mail },
  { id: 'egresos',    label: 'Egresos',    Icon: Tag },
  { id: 'api',        label: 'API Docs',   Icon: Code2 },
];

// ─── Tab: Empresa ────────────────────────────────────────────────
function TabEmpresa() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ['settings'],
    queryFn: () => api('/api/settings')
  });
  const [form, setForm] = useState(null);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState(null);

  // Inicializar form cuando lleguen datos
  if (data && !form) {
    setForm({ name: data.name || '', nit: data.nit || '', tax_regime: data.tax_regime || '', address: data.address || '', phone: data.phone || '', bancolombia_email: data.bancolombia_email || '' });
  }

  const mutation = useMutation({
    mutationFn: (body) => api('/api/settings', { method: 'PUT', body }),
    onSuccess: (result) => {
      // Actualizar form con datos guardados para reflejar lo que devolvió el servidor
      setForm({ name: result.name || '', nit: result.nit || '', tax_regime: result.tax_regime || '', address: result.address || '', phone: result.phone || '', bancolombia_email: result.bancolombia_email || '' });
      qc.invalidateQueries({ queryKey: ['settings'] });
      setSaved(true);
      setSaveError(null);
      setTimeout(() => setSaved(false), 3000);
    },
    onError: (err) => { setSaveError(err.message || 'Error al guardar'); }
  });

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  function copyId() {
    if (data?.id) navigator.clipboard.writeText(data.id);
  }

  if (isLoading || !form) return <div className="text-slate-400 py-8 text-center">Cargando…</div>;

  return (
    <div>
      <h2 className="font-semibold text-lg mb-5 flex items-center gap-2"><Building2 size={18} /> Información de la Empresa</h2>

      {/* ID de la empresa */}
      {data?.id && (
        <div className="rounded-xl bg-blue-50 border border-blue-100 p-4 mb-4">
          <div className="text-sm font-medium text-blue-700 mb-0.5">ID de la Empresa</div>
          <div className="text-xs text-blue-500 mb-2">Usa este ID para integraciones y APIs</div>
          <div className="flex items-center gap-2">
            <code className="flex-1 font-mono text-sm text-blue-800 bg-blue-100 rounded px-2 py-1 break-all">{data.id}</code>
            <button
              onClick={copyId}
              className="p-1.5 rounded hover:bg-blue-200 transition text-blue-600"
              title="Copiar ID"
            >
              <Clipboard size={15} />
            </button>
          </div>
        </div>
      )}

      {/* Email Bancolombia para routing automático */}
      <div className="rounded-xl bg-emerald-50 border border-emerald-100 p-4 mb-6">
        <div className="text-sm font-medium text-emerald-700 mb-0.5 flex items-center gap-1.5">
          <Landmark size={14} /> Email de alertas Bancolombia
        </div>
        <div className="text-xs text-emerald-600 mb-2">
          Correo donde Bancolombia envía las notificaciones de tu cuenta. ChatPay lo usa para identificar tus pagos automáticamente.
        </div>
        <input
          className="input w-full bg-white"
          value={form?.bancolombia_email || ''}
          onChange={(e) => set('bancolombia_email', e.target.value)}
          placeholder="Ej: mipago@gmail.com"
          type="email"
        />
        <p className="text-xs text-emerald-500 mt-2">
          Plan actual: <strong className="capitalize">{data.plan || 'free'}</strong> · Máx. {data.max_employees ?? 3} empleados
        </p>
      </div>

      <div className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="text-sm text-slate-600 mb-1 block">Nombre de la Empresa</label>
            <input className="input w-full" value={form.name} onChange={(e) => set('name', e.target.value)} placeholder="Ej: Mi Empresa SAS" />
          </div>
          <div>
            <label className="text-sm text-slate-600 mb-1 block">NIT</label>
            <input className="input w-full" value={form.nit} onChange={(e) => set('nit', e.target.value)} placeholder="Ej: 1063302962" />
          </div>
        </div>

        <div>
          <label className="text-sm text-slate-600 mb-1 block">Régimen Tributario</label>
          <select className="input w-full" value={form.tax_regime} onChange={(e) => set('tax_regime', e.target.value)}>
            {TAX_REGIMES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
          </select>
        </div>

        <div>
          <label className="text-sm text-slate-600 mb-1 block">Dirección</label>
          <input className="input w-full" value={form.address} onChange={(e) => set('address', e.target.value)} placeholder="Ej: CALLE 14 CR 112 44" />
        </div>

        <div>
          <label className="text-sm text-slate-600 mb-1 block">Teléfono</label>
          <input className="input w-full" value={form.phone} onChange={(e) => set('phone', e.target.value)} placeholder="Ej: (601) 234-5678" />
        </div>

        {saveError && (
          <div className="text-red-600 text-sm bg-red-50 border border-red-200 rounded-lg px-3 py-2 mt-2">
            ⚠️ Error al guardar: {saveError}
          </div>
        )}
        <button
          className="btn btn-primary w-full mt-2"
          onClick={() => mutation.mutate(form)}
          disabled={mutation.isPending}
        >
          {mutation.isPending ? 'Guardando…' : saved ? <span className="flex items-center justify-center gap-1.5"><CheckCircle2 size={15} /> Información guardada</span> : <span className="flex items-center justify-center gap-1.5"><Save size={15} /> Guardar Información</span>}
        </button>
      </div>
    </div>
  );
}

// ─── Tab: Usuarios ───────────────────────────────────────────────
function TabUsuarios() {
  const [user, setUser] = useState(null);
  const [pwForm, setPwForm] = useState({ current: '', next: '', confirm: '' });
  const [pwMsg, setPwMsg] = useState(null);
  const [saving, setSaving] = useState(false);

  supabase.auth.getUser().then(({ data }) => { if (!user) setUser(data.user); });

  async function changePassword(e) {
    e.preventDefault();
    if (pwForm.next !== pwForm.confirm) { setPwMsg({ error: true, text: 'Las contraseñas no coinciden' }); return; }
    if (pwForm.next.length < 6) { setPwMsg({ error: true, text: 'La contraseña debe tener al menos 6 caracteres' }); return; }
    setSaving(true);
    const { error } = await supabase.auth.updateUser({ password: pwForm.next });
    setSaving(false);
    if (error) setPwMsg({ error: true, text: error.message });
    else { setPwMsg({ error: false, text: 'Contraseña actualizada correctamente' }); setPwForm({ current: '', next: '', confirm: '' }); }
    setTimeout(() => setPwMsg(null), 5000);
  }

  return (
    <div className="space-y-8 max-w-lg">
      <div>
        <h2 className="font-semibold text-lg mb-4 flex items-center gap-2"><User size={18} /> Tu cuenta</h2>
        <div className="rounded-xl border border-slate-200 p-4 space-y-3">
          <div>
            <div className="text-xs text-slate-500">Correo electrónico</div>
            <div className="font-medium">{user?.email || '—'}</div>
          </div>
          <div>
            <div className="text-xs text-slate-500">ID de usuario</div>
            <div className="font-mono text-xs text-slate-600 break-all">{user?.id || '—'}</div>
          </div>
          <div>
            <div className="text-xs text-slate-500">Cuenta creada</div>
            <div className="text-sm">{user?.created_at ? new Date(user.created_at).toLocaleDateString('es-CO', { dateStyle: 'long' }) : '—'}</div>
          </div>
        </div>
      </div>

      <div>
        <h2 className="font-semibold text-lg mb-4 flex items-center gap-2"><Lock size={18} /> Cambiar contraseña</h2>
        <form onSubmit={changePassword} className="space-y-3">
          <div>
            <label className="text-sm text-slate-600 mb-1 block">Nueva contraseña</label>
            <input type="password" className="input w-full" value={pwForm.next} onChange={(e) => setPwForm({ ...pwForm, next: e.target.value })} placeholder="Mínimo 6 caracteres" />
          </div>
          <div>
            <label className="text-sm text-slate-600 mb-1 block">Confirmar nueva contraseña</label>
            <input type="password" className="input w-full" value={pwForm.confirm} onChange={(e) => setPwForm({ ...pwForm, confirm: e.target.value })} placeholder="Repetir contraseña" />
          </div>
          {pwMsg && (
            <div className={`text-sm rounded px-3 py-2 ${pwMsg.error ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'}`}>
              {pwMsg.text}
            </div>
          )}
          <button type="submit" className="btn btn-primary w-full" disabled={saving}>
            {saving ? 'Actualizando…' : 'Actualizar contraseña'}
          </button>
        </form>
      </div>
    </div>
  );
}

// ─── Tab: Conexiones ─────────────────────────────────────────────
// ─── Tab: Conexiones ────────────────────────────────────────────
const BANKS = ['Bancolombia', 'Nequi', 'Daviplata', 'Davivienda', 'BBVA', 'Banco de Bogotá', 'Av Villas', 'Banco Popular', 'Otro'];

function TabBankAccounts() {
  const qc = useQueryClient();
  const { data: accounts = [], isLoading } = useQuery({
    queryKey: ['bank-accounts'],
    queryFn: () => api('/api/bank-accounts'),
  });
  const [form, setForm] = useState({ label: '', bank_name: 'Bancolombia', bancolombia_email: '' });
  const [adding, setAdding] = useState(false);
  const [err, setErr] = useState(null);
  const [deletingId, setDeletingId] = useState(null);

  const handleAdd = async () => {
    if (!form.bancolombia_email.trim()) return setErr('El email es requerido');
    setAdding(true); setErr(null);
    try {
      await api('/api/bank-accounts', { method: 'POST', body: form });
      qc.invalidateQueries({ queryKey: ['bank-accounts'] });
      setForm({ label: '', bank_name: 'Bancolombia', bancolombia_email: '' });
    } catch (e) { setErr(e.message); }
    finally { setAdding(false); }
  };

  const handleDelete = async (id) => {
    setDeletingId(id);
    try {
      await fetch(`/api/bank-accounts?id=${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}` }
      });
      qc.invalidateQueries({ queryKey: ['bank-accounts'] });
    } finally { setDeletingId(null); }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-slate-800 flex items-center gap-2"><CreditCard size={16} /> Cuentas bancarias</h3>
        <span className="text-xs text-slate-400">{accounts.length} cuenta{accounts.length !== 1 ? 's' : ''} registrada{accounts.length !== 1 ? 's' : ''}</span>
      </div>
      <p className="text-xs text-slate-500">Agrega los correos donde tus bancos envían las alertas de pago. ChatPay los usa para identificar automáticamente a qué empresa corresponde cada pago.</p>

      {/* Lista de cuentas */}
      {isLoading ? (
        <div className="text-slate-400 text-sm py-4 text-center"><Loader2 size={14} className="animate-spin inline mr-2" />Cargando…</div>
      ) : accounts.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 py-6 text-center text-slate-400 text-sm">
          No hay cuentas registradas aún. Agrega la primera abajo.
        </div>
      ) : (
        <div className="space-y-2">
          {accounts.map((acct) => (
            <div key={acct.id} className="flex items-center gap-3 p-3 rounded-xl border border-slate-200 bg-slate-50 animate-fade-in">
              <div className="w-9 h-9 rounded-lg bg-blue-100 text-blue-600 grid place-items-center shrink-0">
                <CreditCard size={15} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-slate-800 truncate">{acct.label || acct.bank_name}</div>
                <div className="text-xs text-slate-500 font-mono truncate">{acct.bancolombia_email}</div>
                <div className="text-[10px] text-slate-400 mt-0.5">{acct.bank_name}</div>
              </div>
              <button
                onClick={() => handleDelete(acct.id)}
                disabled={deletingId === acct.id}
                className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 transition-all active:scale-90"
                title="Eliminar cuenta"
              >
                {deletingId === acct.id ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Formulario agregar */}
      <div className="rounded-xl border border-slate-200 p-4 space-y-3 bg-white">
        <div className="text-sm font-medium text-slate-700 flex items-center gap-1.5"><PlusCircle size={14} className="text-brand-600" /> Agregar cuenta</div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-slate-500 mb-1 block">Banco</label>
            <select className="input" value={form.bank_name} onChange={(e) => setForm((f) => ({ ...f, bank_name: e.target.value }))}>
              {BANKS.map((b) => <option key={b} value={b}>{b}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs text-slate-500 mb-1 block">Etiqueta (opcional)</label>
            <input className="input" placeholder="Ej: Cuenta nómina" value={form.label} onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))} />
          </div>
        </div>
        <div>
          <label className="text-xs text-slate-500 mb-1 block">Correo donde el banco envía las alertas</label>
          <input className="input" type="email" placeholder="Ej: mipago@gmail.com" value={form.bancolombia_email} onChange={(e) => setForm((f) => ({ ...f, bancolombia_email: e.target.value }))} />
        </div>
        {err && <p className="text-red-600 text-xs">⚠️ {err}</p>}
        <button onClick={handleAdd} disabled={adding} className="btn btn-primary w-full">
          {adding ? <><Loader2 size={14} className="animate-spin" /> Agregando…</> : <><PlusCircle size={14} /> Agregar cuenta</>}
        </button>
      </div>
    </div>
  );
}

function TabConexiones() {
  const [user, setUser] = useState(null);
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState(null);
  supabase.auth.getUser().then(({ data }) => { if (!user) setUser(data?.user || null); });
  const meta = user?.user_metadata || {};

  async function triggerSync() {
    setSyncing(true);
    setSyncResult(null);
    try {
      const { api } = await import('../lib/api.js');
      const result = await api('/api/gmail/sync');
      setSyncResult({ ok: true, text: `Sync completado: ${result.inserted} nueva(s) transacción(es) de ${result.scanned} emails escaneados.` });
    } catch (err) {
      setSyncResult({ ok: false, text: `Error: ${err.message}` });
    } finally {
      setSyncing(false);
    }
  }

  return (
    <div className="space-y-6 max-w-xl">
      <h2 className="font-semibold text-lg mb-4 flex items-center gap-2"><Mail size={18} /> Conexiones activas</h2>

      {/* WhatsApp */}
      <div className="rounded-xl border border-slate-200 p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Smartphone size={22} className="text-slate-500" />
            <div>
              <div className="font-medium">WhatsApp Business</div>
              <div className="text-xs text-slate-500">Bot de verificación de comprobantes</div>
            </div>
          </div>
          <span className="badge bg-green-100 text-green-700">Activo</span>
        </div>
        <div className="text-sm text-slate-600">
          Número del bot: <span className="font-mono">{meta.whatsapp_number || 'No configurado'}</span>
        </div>
        <p className="text-xs text-slate-400 mt-2">
          Para cambiar el número de WhatsApp contacta soporte.
        </p>
      </div>

      {/* Bancolombia / Gmail */}
      <div className="rounded-xl border border-slate-200 p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Landmark size={22} className="text-slate-500" />
            <div>
              <div className="font-medium">Bancolombia (Gmail)</div>
              <div className="text-xs text-slate-500">Lectura de notificaciones de transferencias</div>
            </div>
          </div>
          <span className={`badge ${meta.gmail_connected ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
            {meta.gmail_connected ? 'Conectado' : 'Pendiente'}
          </span>
        </div>
        {meta.gmail_email && (
          <div className="text-sm text-slate-600">
            Correo: <span className="font-mono">{meta.gmail_email}</span>
          </div>
        )}
        {!meta.gmail_connected && (
          <p className="text-xs text-amber-600 mt-2">
            Ejecuta el script <code className="bg-amber-50 px-1 rounded">npm run gmail:auth</code> para conectar tu correo de Bancolombia.
          </p>
        )}
        {meta.gmail_connected && (
          <div className="mt-3 space-y-2">
            <div className="flex gap-2">
              <button
                onClick={triggerSync}
                disabled={syncing}
                className="btn btn-primary text-sm group"
              >
              {syncing
                ? <span className="flex items-center gap-1.5"><Loader2 size={14} className="animate-spin" /> Sincronizando…</span>
                : <span className="flex items-center gap-1.5"><RefreshCw size={14} className="transition-transform duration-300 group-hover:rotate-180" /> Sincronizar emails ahora</span>
              }
              </button>
            </div>
            <p className="text-xs text-slate-400">
              <Zap size={11} className="inline mb-0.5 text-amber-400" /> Las notificaciones push están activas — los emails de Bancolombia se procesan en segundos automáticamente.
            </p>
          </div>
        )}
        {syncResult && (
          <div className={`mt-3 text-sm rounded px-3 py-2 ${syncResult.ok ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
            {syncResult.text}
          </div>
        )}
      </div>

      {/* Cuentas bancarias múltiples */}
      <div className="rounded-xl border border-slate-200 p-4">
        <TabBankAccounts />
      </div>
    </div>
  );
}

// ─── Tab: Egresos (configuración de categorías) ──────────────────
function TabEgresos() {
  const DEFAULT_CATS = ['nómina', 'arriendo', 'servicios', 'proveedor', 'otro'];

  return (
    <div className="max-w-xl">
      <h2 className="font-semibold text-lg mb-2 flex items-center gap-2">🏷️ Configuración de Egresos</h2>
      <p className="text-sm text-slate-500 mb-6">Categorías disponibles para clasificar tus egresos.</p>

      <div className="space-y-2">
        {DEFAULT_CATS.map((cat) => (
          <div key={cat} className="flex items-center justify-between rounded-xl border border-slate-200 px-4 py-3">
            <span className="text-sm font-medium capitalize">{cat}</span>
            <span className="badge bg-green-100 text-green-700 text-xs">Activa</span>
          </div>
        ))}
      </div>

      <div className="mt-6 rounded-xl bg-slate-50 border border-slate-200 p-4 text-sm text-slate-500">
        ✨ La gestión de categorías personalizadas estará disponible próximamente.
      </div>
    </div>
  );
}

// ─── Tab: API Docs ────────────────────────────────────────────────
function TabApiDocs() {
  const BASE = window.location.origin;

  const endpoints = [
    { method: 'GET', path: '/api/stats', desc: 'Resumen de actividad del dashboard.' },
    { method: 'GET', path: '/api/verifications', desc: 'Lista de verificaciones con filtros opcionales (?status=real|fake|duplicate).' },
    { method: 'GET', path: '/api/ingresos', desc: 'Transacciones reales de Bancolombia (?from=&to=&min_amount=&max_amount=).' },
    { method: 'GET', path: '/api/egresos', desc: 'Lista de egresos (?from=&to=&category=).' },
    { method: 'POST', path: '/api/egresos', desc: 'Crear un egreso. Body: { description, amount, recipient, payment_date, method, category, notes }' },
    { method: 'PATCH', path: '/api/egresos', desc: 'Actualizar un egreso. Body: { id, ...campos }' },
    { method: 'DELETE', path: '/api/egresos?id=', desc: 'Eliminar un egreso por ID.' },
    { method: 'GET', path: '/api/employees', desc: 'Lista de empleados registrados.' },
    { method: 'GET', path: '/api/settings', desc: 'Configuración de la empresa del usuario autenticado.' },
    { method: 'PUT', path: '/api/settings', desc: 'Actualizar configuración. Body: { name, nit, tax_regime, address, phone }' }
  ];

  const methodColors = { GET: 'bg-blue-100 text-blue-700', POST: 'bg-green-100 text-green-700', PATCH: 'bg-amber-100 text-amber-700', DELETE: 'bg-red-100 text-red-700', PUT: 'bg-purple-100 text-purple-700' };

  return (
    <div>
      <h2 className="font-semibold text-lg mb-2 flex items-center gap-2">&lt;/&gt; API Reference</h2>
      <p className="text-sm text-slate-500 mb-1">
        Base URL: <code className="bg-slate-100 px-1 rounded">{BASE}</code>
      </p>
      <p className="text-sm text-slate-500 mb-6">
        Todas las rutas requieren header: <code className="bg-slate-100 px-1 rounded">Authorization: Bearer &lt;token&gt;</code>
      </p>

      <div className="space-y-2">
        {endpoints.map((e, i) => (
          <div key={i} className="rounded-xl border border-slate-200 px-4 py-3">
            <div className="flex items-center gap-3 mb-1">
              <span className={`badge text-xs font-mono font-bold ${methodColors[e.method]}`}>{e.method}</span>
              <code className="text-sm font-mono text-slate-800">{e.path}</code>
            </div>
            <p className="text-xs text-slate-500">{e.desc}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Página principal Settings ────────────────────────────────────
export default function Settings() {
  const [activeTab, setActiveTab] = useState('empresa');

  const tabContent = {
    empresa: <TabEmpresa />,
    usuarios: <TabUsuarios />,
    conexiones: <TabConexiones />,
    egresos: <TabEgresos />,
    api: <TabApiDocs />
  };

  return (
    <div>
      <header className="mb-6">
        <h1 className="font-serif text-3xl">Configuración</h1>
        <p className="text-slate-500 text-sm">Gestión de la información y configuración de tu cuenta.</p>
      </header>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-slate-200 mb-6 overflow-x-auto">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium whitespace-nowrap border-b-2 transition -mb-px ${
              activeTab === tab.id
                ? 'border-brand-600 text-brand-700'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <tab.Icon size={14} />
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      {/* Contenido del tab */}
      <div className="card">
        {tabContent[activeTab]}
      </div>
    </div>
  );
}
