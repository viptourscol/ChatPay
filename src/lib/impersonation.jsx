/**
 * src/lib/impersonation.js
 *
 * Contexto React para que el Super Admin pueda "cambiar" a otra empresa.
 * Persiste en sessionStorage (se pierde al cerrar la pestaña).
 */
import { createContext, useContext, useState, useCallback } from 'react';

const STORAGE_KEY = 'chatpay_impersonating';

function load() {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export const ImpersonationContext = createContext({
  impersonating: null,     // { id, name, plan } | null
  startImpersonating: () => {},
  stopImpersonating: () => {},
});

export function ImpersonationProvider({ children }) {
  const [impersonating, setImpersonating] = useState(load);

  const startImpersonating = useCallback((company) => {
    const data = { id: company.id, name: company.name, plan: company.plan };
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    setImpersonating(data);
  }, []);

  const stopImpersonating = useCallback(() => {
    sessionStorage.removeItem(STORAGE_KEY);
    setImpersonating(null);
  }, []);

  return (
    <ImpersonationContext.Provider value={{ impersonating, startImpersonating, stopImpersonating }}>
      {children}
    </ImpersonationContext.Provider>
  );
}

export function useImpersonation() {
  return useContext(ImpersonationContext);
}
