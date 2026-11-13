import { useState } from 'react';
import { downloadReportPdf } from '../../services/api';
export default function PdfExportButton({ role, kind, filters = {}, disabled = false }) {
  const [busy, setBusy] = useState(false), [error, setError] = useState('');
  async function download() { setBusy(true); setError(''); try { await downloadReportPdf(role, kind, filters); } catch (failure) { setError(failure.message); } finally { setBusy(false); } }
  return <div><button type="button" disabled={disabled || busy} onClick={download} className="rounded-lg border border-green-800 bg-white px-4 py-2 text-sm font-semibold text-green-800 disabled:opacity-50">{busy ? 'Generating PDF…' : 'Export PDF'}</button>{error && <p role="alert" className="mt-2 text-sm text-red-700">{error}</p>}</div>;
}
