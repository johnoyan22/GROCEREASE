import { Link } from 'react-router-dom';
import OrderWorkspace from '../orders/OrderWorkspace';
import { useSupervisor } from './SupervisorContext';

export function SupervisorDashboard() {
  const { supervisorPath } = useSupervisor();
  return <div><div className="mb-5 flex gap-3"><Link to={supervisorPath('workers')} className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm">Store Workers</Link><Link to={supervisorPath('stock-approvals')} className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm">Stock Approvals</Link></div><OrderWorkspace role="supervisor" title="Store Overview" /></div>;
}
