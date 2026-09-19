// SupervisorStockApprovals.jsx
import { CheckCircle2, ClipboardList, Eye, TriangleAlert, UserRound } from 'lucide-react'
import {
  Badge,
  DataTable,
  DonutChart,
  FilterPills,
  PageHeader,
  Pagination,
  ProgressBar,
  SearchInput,
  SideCard,
  StatCard,
  TipBanner,
} from './SupervisorUI'
import { statusTone, stockTone, useTableQuery } from './SupervisorHelpers'
import { inventoryItems, storeInfo } from './SupervisorData'

const filterOptions = [
  { value: 'all', label: 'All' },
  { value: 'Low Stock', label: 'Low Stock' },
  { value: 'Restock', label: 'Restock' },
  { value: 'Availability change', label: 'Availability change' },
]

export function SupervisorStockApprovals({ stockRequests, onApproveStock, onReviewStock }) {
  const table = useTableQuery(stockRequests, ['id', 'itemName', 'category', 'submittedBy', 'requestedUpdate'])
  const visible = table.filtered.filter((item) => table.filter === 'all' || item.requestedUpdate === table.filter)
  const pageRows = visible.slice((table.page - 1) * 5, table.page * 5)

  const columns = [
    { key: 'id', label: 'Request Id' },
    { key: 'itemName', label: 'Item Name' },
    { key: 'category', label: 'Category' },
    { key: 'currentStock', label: 'Current Stock', render: (row) => `${row.currentStock} units` },
    { key: 'requestedUpdate', label: 'Requested Update' },
    { key: 'submittedBy', label: 'Submitted By', render: (row) => <span className="inline-flex items-center gap-2"><UserRound size={14} /> {row.submittedBy}</span> },
    { key: 'priority', label: 'Priority', render: (row) => <Badge tone={statusTone(row.priority)}>{row.priority}</Badge> },
    { key: 'submittedTime', label: 'Submitted time' },
    {
      key: 'action',
      label: 'Action',
      render: (row) => (
        <div className="flex gap-2">
          <button type="button" onClick={() => onReviewStock(row.id)} className="rounded-lg bg-rose-100 px-3 py-1 text-sm text-rose-700">
            Review
          </button>
          <button type="button" onClick={() => onApproveStock(row.id)} className="rounded-lg bg-green-700 px-3 py-1 text-sm text-white">
            Approved
          </button>
        </div>
      ),
    },
  ]

  const inStock = inventoryItems.filter((item) => item.stockPercent > 50).length
  const low = inventoryItems.filter((item) => item.stockPercent > 0 && item.stockPercent <= 50).length
  const out = inventoryItems.filter((item) => item.stockPercent === 0).length

  return (
    <div>
      <PageHeader
        title="Stock Approvals"
        subtitle="Review stock updates, low-stock reports, and inventory requests from assigned workers."
        storeName={storeInfo.name}
        storeAddress={storeInfo.address}
      />

      <div className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard icon={ClipboardList} label="Pending Approvals" value={stockRequests.filter((i) => i.status === 'Pending').length} hint="↑ 4 vs yesterday" />
        <StatCard icon={TriangleAlert} label="Low Stock reports" value={stockRequests.filter((i) => i.requestedUpdate === 'Low Stock').length} hint="↑ 4 vs yesterday" />
        <StatCard icon={CheckCircle2} label="Approved Today" value={stockRequests.filter((i) => i.status === 'Approved').length} hint="↑ 4 vs yesterday" />
        <StatCard icon={Eye} label="Needs Review" value={stockRequests.filter((i) => i.status === 'Needs Review').length} hint="↑ 4 vs yesterday" />
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_300px]">
        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <h2 className="font-semibold">Approval Queue</h2>
            <SearchInput value={table.search} onChange={table.setSearch} placeholder="Search request..." />
          </div>
          <div className="mb-4">
            <FilterPills options={filterOptions} value={table.filter} onChange={table.setFilter} />
          </div>
          <DataTable columns={columns} rows={pageRows} />
          <Pagination page={table.page} pageCount={Math.max(1, Math.ceil(visible.length / 5))} total={visible.length} label="request" onPageChange={table.setPage} />
        </section>

        <div className="space-y-4">
          <SideCard title="Urgent Low Stock Items" action={<span className="text-xs text-green-700">View All low stock items</span>}>
            <ul className="space-y-3">
              {inventoryItems.filter((item) => item.stockPercent <= 60).map((item) => (
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
          <SideCard title="Recent Approval Activity">
            <ul className="space-y-3 text-sm">
              {stockRequests.slice(0, 4).map((item) => (
                <li key={item.id}>
                  <p className="font-medium">{item.status} · {item.itemName}</p>
                  <p className="text-xs text-slate-400">{item.submittedBy} · {item.submittedTime}</p>
                </li>
              ))}
            </ul>
          </SideCard>
          <SideCard title="Inventory Health" action={<span className="text-xs text-green-700">View Inventory Report →</span>}>
            <DonutChart
              totalLabel="Healthy"
              totalValue="82%"
              segments={[
                { label: 'In Stock', value: inStock || 4, percent: '82%', color: '#15803d' },
                { label: 'Low Stock', value: low || 2, percent: '14%', color: '#f59e0b' },
                { label: 'Out of Stock', value: out || 1, percent: '4%', color: '#ef4444' },
              ]}
            />
          </SideCard>
        </div>
      </div>

      <TipBanner text="Prioritize high-risk items first. Approving low-stock items early helps prevent stockouts during peak pickup hours." />
    </div>
  )
}
