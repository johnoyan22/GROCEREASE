// SupervisorSalesReports.jsx
import { Banknote, ShoppingBag, TrendingUp, Wallet } from 'lucide-react'
import { BarChart, DataTable, PageHeader, ProgressBar, SideCard, StatCard } from './SupervisorUI'
import { categorySales, dailySales, salesByPayment, storeInfo } from './SupervisorData'

function peso(amount) {
  return `₱${amount.toFixed(2)}`
}

export function SupervisorSalesReports({ orders }) {
  const todayTotal = orders.reduce((sum, order) => sum + (order.total || 0), 0) || 1673
  const weekTotal = dailySales.reduce((sum, item) => sum + item.amount, 0)
  const avgOrder = orders.length ? todayTotal / orders.length : 209.13
  const maxCategory = Math.max(...categorySales.map((item) => item.amount))

  return (
    <div>
      <PageHeader
        title="Sales Reports"
        subtitle="Track daily performance, payment mix, and category contribution for the selected store."
        storeName={storeInfo.name}
        storeAddress={storeInfo.address}
      />

      <div className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard icon={Wallet} label="Store order value" value={peso(todayTotal)} hint="From current order list" />
        <StatCard icon={TrendingUp} label="Weekly chart total" value={peso(weekTotal)} hint="Mon–Sun snapshot" />
        <StatCard icon={ShoppingBag} label="Orders in view" value={orders.length} hint="Filtered by location" hintTone="gray" />
        <StatCard icon={Banknote} label="Average order" value={peso(avgOrder)} hint="Store orders only" hintTone="blue" />
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <h2 className="mb-4 font-semibold">Daily Sales Performance</h2>
          <BarChart items={dailySales.map((item) => ({ label: item.day, value: item.amount }))} maxValue={800} />
          <div className="mt-6">
            <DataTable
              columns={[
                { key: 'day', label: 'Day' },
                { key: 'amount', label: 'Sales', render: (row) => peso(row.amount) },
              ]}
              rows={dailySales.map((item) => ({ id: item.day, ...item }))}
            />
          </div>
        </section>
        <div className="space-y-4">
          <SideCard title="Category contribution">
            <ul className="space-y-3">
              {categorySales.map((item) => (
                <li key={item.category}>
                  <div className="mb-1 flex justify-between text-sm">
                    <span>{item.category}</span>
                    <span>{peso(item.amount)}</span>
                  </div>
                  <ProgressBar value={(item.amount / maxCategory) * 100} />
                </li>
              ))}
            </ul>
          </SideCard>
          <SideCard title="Sales by payment method">
            <DataTable
              columns={[
                { key: 'method', label: 'Method' },
                { key: 'amount', label: 'Amount', render: (row) => peso(row.amount) },
              ]}
              rows={salesByPayment.map((item) => ({ id: item.method, ...item }))}
            />
          </SideCard>
        </div>
      </div>
    </div>
  )
}
