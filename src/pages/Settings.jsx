import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api.js';
import { supabase } from '../lib/supabase.js';
import { useToast } from '../components/Toast.jsx';
import {
  Building2, Users, Mail, Tag, Code2,
  Clipboard, Check, User, Lock, Smartphone, Landmark,
  RefreshCw, Loader2, CheckCircle2, Save, Zap,
  PlusCircle, Trash2, CreditCard, Info, ChevronDown, ChevronUp, Copy
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
  { id: 'sms',        label: 'SMS Backup', Icon: Smartphone },
  { id: 'api',        label: 'API Docs',   Icon: Code2 },
];

const WEBHOOK_URL = 'https://chat-pay-six.vercel.app/api/webhook?provider=sms';

function CopyBtn({ text, label = 'Copiar' }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={() => { navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 text-xs font-medium transition-colors shrink-0"
    >
      {copied ? <Check size={12} className="text-emerald-600" /> : <Copy size={12} />}
      {copied ? 'Copiado' : label}
    </button>
  );
}

function InstructionBlock({ title, subtitle, iconColor, children }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border border-slate-200 rounded-xl overflow-hidden">
      <button onClick={() => setOpen(!open)} className="w-full flex items-center justify-between p-4 text-left hover:bg-slate-50 transition-colors">
        <div className="flex items-center gap-3">
          <div className={`w-8 h-8 rounded-lg grid place-items-center shrink-0 ${iconColor}`}>
            <Smartphone size={16} />
          </div>
          <div>
            <p className="font-medium text-slate-800 text-sm">{title}</p>
            <p className="text-xs text-slate-500">{subtitle}</p>
          </div>
        </div>
        {open ? <ChevronUp size={16} className="text-slate-400" /> : <ChevronDown size={16} className="text-slate-400" />}
      </button>
      {open && <div className="px-4 pb-4 border-t border-slate-100">{children}</div>}
    </div>
  );
}

function TabSms() {
  const qc = useQueryClient();
  const [phone, setPhone] = useState('');
  const [saved, setSaved] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['sms-token'],
    queryFn: () => api('/api/stats', { query: { resource: 'sms-token' } }),
  });

  if (data?.sms_phone_number && !phone) setPhone(data.sms_phone_number);

  const token = data?.sms_webhook_token;
  const currentPhone = data?.sms_phone_number || '';

  const savePhone = useMutation({
    mutationFn: () => api('/api/stats', { method: 'POST', query: { resource: 'sms-token' }, body: { phone } }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['sms-token'] }); setSaved(true); setTimeout(() => setSaved(false), 2000); }
  });

  const rotateToken = useMutation({
    mutationFn: () => api('/api/stats', { method: 'POST', query: { resource: 'sms-token' }, body: { rotate: true } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['sms-token'] })
  });

  const migrationPending = !token && !isLoading;

  return (
    <div className="space-y-6">
      <div>
        <h3 className="font-semibold text-slate-800 mb-1">Respaldo por SMS bancarios</h3>
        <p className="text-slate-500 text-sm">
          Cuando el correo del banco falla o llega tarde, el sistema puede recibir la notificación
          de pago directamente desde el SMS bancario. Configura tu número y activa el reenvío automático.
        </p>
      </div>

      {migrationPending && (
        <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-700">
          <Info size={15} className="shrink-0 mt-0.5" />
          <span>Activa esta funcionalidad ejecutando la migración <strong>0015</strong> en el SQL Editor de Supabase.</span>
        </div>
      )}

      {/* Número de celular */}
      <div>
        <label className="label">Número de celular que recibe alertas del banco</label>
        <p className="text-xs text-slate-400 mb-2">El número que el banco tiene registrado para enviarle alertas SMS.</p>
        <div className="flex gap-2">
          <input
            className="input flex-1"
            placeholder="+573001234567"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            disabled={migrationPending}
          />
          <button
            className="btn btn-primary flex items-center gap-2 shrink-0"
            onClick={() => savePhone.mutate()}
            disabled={savePhone.isPending || phone === currentPhone || migrationPending}
          >
            {saved ? <Check size={15} /> : <Save size={15} />}
            {saved ? 'Guardado' : 'Guardar'}
          </button>
        </div>
      </div>

      {/* Token */}
      {!migrationPending && (
        <div>
          <label className="label">Token del webhook SMS</label>
          <p className="text-xs text-slate-400 mb-2">Úsalo para autenticar el reenvío desde tu celular. No lo compartas.</p>
          {isLoading ? (
            <div className="h-10 bg-slate-100 rounded-xl animate-pulse" />
          ) : (
            <div className="flex items-center gap-2">
              <code className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-xs font-mono text-slate-700 truncate">
                {token}
              </code>
              <CopyBtn text={token} />
              <button
                onClick={() => rotateToken.mutate()}
                disabled={rotateToken.isPending}
                className="p-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-500 transition-colors"
                title="Rotar token"
              >
                <RefreshCw size={14} className={rotateToken.isPending ? 'animate-spin' : ''} />
              </button>
            </div>
          )}
          {token && (
            <div className="flex items-start gap-2 mt-2 p-2.5 bg-amber-50 rounded-lg">
              <Info size={12} className="text-amber-500 mt-0.5 shrink-0" />
              <p className="text-xs text-amber-700">Si rotas el token, actualízalo en la automatización de tu celular.</p>
            </div>
          )}
        </div>
      )}

      {/* Instrucciones */}
      {token && (
        <div className="space-y-3">
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Instrucciones de configuración</p>

          <InstructionBlock title="Android — MacroDroid" subtitle="Automatización gratuita, sin root" iconColor="bg-green-50 text-green-600">
            <ol className="space-y-3 list-decimal list-inside text-sm text-slate-600 pt-3">
              <li>Descarga <strong>MacroDroid</strong> desde Google Play (gratis).</li>
              <li>Crea una macro → Trigger: <em>SMS recibido</em> → Remitente contiene: <code className="bg-slate-100 px-1 rounded">Bancolombia</code></li>
              <li className="space-y-2">Acción: <em>Solicitud HTTP</em>:
                <div className="mt-2 space-y-1.5">
                  {[['URL', WEBHOOK_URL], ['Método', 'POST'], ['Header', `Authorization: Bearer ${token}`]].map(([k, v]) => (
                    <div key={k} className="flex items-center justify-between bg-slate-50 rounded-lg px-3 py-2 text-xs">
                      <span className="text-slate-400 shrink-0 mr-2">{k}</span>
                      <div className="flex items-center gap-2 min-w-0">
                        <code className="font-mono text-slate-700 truncate">{v}</code>
                        <CopyBtn text={v} />
                      </div>
                    </div>
                  ))}
                  <div className="bg-slate-50 rounded-lg px-3 py-2 text-xs">
                    <p className="text-slate-400 mb-1">Body (JSON) — usa variables de MacroDroid:</p>
                    <code className="font-mono text-slate-700 break-all">{'{"text": "[SMS_BODY]", "source": "android", "received_at": "[UNIX_TIME_MS]"}'}</code>
                    <CopyBtn text='{"text": "[SMS_BODY]", "source": "android", "received_at": "[UNIX_TIME_MS]"}' label="Copiar body" />
                  </div>
                </div>
              </li>
              <li>Guarda y activa la macro. Prueba con un pago real.</li>
            </ol>
          </InstructionBlock>

          <InstructionBlock title="iOS — Automatizaciones nativas" subtitle="App Atajos integrada, sin apps de terceros" iconColor="bg-blue-50 text-blue-600">
            <ol className="space-y-3 list-decimal list-inside text-sm text-slate-600 pt-3">
              <li>Abre la app <strong>Atajos</strong> (Shortcuts) → pestaña <em>Automatización</em>.</li>
              <li>Nueva automatización → <em>Mensaje</em> → Remitente: agrega el contacto de Bancolombia (guárdalo antes).</li>
              <li className="space-y-2">Acción: <em>Obtener contenido de URL</em>:
                <div className="mt-2 space-y-1.5">
                  {[['URL', WEBHOOK_URL], ['Método', 'POST'], ['Header', `Authorization: Bearer ${token}`]].map(([k, v]) => (
                    <div key={k} className="flex items-center justify-between bg-slate-50 rounded-lg px-3 py-2 text-xs">
                      <span className="text-slate-400 shrink-0 mr-2">{k}</span>
                      <div className="flex items-center gap-2 min-w-0">
                        <code className="font-mono text-slate-700 truncate">{v}</code>
                        <CopyBtn text={v} />
                      </div>
                    </div>
                  ))}
                  <div className="bg-slate-50 rounded-lg px-3 py-2 text-xs">
                    <p className="text-slate-400 mb-1">Cuerpo JSON — usa la variable <em>Contenido del mensaje</em>:</p>
                    <code className="font-mono text-slate-700 break-all">{'{"text": "CONTENIDO_MENSAJE", "source": "ios"}'}</code>
                  </div>
                </div>
              </li>
              <li>Desactiva <em>"Preguntar antes de ejecutar"</em>.</li>
              <li className="text-amber-600">Guarda el número del banco en tus contactos — iOS solo detecta mensajes de contactos guardados.</li>
            </ol>
          </InstructionBlock>
        </div>
      )}
    </div>
  );
}

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
    setForm({ name: data.name || '', nit: data.nit || '', tax_regime: data.tax_regime || '', address: data.address || '', phone: data.phone || '', bancolombia_email: data.bancolombia_email || '', notification_whatsapp: Array.isArray(data.notification_whatsapp) ? data.notification_whatsapp : [] });
  }

  const mutation = useMutation({
    mutationFn: (body) => api('/api/settings', { method: 'PUT', body }),
    onSuccess: (result) => {
      // Actualizar form con datos guardados para reflejar lo que devolvió el servidor
      setForm({ name: result.name || '', nit: result.nit || '', tax_regime: result.tax_regime || '', address: result.address || '', phone: result.phone || '', bancolombia_email: result.bancolombia_email || '', notification_whatsapp: Array.isArray(result.notification_whatsapp) ? result.notification_whatsapp : [] });
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

      {/* Números de notificación WhatsApp */}
      <div className="rounded-xl bg-indigo-50 border border-indigo-100 p-4 mb-6">
        <div className="flex items-center justify-between mb-1">
          <div className="text-sm font-medium text-indigo-700 flex items-center gap-1.5">
            <Smartphone size={14} /> Números de notificación WhatsApp
          </div>
          {form.notification_whatsapp.some(c => c.active) && (
            <span className="text-xs bg-indigo-200 text-indigo-700 px-2 py-0.5 rounded-full font-semibold">
              {form.notification_whatsapp.filter(c => c.active).length} activo{form.notification_whatsapp.filter(c => c.active).length !== 1 ? 's' : ''}
            </span>
          )}
        </div>
        <p className="text-xs text-indigo-600 mb-3">
          Cuando se verifique un pago, ChatPay enviará un resumen a los números activos. Puedes pausar alguno sin eliminarlo.
        </p>

        <div className="space-y-2 mb-3">
          {form.notification_whatsapp.length === 0 && (
            <p className="text-xs text-indigo-400 italic text-center py-2">Sin números configurados</p>
          )}
              {form.notification_whatsapp.map((contact, idx) => {
            const maxNums = ['empresarial','enterprise'].includes(data?.plan) ? 2 : ['basico','pro','business'].includes(data?.plan) ? 1 : 0;
            const activeCount = form.notification_whatsapp.filter(c => c.active).length;
            const canActivate = contact.active || activeCount < maxNums;
            return (
            <div key={idx} className="flex items-center gap-2 bg-white border border-indigo-100 rounded-lg px-3 py-2">
              <input
                className="flex-1 text-sm bg-transparent outline-none text-slate-700 placeholder-slate-400"
                value={contact.number}
                onChange={(e) => {
                  const next = [...form.notification_whatsapp];
                  next[idx] = { ...next[idx], number: e.target.value };
                  set('notification_whatsapp', next);
                }}
                placeholder="+573001234567"
                type="tel"
              />
              {/* Toggle activo/inactivo */}
              <button
                type="button"
                disabled={!canActivate}
                title={!canActivate ? 'Límite de números activos alcanzado. Desactiva otro primero.' : contact.active ? 'Pausar notificaciones' : 'Activar notificaciones'}
                onClick={() => {
                  if (!canActivate) return;
                  const next = [...form.notification_whatsapp];
                  next[idx] = { ...next[idx], active: !next[idx].active };
                  set('notification_whatsapp', next);
                }}
                className={`relative inline-flex h-5 w-9 flex-shrink-0 rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none ${
                  !canActivate ? 'opacity-40 cursor-not-allowed bg-slate-200' : 'cursor-pointer ' + (contact.active ? 'bg-indigo-500' : 'bg-slate-300')
                }`}
              >
                <span className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${contact.active ? 'translate-x-4' : 'translate-x-0'}`} />
              </button>
              <button
                type="button"
                title="Eliminar"
                onClick={() => {
                  const next = form.notification_whatsapp.filter((_, i) => i !== idx);
                  set('notification_whatsapp', next);
                }}
                className="p-1 rounded hover:bg-red-50 text-slate-400 hover:text-red-500 transition"
              >
                <Trash2 size={14} />
              </button>
            </div>
            );
          })}
        </div>

        <button
          type="button"
          onClick={() => {
            const maxNums = ['empresarial','enterprise'].includes(data?.plan) ? 2 : ['basico','pro','business'].includes(data?.plan) ? 1 : 0;
            const activeCount = form.notification_whatsapp.filter(c => c.active).length;
            if (activeCount >= maxNums) return;
            set('notification_whatsapp', [...form.notification_whatsapp, { number: '', active: true }]);
          }}
          disabled={(() => {
            const maxNums = ['empresarial','enterprise'].includes(data?.plan) ? 2 : ['basico','pro','business'].includes(data?.plan) ? 1 : 0;
            return form.notification_whatsapp.filter(c => c.active).length >= maxNums;
          })()}
          className="flex items-center gap-1.5 text-xs text-indigo-600 hover:text-indigo-800 font-medium transition disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <PlusCircle size={14} /> Agregar número
        </button>
        <p className="text-xs text-indigo-400 mt-2">
          Formato internacional: +57 seguido de 10 dígitos.
          {(() => {
            const maxNums = ['empresarial','enterprise'].includes(data?.plan) ? 2 : ['basico','pro','business'].includes(data?.plan) ? 1 : 0;
            if (!data?.plan || maxNums === 0) return <span className="text-amber-500 font-medium"> No disponible en tu plan actual.</span>;
            return <span> Máx. {maxNums} número{maxNums !== 1 ? 's' : ''} en tu plan.</span>;
          })()}
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
  const toast = useToast();
  const { data: accounts = [], isLoading } = useQuery({
    queryKey: ['bank-accounts'],
    queryFn: () => api('/api/bank-accounts'),
  });
  const [form, setForm] = useState({ label: '', bank_name: 'Bancolombia', bancolombia_email: '' });
  const [adding, setAdding] = useState(false);
  const [deletingId, setDeletingId] = useState(null);

  const handleAdd = async () => {
    if (!form.bancolombia_email.trim()) {
      toast.warning('El email del banco es requerido');
      return;
    }
    setAdding(true);
    try {
      await api('/api/bank-accounts', { method: 'POST', body: form });
      qc.invalidateQueries({ queryKey: ['bank-accounts'] });
      setForm({ label: '', bank_name: 'Bancolombia', bancolombia_email: '' });
      toast.success('Cuenta bancaria agregada');
    } catch (e) {
      const isLimit = e.message?.toLowerCase().includes('máximo') || e.message?.toLowerCase().includes('límite');
      toast.error(e.message || 'Error al agregar cuenta', {
        title: isLimit ? 'Límite de plan alcanzado' : 'Error',
        ...(isLimit && { action: { label: 'Ver planes', href: '/suscripcion' } }),
      });
    } finally { setAdding(false); }
  };

  const handleDelete = async (id) => {
    setDeletingId(id);
    try {
      await fetch(`/api/bank-accounts?id=${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}` }
      });
      qc.invalidateQueries({ queryKey: ['bank-accounts'] });
      toast.success('Cuenta eliminada');
    } catch {
      toast.error('No se pudo eliminar la cuenta');
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
        </div>        <button onClick={handleAdd} disabled={adding} className="btn btn-primary w-full">
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
    sms: <TabSms />,
    api: <TabApiDocs />
  };

  return (
    <div>
      <header className="mb-6">
        <h1 className="font-serif text-3xl">Configuración</h1>
        <p className="text-slate-500 text-sm">Gestión de la información y configuración de tu cuenta.</p>
      </header>

      {/* Tabs — segment control */}
      <div className="flex gap-1 p-1 bg-slate-100 rounded-xl mb-6 overflow-x-auto">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-1.5 px-3.5 py-2 text-sm font-medium whitespace-nowrap rounded-lg transition-all duration-150 ${
              activeTab === tab.id
                ? 'bg-white shadow-sm text-brand-700 shadow-slate-200'
                : 'text-slate-500 hover:text-slate-800 hover:bg-white/60'
            }`}
          >
            <tab.Icon size={14} aria-hidden />
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
