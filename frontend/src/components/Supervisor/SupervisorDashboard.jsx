// SupervisorDashboard.jsx
import { Link } from 'react-router-dom'
import { Bell, CheckCircle2, ClipboardList, Package, RefreshCw, ShoppingCart, UserRound } from 'lucide-react'
import {
  Badge,
  BarChart,
  DataTable,
  Pagination,
  PageHeader,
  ProgressBar,
  SideCard,
  StatCard,
  statusTone,
  stockTone,
  useTableQuery,
} from './SupervisorUI'
import { dailySales, inventoryItems, storeInfo } from './SupervisorData'
import { useSupervisor } from './SupervisorContext'

export function SupervisorDashboard() {
  const { orders, workers, notifications, updateOrderStatus, supervisorPath } = useSupervisor()
  const activeOrders = orders.filter((order) => order.status !== 'Completed')
  const table = useTableQuery(activeOrders, ['id', 'customer', 'status', 'paymentMethod'])
  const workerName = Object.fromEntries(workers.map((worker) => [worker.id, worker.name]))

  const columns = [
    { key: 'id', label: 'Order Id' },
    { key: 'customer', label: 'Customers' },
    { key: 'items', label: 'Items', render: (row) => <strong>{row.items} Items</strong> },
    { key: 'paymentMethod', label: 'Payment Method', render: (row) => <Badge tone={statusTone(row.paymentMethod)}>{row.paymentMethod}</Badge> },
    { key: 'status', label: 'Order Status', render: (row) => <Badge tone={statusTone(row.status)}>{row.status}</Badge> },
    {
      key: 'worker',
      label: 'Worker',
      render: (row) => (
        <span className="inline-flex items-center gap-2">
          <UserRound size={14} /> {row.workerId ? workerName[row.workerId] : 'Unassigned'}
        </span>
      ),
    },
    { key: 'pickupTime', label: 'Pickup Time' },
    {
      key: 'action',
      label: 'Action',
      render: (row) => (
        <button
          type="button"
          onClick={() => updateOrderStatus(row.id)}
          className="rounded-lg border border-green-700 px-3 py-1 text-sm text-green-700 hover:bg-green-700 hover:text-white"
        >
          Update
        </button>
      ),
    },
  ]

  const available = workers.filter((w) => w.availability === 'Available').length
  const busy = workers.filter((w) => w.availability === 'Busy').length
  const offline = workers.filter((w) => w.availability === 'Offline').length

  return (
    <div>
      <PageHeader
        title="Dashboard"
        subtitle="Overview of active orders, notification, and workers status."
        storeName={storeInfo.name}
        storeAddress={storeInfo.address}
      />

      <div className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard icon={ShoppingCart} label="Active Orders" value={activeOrders.length} hint={`↑ ${Math.max(1, activeOrders.length - 3)} vs yesterday`} />
        <StatCard icon={Package} label="Preparing" value={orders.filter((o) => o.status === 'Preparing').length} hint="In Progress" hintTone="blue" />
        <StatCard icon={ClipboardList} label="Ready for Pickup" value={orders.filter((o) => o.status === 'Ready for Pickup').length} />
        <StatCard icon={CheckCircle2} label="Completed Today" value={orders.filter((o) => o.status === 'Completed').length} hint="↑ 4 vs yesterday" />
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-4">
          <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="font-semibold">Active Orders</h2>
              <Link to={supervisorPath('orders')} className="text-sm font-medium text-green-700">
                View all orders
              </Link>
            </div>
            <DataTable columns={columns} rows={table.rows} />
            <Pagination page={table.page} pageCount={table.pageCount} total={table.total} label="active orders" onPageChange={table.setPage} />
          </section>

          <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="font-semibold">Recent Notifications</h2>
              <Link to={supervisorPath('notifications')} className="text-sm font-medium text-green-700">
                View all
              </Link>
            </div>
            <ul className="space-y-3">
              {notifications.slice(0, 4).map((item) => (
                <li key={item.id} className="flex items-center justify-between gap-3 text-sm">
                  <span className="flex items-center gap-2">
                    <Bell size={16} className="text-green-700" /> {item.title}
                  </span>
                  <span className="text-slate-400">{item.time}</span>
                </li>
              ))}
            </ul>
          </section>
        </div>

        <div className="space-y-4">
          <SideCard
            title="Inventory Stock Monitoring"
            action={
              <Link to={supervisorPath('stock-approvals')} className="text-xs text-green-700">
                Go to Stock Approvals →
              </Link>
            }
          >
            <ul className="space-y-3">
              {inventoryItems.map((item) => (
                <li key={item.id}>
                  <div className="mb-1 flex justify-between text-sm">
                    <span>{item.name}</span>
                    <span>{item.stockPercent}%</span>
                  </div>
                  <ProgressBar value={item.stockPercent} tone={stockTone(item.stockPercent)} />
                </li>
              ))}
            </ul>
          </SideCard>

          <SideCard title="Worker Overview">
            <p className="text-sm text-slate-600">
              Available workers {available} of {workers.length} total.
            </p>
            <ul className="mt-3 space-y-1 text-sm">
              <li className="flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-green-600" /> Available ({available})</li>
              <li className="flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-amber-400" /> Busy ({busy})</li>
              <li className="flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-red-500" /> Offline ({offline})</li>
            </ul>
            <p className="mt-3 flex items-center gap-1 text-xs text-slate-400">
              <RefreshCw size={12} /> Last update just now
            </p>
          </SideCard>

          <SideCard
            title="Daily Sales Performances"
            action={
              <Link to={supervisorPath('sales-reports')} className="text-xs text-green-700">
                Go to sales reports →
              </Link>
            }
          >
            <BarChart items={dailySales.map((item) => ({ label: item.day, value: item.amount }))} maxValue={800} />
          </SideCard>
        </div>
      </div>
    </div>
  )
}
