import { Link } from 'react-router-dom';
import OrderWorkspace from '../orders/OrderWorkspace';
import { useSupervisor } from './SupervisorContext';
import useDashboardSummary from '../../hooks/useDashboardSummary';
import DashboardLoadState from '../DashboardLoadState';

export function SupervisorDashboard() {
  const { supervisorPath } = useSupervisor();
  const summary = useDashboardSummary('supervisor');
  const fields = [['Active orders', 'active_orders'], ['Available workers', 'available_workers'], ['Busy workers', 'busy_workers'], ['Pending stock approvals', 'pending_stock_approvals'], ['Preparing', 'preparing_orders'], ['Ready for pickup', 'ready_orders'], ['Schedule reviews', 'schedule_reviews']];
  return <div><DashboardLoadState summary={summary} />{summary.data && <><p className="mb-3 font-semibold">{summary.data.store.store_name}</p><div className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{fields.map(([label, key]) => <div key={key} className="rounded-xl border border-gray-200 bg-white p-4"><p className="text-xs text-gray-500">{label}</p><p className="mt-2 text-2xl font-bold">{summary.data[key]}</p></div>)}</div></>}<div className="mb-5 flex gap-3"><Link to={supervisorPath('workers')} className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm">Store Workers</Link><Link to={supervisorPath('stock-approvals')} className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm">Stock Approvals</Link></div><OrderWorkspace role="supervisor" title="Store Overview" /></div>;
}
