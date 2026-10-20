import useDashboardSummary from '../hooks/useDashboardSummary';
import DashboardLoadState from './DashboardLoadState';
import RecentUpdates from './inventory/dashboard/RecentUpdates';

export default function StaffUpdates({ role }) {
  const summary = useDashboardSummary(role);
  return <div><h1 className="mb-2 text-2xl font-bold">Store Updates</h1><p className="mb-5 text-sm text-gray-600">Actual stock requests and reports for your assigned supermarket. Staff message delivery and unread tracking are not configured.</p><DashboardLoadState summary={summary} />{summary.data && <><h2 className="mb-3 font-semibold">{summary.data.store.store_name}</h2><RecentUpdates data={summary.data} /><section className="mt-4 rounded-xl border border-gray-200 bg-white p-5"><h2 className="font-semibold">Recent Low Stock Reports</h2>{summary.data.recent_reports.map(row => <p key={row.id} className="mt-3 text-sm">Report #{row.id} · Inventory #{row.store_inventory_id}: {row.note}</p>)}{summary.data.recent_reports.length === 0 && <p className="mt-3 text-sm text-gray-500">No low stock reports recorded.</p>}</section></>}</div>;
}
