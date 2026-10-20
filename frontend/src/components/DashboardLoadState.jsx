export default function DashboardLoadState({ summary }) {
  return <div className="mb-4 flex flex-wrap items-center justify-between gap-3 text-sm">
    {summary.loading ? <p role="status">Loading dashboard data...</p> : summary.error ? <p role="alert" className="text-red-700">{summary.error}</p> : <p className="text-xs text-gray-500">Updated {new Date(summary.data.server_time).toLocaleString('en-PH', { timeZone: 'Asia/Manila' })} (Philippine time)</p>}
    <button type="button" onClick={summary.reload} disabled={summary.loading} className="rounded-lg border border-green-700 bg-white px-4 py-2 text-sm text-green-800 disabled:opacity-50">Refresh dashboard</button>
  </div>;
}
