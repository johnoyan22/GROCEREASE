import { databaseDate } from '../../../services/dates';
import { Link } from 'react-router-dom';

export default function RecentUpdates({ data }) {
  return <section className="rounded-xl border border-gray-200 bg-white p-5"><div className="mb-4 flex justify-between gap-3"><h2 className="font-semibold">Recent Stock Decisions</h2><Link to="/inventory/verifications" className="text-xs text-green-700">View requests</Link></div><div className="divide-y divide-gray-100">{data.recent_adjustments.map(row => <div key={row.id} className="py-3 text-sm"><p>Request #{row.id} - Inventory #{row.store_inventory_id} - <strong>{row.status}</strong></p><p className="mt-1 text-xs text-gray-500">{row.reason}</p><p className="mt-1 text-xs text-gray-500">{databaseDate(row.updated_at).toLocaleString('en-PH', { timeZone: 'Asia/Manila' })}</p></div>)}{data.recent_adjustments.length === 0 && <p className="text-sm text-gray-500">No stock adjustment requests recorded.</p>}</div></section>;
}
