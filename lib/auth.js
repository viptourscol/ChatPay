import { supabaseAdmin } from './supabase.js';

/**
 * Verifica el JWT de Supabase enviado por el frontend.
 * Devuelve el user o lanza si no es válido.
 */
export async function requireUser(req, res) {
  const auth = req.headers.authorization || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : null;
  if (!token) {
    res.status(401).json({ error: 'unauthorized' });
    return null;
  }
  const { data, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !data?.user) {
    res.status(401).json({ error: 'invalid token' });
    return null;
  }
  return data.user;
}
