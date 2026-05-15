import { useState } from 'react';
import { api } from '../lib/api.js';

function toCsv(rows) {
  if (!rows.length) return '';
  const headers = ['fecha', 'empleado', 'whatsapp', 'monto', 'referencia', 'remitente', 'estado'];
  const escape = (s) => `"${String(s ?? '').replace(/"/g, '""')}"`;
  const lines = [headers.join(',')];
  rows.forEach((v) => {
    lines.push([
      v.created_at,
      v.employees?.name || '',
      v.whatsapp_from || '',
      v.extracted_amount ?? '',
      v.extracted_reference ?? '',
      v.extracted_sender ?? '',
      v.status
    ].map(escape).join(','));
  });
  return lines.join('\n');
}

export default function Reports() {
  const today = new Date().toISOString().slice(0, 10);
  const monthAgo = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);
  const [from, setFrom] = useState(monthAgo);
  const [to, setTo] = useState(today);
  const [loading, setLoading] = useState(false);

  const download = async () => {
    setLoading(true);
    try {
      const res = await api('/api/verifications', {
        query: { from: `${from}T00:00:00`, to: `${to}T23:59:59`, limit: 10000 }
      });
      const csv = toCsv(res.items || []);
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `chatpay-${from}_${to}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <header className="mb-6">
        <h1 className="font-serif text-3xl">Reportes</h1>
        <p className="text-slate-500 text-sm">Descarga las verificaciones en CSV.</p>
      </header>

      <div className="card max-w-xl">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label">Desde</label>
            <input type="date" className="input" value={from} onChange={(e) => setFrom(e.target.value)} />
          </div>
          <div>
            <label className="label">Hasta</label>
            <input type="date" className="input" value={to} onChange={(e) => setTo(e.target.value)} />
          </div>
        </div>
        <button onClick={download} className="btn btn-primary mt-4 w-full" disabled={loading}>
          {loading ? 'Generando…' : 'Descargar CSV'}
        </button>
      </div>
    </div>
  );
}
