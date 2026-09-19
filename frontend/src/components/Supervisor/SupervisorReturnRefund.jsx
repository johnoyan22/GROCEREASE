// SupervisorReturnRefund.jsx
import { useMemo } from 'react'
import { CheckCircle2, Clock3, Eye, XCircle } from 'lucide-react'
import {
  Badge,
  DataTable,
  DonutChart,
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
import { returnReasons, storeInfo } from './SupervisorData'

const tabs = [
  { value: 'all', label: 'All Payment' },
  { value: 'Return', label: 'Return' },
  { value: 'Refund', label: 'Refund' },
  { value: 'Resolved', label: 'Resolved' },
]

export function SupervisorReturnRefund({ returns, onUpdateReturnStatus }) {
  const table = useTableQuery(returns, ['id', 'customer', 'orderId', 'type', 'reason', 'status'])

  const visible = useMemo(() => {
    if (table.filter === 'Resolved') return table.filtered.filter((item) => item.status === 'Resolved' || item.status === 'Approved')
    if (table.filter === 'all') return table.filtered
    return table.filtered.filter((item) => item.type === table.filter)
  }, [table.filtered, table.filter])

  const pageRows = visible.slice((table.page - 1) * 5, table.page * 5)
  const maxReason = Math.max(...returnReasons.map((item) => item.count))

  const columns = [
    { key: 'id', label: 'Request ID' },
    { key: 'customer', label: 'Customer' },
    { key: 'orderId', label: 'Order ID' },
    { key: 'type', label: 'Type' },
    { key: 'reason', label: 'Reason' },
    { key: 'status', label: 'Status', render: (row) => <Badge tone={statusTone(row.status)}>{row.status}</Badge> },
    { key: 'dateSubmitted', label: 'Date Submitted' },
    {
      key: 'action',
      label: 'Action',
      render: (row) => (
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => onUpdateReturnStatus(row.id, 'In Review')} className="rounded-lg border px-3 py-1 text-sm">Review</button>
          <button type="button" onClick={() => onUpdateReturnStatus(row.id, 'Approved')} className="rounded-lg bg-green-700 px-3 py-1 text-sm text-white">Approve</button>
          <button type="button" onClick={() => onUpdateReturnStatus(row.id, 'Rejected')} className="rounded-lg bg-red-50 px-3 py-1 text-sm text-red-600">Reject</button>
        </div>
      ),
    },
  ]

  const pending = returns.filter((item) => item.status === 'Pending').length
  const approved = returns.filter((item) => item.status === 'Approved').length
  const rejected = returns.filter((item) => item.status === 'Rejected').length
  const review = returns.filter((item) => item.status === 'In Review').length

  return (
    <div>
      <PageHeader
        title="Return & Refund"
        subtitle="Review return request refund status and customer concern from one place."
        storeName={storeInfo.name}
        storeAddress={storeInfo.address}
      />

      <div className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard icon={Clock3} label="Pending Request" value={pending} hint="↑ 4 vs yesterday" />
        <StatCard icon={CheckCircle2} label="Approved Today" value={approved} hint="↑ 4 vs yesterday" />
        <StatCard icon={XCircle} label="Reject Request" value={rejected} hint="↓ 4 vs yesterday" hintTone="red" />
        <StatCard icon={Eye} label="In Review" value={review} hint="↑ 4 vs yesterday" hintTone="blue" />
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_300px]">
        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <h2 className="font-semibold">Return & refund requests</h2>
            <SearchInput value={table.search} onChange={table.setSearch} placeholder="Search request..." />
          </div>
          <Tabs options={tabs} value={table.filter} onChange={table.setFilter} />
          <div className="mt-4">
            <DataTable columns={columns} rows={pageRows} />
          </div>
          <Pagination page={table.page} pageCount={Math.max(1, Math.ceil(visible.length / 5))} total={visible.length} label="request" onPageChange={table.setPage} />
        </section>
        <div className="space-y-4">
          <SideCard title="Request Status Overview">
            <DonutChart
              totalLabel="Total"
              totalValue={returns.length}
              segments={[
                { label: 'Pending', value: pending, percent: `${pending}`, color: '#f59e0b' },
                { label: 'In Review', value: review, percent: `${review}`, color: '#38bdf8' },
                { label: 'Approved', value: approved, percent: `${approved}`, color: '#15803d' },
                { label: 'Rejected', value: rejected, percent: `${rejected}`, color: '#ef4444' },
              ]}
            />
          </SideCard>
          <SideCard title="Common Return Reasons">
            <ul className="space-y-3">
              {returnReasons.map((item) => (
                <li key={item.reason}>
                  <div className="mb-1 flex justify-between text-sm">
                    <span>{item.reason}</span>
                    <span>{item.count}</span>
                  </div>
                  <ProgressBar value={(item.count / maxReason) * 100} />
                </li>
              ))}
            </ul>
          </SideCard>
        </div>
      </div>
      <TipBanner text="Review and resolve return or refund requests within 24 hours to ensure customer satisfaction and maintain service quality." />
    </div>
  )
}
