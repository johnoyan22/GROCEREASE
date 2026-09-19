// SupervisorWorkers.jsx
import { useMemo, useState } from 'react'
import { UserRound, Users } from 'lucide-react'
import {
  Badge,
  DataTable,
  FilterPills,
  PageHeader,
  Pagination,
  ProgressBar,
  SearchInput,
  SideCard,
  StatCard,
  Tabs,
  TipBanner,
} from './SupervisorUI'
import { statusTone, useTableQuery } from './SupervisorHelpers'
import { shiftCapacity, storeInfo, workerActivity } from './SupervisorData'

const tabs = [
  { value: 'directory', label: 'Workers Directory' },
  { value: 'assignment', label: 'Assignment' },
  { value: 'performance', label: 'Performance' },
  { value: 'incentives', label: 'Incentives' },
]

const availabilityFilters = [
  { value: 'all', label: 'All Workers' },
  { value: 'Available', label: 'Available' },
  { value: 'Busy', label: 'Busy' },
  { value: 'Offline', label: 'Offline' },
]

export function SupervisorWorkers({ workers, orders, onAssignWorker }) {
  const [tab, setTab] = useState('directory')
  const [selectedWorker, setSelectedWorker] = useState(null)
  const table = useTableQuery(workers, ['name', 'role', 'availability'])

  const visible = useMemo(() => {
    if (tab === 'assignment') return table.filtered.filter((w) => w.availability === 'Available')
    if (table.filter === 'all') return table.filtered
    return table.filtered.filter((w) => w.availability === table.filter)
  }, [table.filtered, table.filter, tab])

  const pageRows = visible.slice((table.page - 1) * 5, table.page * 5)
  const pendingOrders = orders.filter((order) => order.status === 'Pending Assignment')

  const columns = [
    { key: 'name', label: 'Worker', render: (row) => <span className="inline-flex items-center gap-2"><UserRound size={14} /> {row.name}</span> },
    { key: 'role', label: 'Role', render: (row) => <Badge tone={statusTone(row.role)}>{row.role}</Badge> },
    { key: 'assigned', label: 'Current Assigned', render: (row) => (row.assignedOrderId ? `Order ${row.assignedOrderId}` : 'None') },
    { key: 'availability', label: 'Availability', render: (row) => <Badge tone={statusTone(row.availability)}>{row.availability}</Badge> },
    { key: 'shift', label: 'Shift' },
    { key: 'ordersCompleted', label: 'Orders Completed' },
    { key: 'avgPrepTime', label: 'Avg. Prep-time' },
    { key: 'action', label: 'Action', render: (row) => <button type="button" onClick={() => setSelectedWorker(row)} className="rounded-lg border border-green-700 px-3 py-1 text-sm text-green-700">View</button> },
  ]

  const avgRate = Math.round(workers.reduce((sum, w) => sum + w.completionRate, 0) / (workers.length || 1))

  return (
    <div>
      <PageHeader
        title="Workers"
        subtitle="Manage workers, view performance, and monitor incentives earnings."
        storeName={storeInfo.name}
        storeAddress={storeInfo.address}
      />
      <div className="mb-4">
        <Tabs options={tabs} value={tab} onChange={setTab} />
      </div>

      <div className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard icon={Users} label="Total Workers" value={workers.length} hint="All registered" hintTone="gray" />
        <StatCard label="Available" value={workers.filter((w) => w.availability === 'Available').length} hint="Ready for assignment" />
        <StatCard label="Busy" value={workers.filter((w) => w.availability === 'Busy').length} hint="Currently on task" hintTone="orange" />
        <StatCard label="Avg Completion Rate" value={`${avgRate}%`} hint="Across current store" />
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_300px]">
        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <h2 className="font-semibold">
              {tab === 'incentives' ? 'Incentives' : tab === 'performance' ? 'Performance' : 'Worker Directory'}
            </h2>
            <SearchInput value={table.search} onChange={table.setSearch} placeholder="Search Workers..." />
          </div>
          {tab === 'directory' ? (
            <div className="mb-4">
              <FilterPills options={availabilityFilters} value={table.filter} onChange={table.setFilter} />
            </div>
          ) : null}

          {tab === 'incentives' ? (
            <DataTable
              columns={[
                { key: 'name', label: 'Worker' },
                { key: 'ordersCompleted', label: 'Completed' },
                { key: 'bonus', label: 'Estimated Incentive', render: (row) => `₱${(row.ordersCompleted * 15).toFixed(2)}` },
              ]}
              rows={pageRows}
            />
          ) : tab === 'performance' ? (
            <DataTable
              columns={[
                { key: 'name', label: 'Worker' },
                { key: 'completionRate', label: 'Completion Rate', render: (row) => `${row.completionRate}%` },
                { key: 'avgPrepTime', label: 'Avg Prep' },
                { key: 'ordersCompleted', label: 'Orders' },
              ]}
              rows={[...visible].sort((a, b) => b.completionRate - a.completionRate).slice(0, 5)}
            />
          ) : tab === 'assignment' ? (
            <div className="space-y-3">
              {pendingOrders.length === 0 ? (
                <p className="text-sm text-slate-500">No pending assignments for this store.</p>
              ) : (
                pendingOrders.map((order) => (
                  <div key={order.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 p-3">
                    <div>
                      <p className="font-medium">{order.id}</p>
                      <p className="text-sm text-slate-500">{order.customer} · pickup {order.pickupTime}</p>
                    </div>
                    <select
                      className="rounded-lg border border-slate-200 px-2 py-1 text-sm"
                      defaultValue=""
                      onChange={(event) => event.target.value && onAssignWorker(order.id, event.target.value)}
                    >
                      <option value="">Assign available worker</option>
                      {workers.filter((w) => w.availability === 'Available').map((worker) => (
                        <option key={worker.id} value={worker.id}>{worker.name}</option>
                      ))}
                    </select>
                  </div>
                ))
              )}
            </div>
          ) : (
            <DataTable columns={columns} rows={pageRows} />
          )}

          {tab === 'directory' || tab === 'incentives' ? (
            <Pagination page={table.page} pageCount={Math.max(1, Math.ceil(visible.length / 5))} total={visible.length} label="Workers" onPageChange={table.setPage} />
          ) : null}
        </section>

        <div className="space-y-4">
          <SideCard title="Shift Availability Overview">
            <ul className="space-y-3">
              {shiftCapacity.map((shift) => (
                <li key={shift.id}>
                  <div className="mb-1 flex justify-between text-sm">
                    <span>{shift.label}</span>
                    <span>{shift.filled}/{shift.total} ({Math.round((shift.filled / shift.total) * 100)}%)</span>
                  </div>
                  <ProgressBar value={(shift.filled / shift.total) * 100} />
                </li>
              ))}
            </ul>
          </SideCard>
          <SideCard title="Worker Performance Overview">
            <ul className="space-y-2 text-sm">
              {[...workers].sort((a, b) => b.completionRate - a.completionRate).slice(0, 4).map((worker) => (
                <li key={worker.id} className="flex justify-between">
                  <span>{worker.name}</span>
                  <span>{worker.completionRate}%</span>
                </li>
              ))}
            </ul>
          </SideCard>
          <SideCard title="Recent Worker Activity">
            <ul className="space-y-3 text-sm">
              {workerActivity.map((item) => (
                <li key={item.id}>
                  <p>{item.message}</p>
                  <p className="text-xs text-slate-400">{item.time}</p>
                </li>
              ))}
            </ul>
          </SideCard>
        </div>
      </div>

      {selectedWorker ? (
        <div className="fixed inset-0 z-20 flex items-center justify-center bg-black/40 p-4" onClick={() => setSelectedWorker(null)}>
          <div className="w-full max-w-md rounded-2xl bg-white p-5" onClick={(event) => event.stopPropagation()}>
            <h3 className="font-serif text-2xl">{selectedWorker.name}</h3>
            <p className="text-sm text-slate-500">{selectedWorker.role} · {selectedWorker.shift}</p>
            <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
              <div><dt className="text-slate-400">Availability</dt><dd>{selectedWorker.availability}</dd></div>
              <div><dt className="text-slate-400">Completed</dt><dd>{selectedWorker.ordersCompleted}</dd></div>
              <div><dt className="text-slate-400">Avg prep</dt><dd>{selectedWorker.avgPrepTime}</dd></div>
              <div><dt className="text-slate-400">Rate</dt><dd>{selectedWorker.completionRate}%</dd></div>
            </dl>
            <button type="button" onClick={() => setSelectedWorker(null)} className="mt-5 rounded-lg bg-green-700 px-4 py-2 text-white">
              Close
            </button>
          </div>
        </div>
      ) : null}

      <TipBanner text="Workers marked as Available can be assigned to new orders. Monitor shift coverage to maintain optimal productivity." />
    </div>
  )
}
