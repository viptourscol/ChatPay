/**
 * Sistema de Toast global para ChatPay.
 *
 * Uso:
 *   import { useToast } from './Toast.jsx';
 *   const toast = useToast();
 *   toast.success('Empleado agregado correctamente');
 *   toast.error('No puedes agregar más empleados en este plan');
 *   toast.warning('Estás cerca del límite de verificaciones');
 *   toast.info('Recuerda renovar tu plan');
 *
 * En App.jsx envuelve tu árbol con <ToastProvider> y agrega <ToastContainer />.
 */

import { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { CheckCircle2, XCircle, AlertTriangle, Info, X, ArrowRight } from 'lucide-react';

/* ─── Contexto ──────────────────────────────────────────────────── */
const ToastCtx = createContext(null);

let _idSeq = 0;

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const remove = useCallback((id) =>
    setToasts(prev => prev.filter(t => t.id !== id)), []);

  const add = useCallback(({ type = 'info', title, message, action, duration = 5000 }) => {
    const id = ++_idSeq;
    setToasts(prev => [...prev.slice(-4), { id, type, title, message, action }]);
    if (duration > 0) setTimeout(() => remove(id), duration);
    return id;
  }, [remove]);

  const toast = {
    success: (msg, opts) => add({ type: 'success', message: msg, ...opts }),
    error:   (msg, opts) => add({ type: 'error',   message: msg, duration: 8000, ...opts }),
    warning: (msg, opts) => add({ type: 'warning', message: msg, ...opts }),
    info:    (msg, opts) => add({ type: 'info',    message: msg, ...opts }),
    dismiss: remove,
  };

  return (
    <ToastCtx.Provider value={toast}>
      {children}
      <ToastContainer toasts={toasts} onDismiss={remove} />
    </ToastCtx.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastCtx);
  if (!ctx) throw new Error('useToast debe usarse dentro de <ToastProvider>');
  return ctx;
}

/* ─── Config visual por tipo ────────────────────────────────────── */
const CONFIGS = {
  success: {
    Icon: CheckCircle2,
    bar:  'bg-emerald-500',
    icon: 'text-emerald-500',
    bg:   'bg-white',
    border: 'border-emerald-200',
    title: 'Éxito',
  },
  error: {
    Icon: XCircle,
    bar:  'bg-red-500',
    icon: 'text-red-500',
    bg:   'bg-white',
    border: 'border-red-200',
    title: 'Error',
  },
  warning: {
    Icon: AlertTriangle,
    bar:  'bg-amber-400',
    icon: 'text-amber-500',
    bg:   'bg-white',
    border: 'border-amber-200',
    title: 'Atención',
  },
  info: {
    Icon: Info,
    bar:  'bg-blue-500',
    icon: 'text-blue-500',
    bg:   'bg-white',
    border: 'border-blue-200',
    title: 'Info',
  },
};

/* ─── Toast individual ──────────────────────────────────────────── */
function ToastItem({ toast, onDismiss }) {
  const [visible, setVisible] = useState(false);
  const cfg = CONFIGS[toast.type] || CONFIGS.info;
  const Icon = cfg.Icon;

  useEffect(() => {
    // Pequeño delay para activar la animación de entrada
    const t = setTimeout(() => setVisible(true), 10);
    return () => clearTimeout(t);
  }, []);

  const handleDismiss = () => {
    setVisible(false);
    setTimeout(() => onDismiss(toast.id), 300);
  };

  return (
    <div
      className={`
        relative flex items-start gap-3 w-full max-w-sm
        ${cfg.bg} border ${cfg.border} rounded-2xl shadow-lg shadow-slate-200/60
        px-4 py-3.5 overflow-hidden
        transition-all duration-300 ease-out
        ${visible ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-8'}
      `}
      role="alert"
    >
      {/* Barra de color izquierda */}
      <div className={`absolute left-0 top-0 bottom-0 w-1 ${cfg.bar} rounded-l-2xl`} />

      {/* Icono */}
      <div className="shrink-0 mt-0.5 ml-1">
        <Icon size={18} className={cfg.icon} />
      </div>

      {/* Contenido */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-slate-800">
          {toast.title || cfg.title}
        </p>
        {toast.message && (
          <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">
            {toast.message}
          </p>
        )}
        {toast.action && (
          <a
            href={toast.action.href}
            onClick={toast.action.onClick}
            className={`inline-flex items-center gap-1 text-xs font-semibold mt-2 ${cfg.icon} hover:underline`}
          >
            {toast.action.label} <ArrowRight size={11} />
          </a>
        )}
      </div>

      {/* Botón cerrar */}
      <button
        onClick={handleDismiss}
        className="shrink-0 w-6 h-6 rounded-lg bg-slate-100 hover:bg-slate-200 grid place-items-center transition-colors"
      >
        <X size={12} className="text-slate-500" />
      </button>
    </div>
  );
}

/* ─── Contenedor global ─────────────────────────────────────────── */
function ToastContainer({ toasts, onDismiss }) {
  if (toasts.length === 0) return null;
  return (
    <div className="fixed bottom-5 right-5 z-[9999] flex flex-col gap-2.5 items-end pointer-events-none">
      {toasts.map(t => (
        <div key={t.id} className="pointer-events-auto w-full max-w-sm">
          <ToastItem toast={t} onDismiss={onDismiss} />
        </div>
      ))}
    </div>
  );
}
