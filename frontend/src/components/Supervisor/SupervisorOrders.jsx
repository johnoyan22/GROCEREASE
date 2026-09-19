// SupervisorOrders.jsx
import { useMemo } from 'react'
import { ClipboardList, Package, ShoppingCart, UserRound, Users } from 'lucide-react'
import {
  Badge,
  DataTable,
  DonutChart,
  PageHeader,
  Pagination,
  SearchInput,
  SideCard,
  StatCard,
  Tabs,
  TipBanner,
} from './SupervisorUI'
import { statusTone, useTableQuery } from './SupervisorHelpers'
import { storeInfo } from './SupervisorData'

const tabs = [
  { value: 'active', label: 'Active Orders' },
  { value: 'history', label: 'Order History' },
  { value: 'COP', label: 'COP' },
  { value: 'Prepaid', label: 'Prepaid' },
]

export function SupervisorOrders({ orders, workers, onUpdateOrderStatus, onAssignWorker }) {
  const workerName = Object.fromEntries(workers.map((worker) => [worker.id, worker.name]))
  const availableWorkers = workers.filter((worker) => worker.availability === 'Available')
  const table = useTableQuery(orders, ['id', 'customer', 'status', 'paymentMethod'])

  const visible = useMemo(() => {
    if (table.filter === 'history') return table.filtered.filter((o) => o.status === 'Completed')
    if (table.filter === 'COP' || table.filter === 'Prepaid') return table.filtered.filter((o) => o.paymentMethod === table.filter)
    return table.filtered.filter((o) => o.status !== 'Completed')
  }, [table.filtered, table.filter])

  const pageRows = visible.slice((table.page - 1) * 5, table.page * 5)

  const columns = [
    { key: 'id', label: 'Order Id' },
    { key: 'customer', label: 'Customer' },
    { key: 'items', label: 'Items', render: (row) => `${row.items} Items` },
    { key: 'paymentMethod', label: 'Payment Method', render: (row) => <Badge tone={statusTone(row.paymentMethod)}>{row.paymentMethod}</Badge> },
    { key: 'status', label: 'Order Status', render: (row) => <Badge tone={statusTone(row.status)}>{row.status}</Badge> },
    {
      key: 'worker',
      label: 'Assigned worker',
      render: (row) =>
        row.workerId ? (
          <span className="inline-flex items-center gap-2"><UserRound size={14} /> {workerName[row.workerId]}</span>
        ) : (
          <select
            className="rounded-lg border border-slate-200 px-2 py-1 text-sm"
            defaultValue=""
            onChange={(event) => event.target.value && onAssignWorker(row.id, event.target.value)}
          >
            <option value="">Assign...</option>
            {availableWorkers.map((worker) => (
              <option key={worker.id} value={worker.id}>{worker.name}</option>
            ))}
          </select>
        ),
    },
    { key: 'pickupTime', label: 'Pickup Time' },
    {
      key: 'action',
      label: 'Action',
      render: (row) => (
        <button
          type="button"
          onClick={() => onUpdateOrderStatus(row.id)}
          className="rounded-lg border border-green-700 px-3 py-1 text-sm text-green-700 hover:bg-green-700 hover:text-white"
        >
          Update
        </button>
      ),
    },
  ]

  const statusCounts = {
    Pending: orders.filter((o) => o.status === 'Pending Assignment').length,
    Preparing: orders.filter((o) => o.status === 'Preparing').length,
    Ready: orders.filter((o) => o.status === 'Ready for Pickup').length,
    Completed: orders.filter((o) => o.status === 'Completed').length,
  }

  return (
    <div>
      <PageHeader
        title="Orders"
        subtitle="Monitor active orders, track fulfillment progress, and review order history from one place."
        storeName={storeInfo.name}
        storeAddress={storeInfo.address}
      />

      <div className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard icon={ShoppingCart} label="Active Orders" value={orders.filter((o) => o.status !== 'Completed').length} hint="↑ 4 vs yesterday" />
        <StatCard icon={Users} label="Pending Assignment" value={statusCounts.Pending} hint="↑ 4 vs yesterday" />
        <StatCard icon={Package} label="Preparing" value={statusCounts.Preparing} hint="In Progress" hintTone="blue" />
        <StatCard icon={ClipboardList} label="Ready for Pickup" value={statusCounts.Ready} hint="Awaiting pickup" hintTone="blue" />
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_300px]">
        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <h2 className="font-semibold">Orders Management</h2>
            <SearchInput value={table.search} onChange={table.setSearch} placeholder="Search request..." />
          </div>
          <Tabs options={tabs} value={table.filter === 'all' ? 'active' : table.filter} onChange={table.setFilter} />
          <div className="mt-4">
            <DataTable columns={columns} rows={pageRows} />
          </div>
          <Pagination page={table.page} pageCount={Math.max(1, Math.ceil(visible.length / 5))} total={visible.length} label="request" onPageChange={table.setPage} />
        </section>

        <div className="space-y-4">
          <SideCard title="Order Status Overview">
            <DonutChart
              totalLabel="Total"
              totalValue={orders.length}
              segments={[
                { label: 'Pending', value: statusCounts.Pending, percent: `${statusCounts.Pending}`, color: '#f59e0b' },
                { label: 'Preparing', value: statusCounts.Preparing, percent: `${statusCounts.Preparing}`, color: '#38bdf8' },
                { label: 'Ready for Pickup', value: statusCounts.Ready, percent: `${statusCounts.Ready}`, color: '#34d399' },
                { label: 'Completed', value: statusCounts.Completed, percent: `${statusCounts.Completed}`, color: '#15803d' },
              ]}
            />
          </SideCard>
          <SideCard title="Pickup Schedule">
            <ul className="space-y-3 text-sm">
              {orders.filter((o) => o.status !== 'Completed').slice(0, 4).map((order) => (
                <li key={order.id} className="flex items-center justify-between gap-2">
                  <span>
                    <span className="block font-medium">{order.customer}</span>
                    <span className="text-xs text-slate-400">{order.id}</span>
                  </span>
                  <span className="text-right">
                    <span className="block">{order.pickupTime}</span>
                    <Badge tone={statusTone(order.status)}>{order.status}</Badge>
                  </span>
                </li>
              ))}
            </ul>
          </SideCard>
        </div>
      </div>
      <TipBanner text="Assign available workers to pending orders first so pickup times stay on schedule." />
    </div>
  )
}
