import { databaseDate } from '../../../services/dates';
import { Link } from 'react-router-dom';

export default function RecentActivity({ data }) {
  return <section className="min-w-0 rounded-xl border border-gray-200 bg-white p-5"><div className="mb-4 flex justify-between"><h2 className="font-semibold">Recent Availability Activity</h2><Link to="/inventory/activity" className="text-xs text-green-700">View all</Link></div><div className="overflow-x-auto"><table className="w-full text-left text-xs"><thead><tr className="border-b"><th className="py-3">Inventory</th><th>Change</th><th>Philippine time</th></tr></thead><tbody>{data.recent_activity.map(row => <tr key={row.id} className="border-b border-gray-100"><td className="py-3">#{row.store_inventory_id}</td><td>{row.previous_status} to {row.new_status}</td><td>{databaseDate(row.created_at).toLocaleString('en-PH', { timeZone: 'Asia/Manila' })}</td></tr>)}</tbody></table>{data.recent_activity.length === 0 && <p className="py-4 text-sm text-gray-500">No availability changes recorded.</p>}</div></section>;
}
