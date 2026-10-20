import { Link } from 'react-router-dom';
import { LowStockIcon, StockUpdateIcon } from '../shared/InventoryIcons';

export default function PendingTasks({ data }) {
  const tasks = [
    { title: 'Stock approvals', description: 'Awaiting Supervisor decision', count: data.pending_stock_approvals, to: '/inventory/verifications', icon: <StockUpdateIcon /> },
    { title: 'Low stock products', description: 'Available stock at or below a configured threshold', count: data.low_stock_products, to: '/inventory/low-stock', icon: <LowStockIcon /> },
    { title: 'Active orders', description: 'Waiting, preparing or ready for pickup', count: data.active_orders, to: '/inventory/orders', icon: <StockUpdateIcon /> },
  ];
  return <section className="rounded-xl border border-gray-200 bg-white p-5"><h2 className="mb-4 text-base font-semibold text-gray-800">Pending Tasks</h2><div className="divide-y divide-gray-100">{tasks.map(task => <Link key={task.title} to={task.to} className="flex items-center justify-between gap-4 py-3"><div className="flex items-center gap-3"><span className="rounded-full bg-green-50 p-2 text-green-700">{task.icon}</span><div><p className="text-sm font-medium">{task.title}</p><p className="text-xs text-gray-500">{task.description}</p></div></div><span className="rounded-md bg-green-50 px-2 py-1 text-sm">{task.count}</span></Link>)}</div></section>;
}
