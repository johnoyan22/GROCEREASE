import useDashboardSummary from '../hooks/useDashboardSummary';
import DashboardLoadState from './DashboardLoadState';
import RecentUpdates from './inventory/dashboard/RecentUpdates';
import LowStockNotifications from './LowStockNotifications';

export default function StaffUpdates({ role, title = 'Notification' }) {
  const summary = useDashboardSummary(role);
  return <div><h1 className="mb-5 text-2xl font-bold">{title}</h1><LowStockNotifications /><div className="mt-6"><DashboardLoadState summary={summary} />{summary.data && <RecentUpdates data={summary.data} role={role} />}</div></div>;
}
