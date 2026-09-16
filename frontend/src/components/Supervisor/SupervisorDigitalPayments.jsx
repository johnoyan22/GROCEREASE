// SupervisorDigitalPayments.jsx
import { useMemo } from 'react'
import { Clock3, CreditCard, UserRound, Wallet, XCircle } from 'lucide-react'
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
  statusTone,
  useTableQuery,
} from './SupervisorUI'
import { storeInfo } from './SupervisorData'

const tabs = [
  { value: 'all', label: 'All Payment' },
  { value: 'Online', label: 'Online payment' },
  { value: 'Debit Card', label: 'Debit Card' },
  { value: 'COP', label: 'COP Verified' },
  { value: 'Failed', label: 'Failed' },
]

function peso(amount) {
  return `₱${amount.toFixed(2)}`
}

export function SupervisorDigitalPayments({ payments, onVerifyPayment, onViewPayment }) {
  const table = useTableQuery(payments, ['id', 'customer', 'orderId', 'method', 'status'])

  const visible = useMemo(() => {
    if (table.filter === 'Failed') return table.filtered.filter((item) => item.status === 'Failed')
    if (table.filter === 'all') return table.filtered
    return table.filtered.filter((item) => item.method === table.filter)
  }, [table.filtered, table.filter])

  const pageRows = visible.slice((table.page - 1) * 5, table.page * 5)

  const columns = [
    { key: 'id', label: 'Transaction ID' },
    { key: 'customer', label: 'Customer', render: (row) => <span className="inline-flex items-center gap-2"><UserRound size={14} /> {row.customer}</span> },
    { key: 'orderId', label: 'Order ID', render: (row) => `# ${row.orderId.replace('ORD-', '-')}` },
    { key: 'method', label: 'Payment Method', render: (row) => <Badge tone={statusTone(row.method)}>{row.method}</Badge> },
    { key: 'amount', label: 'Amount', render: (row) => peso(row.amount) },
    { key: 'status', label: 'Payment Status', render: (row) => <Badge tone={statusTone(row.status)}>{row.status}</Badge> },
    { key: 'dateTime', label: 'Date & Time' },
    { key: 'verifiedBy', label: 'Verified by' },
    {
      key: 'action',
      label: 'Action',
      render: (row) => (
        <div className="flex gap-2">
          <button type="button" onClick={() => onViewPayment(row.id)} className="rounded-lg border border-slate-300 px-3 py-1 text-sm">
            View
          </button>
          {row.status === 'Pending' ? (
            <button type="button" onClick={() => onVerifyPayment(row.id)} className="rounded-lg bg-green-700 px-3 py-1 text-sm text-white">
              Verify
            </button>
          ) : null}
        </div>
      ),
    },
  ]

  const successful = payments.filter((item) => item.status === 'Successful').length
  const pending = payments.filter((item) => item.status === 'Pending').length
  const failed = payments.filter((item) => item.status === 'Failed').length
  const cop = payments.filter((item) => item.method === 'COP').length
  const methodTotal = payments.length || 1

  return (
    <div>
      <PageHeader
        title="Digital Payments"
        subtitle="Review payment transactions, verify pending COP, and inspect receipt details."
        storeName={storeInfo.name}
        storeAddress={storeInfo.address}
      />

      <div className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard icon={Wallet} label="Successful Payment" value={successful} hint="↑ 4 vs yesterday" />
        <StatCard icon={Clock3} label="Pending Verification" value={pending} hint="Needs review" hintTone="orange" />
        <StatCard icon={XCircle} label="Failed Payments" value={failed} hint="↓ 4 vs yesterday" hintTone="red" />
        <StatCard icon={CreditCard} label="COP Paid Today" value={cop} hint="↑ 4 vs yesterday" hintTone="blue" />
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_300px]">
        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <h2 className="font-semibold">Payment Transaction</h2>
            <SearchInput value={table.search} onChange={table.setSearch} placeholder="Search request..." />
          </div>
          <Tabs options={tabs} value={table.filter} onChange={table.setFilter} />
          <div className="mt-4">
            <DataTable columns={columns} rows={pageRows} />
          </div>
          <Pagination page={table.page} pageCount={Math.max(1, Math.ceil(visible.length / 5))} total={visible.length} label="request" onPageChange={table.setPage} />
        </section>

        <div className="space-y-4">
          <SideCard title="Payment Status Overview">
            <DonutChart
              totalLabel="Total"
              totalValue={payments.length}
              segments={[
                { label: 'Successful', value: successful, percent: `${((successful / methodTotal) * 100).toFixed(1)}%`, color: '#15803d' },
                { label: 'Pending', value: pending, percent: `${((pending / methodTotal) * 100).toFixed(1)}%`, color: '#f59e0b' },
                { label: 'Failed', value: failed, percent: `${((failed / methodTotal) * 100).toFixed(1)}%`, color: '#ef4444' },
                { label: 'Refunded', value: payments.filter((i) => i.status === 'Refunded').length, percent: `${((payments.filter((i) => i.status === 'Refunded').length / methodTotal) * 100).toFixed(1)}%`, color: '#94a3b8' },
              ]}
            />
          </SideCard>
          <SideCard title="Payment Method Breakdown">
            {['Online', 'Debit Card', 'COP'].map((method) => {
              const count = payments.filter((item) => item.method === method).length
              return (
                <div key={method} className="mb-3">
                  <div className="mb-1 flex justify-between text-sm">
                    <span>{method}</span>
                    <span>{Math.round((count / methodTotal) * 100)}%</span>
                  </div>
                  <ProgressBar value={(count / methodTotal) * 100} />
                </div>
              )
            })}
          </SideCard>
        </div>
      </div>
      <TipBanner text="Review pending payments before pickup. Unverified COP should be confirmed at the counter." />
    </div>
  )
}
