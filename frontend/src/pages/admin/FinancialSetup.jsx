import { 
  Tag, 
  DollarSign, 
  Users, 
  ShoppingBag 
} from 'lucide-react';

export default function FinancialSetup() {
  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Financial Setup</h1>
        <p className="text-xs text-slate-500">Apply product markup rules, monitor service charge collections, and manage worker tip allocation rules.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatRow icon={Tag} label="Active Markup Rules" value="12" sub="↑ 2 new this month" />
        <StatRow icon={DollarSign} label="Service Charge Collected Today" value="₱18,250.75" sub="↑ 12.6% vs yesterday" />
        <StatRow icon={Users} label="Monthly Worker Tip Pool" value="₱56,340.00" sub="↑ 8.4% vs last month" />
        <StatRow icon={ShoppingBag} label="Categories with Custom Pricing" value="4" sub="of 12 total categories" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="bg-white rounded-2xl border border-slate-200 p-5 flex flex-col justify-between">
          <div>
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-bold text-sm text-slate-800">Product Markup Rules</h3>
              <button className="text-xs text-emerald-600 hover:underline">Manage Rules</button>
            </div>
            <div className="space-y-3">
              {[
                { cat: 'Basic Necessities', markup: '15%', updated: 'May 15, 2025' },
                { cat: 'Beverages', markup: '12%', updated: 'May 12, 2025' },
                { cat: 'Household Items', markup: '18%', updated: 'May 10, 2025' },
                { cat: 'Personal Care', markup: '20%', updated: 'May 08, 2025' },
              ].map((m, i) => (
                <div key={i} className="flex justify-between items-center p-3 rounded-xl border border-slate-100 bg-slate-50/50">
                  <div>
                    <p className="text-xs font-bold text-slate-800">{m.cat}</p>
                    <p className="text-[10px] text-slate-400">Updated {m.updated}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-bold text-emerald-600">{m.markup}</span>
                    <button className="text-[11px] font-semibold text-slate-600 border border-slate-200 rounded-lg px-2.5 py-1 bg-white">Edit</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <button className="w-full mt-4 py-2 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 hover:bg-slate-50">
            View All Markup Rules
          </button>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 p-5 flex flex-col justify-between">
          <div>
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-bold text-sm text-slate-800">Service Charge Monitoring</h3>
              <button className="text-xs text-emerald-600 hover:underline">View All</button>
            </div>
            <table className="w-full text-left text-xs mb-4">
              <thead>
                <tr className="text-slate-400 border-b border-slate-100">
                  <th className="pb-2">Order ID</th>
                  <th className="pb-2">Total</th>
                  <th className="pb-2">Fee</th>
                  <th className="pb-2 text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {[
                  { id: 'ORD-10091', total: '₱1,280.00', fee: '₱91.00', status: 'Collected' },
                  { id: 'ORD-10090', total: '₱2,450.50', fee: '₱122.53', status: 'Collected' },
                  { id: 'ORD-10089', total: '₱1,125.00', fee: '₱56.25', status: 'Collected' },
                  { id: 'ORD-10087', total: '₱1,975.00', fee: '₱98.75', status: 'Pending' },
                ].map((s, i) => (
                  <tr key={i}>
                    <td className="py-2 font-medium">{s.id}</td>
                    <td className="py-2">{s.total}</td>
                    <td className="py-2 font-bold">{s.fee}</td>
                    <td className="py-2 text-right">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${s.status === 'Collected' ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>
                        {s.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="p-3 bg-emerald-50 rounded-xl flex justify-between items-center text-xs">
            <span className="font-medium text-emerald-900">Total Collected (7d)</span>
            <span className="font-bold text-emerald-700 text-sm">₱123,340.00</span>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 p-5 flex flex-col justify-between">
          <div>
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-bold text-sm text-slate-800">Worker Tip Allocation</h3>
              <button className="text-xs text-emerald-600 hover:underline">Manage Rules</button>
            </div>
            <div className="p-3 border border-slate-100 rounded-xl mb-4 bg-slate-50/50">
              <p className="text-[11px] text-slate-400">Current Policy</p>
              <p className="text-xs font-bold text-slate-800">By Completed Orders (₱56,340.00 Pool)</p>
            </div>
            <div className="space-y-2 text-xs">
              {[
                { name: 'Maria Santos', orders: 128, share: '28.4%', tip: '₱16,010.56' },
                { name: 'John Reyes', orders: 96, share: '21.3%', tip: '₱12,029.42' },
                { name: 'Ana Cruz', orders: 84, share: '18.7%', tip: '₱10,536.58' },
                { name: 'Luis Gomez', orders: 72, share: '16.0%', tip: '₱9,014.40' },
              ].map((w, i) => (
                <div key={i} className="flex justify-between items-center py-1 border-b border-slate-50">
                  <span className="font-medium text-slate-700">{w.name}</span>
                  <span className="text-slate-400">{w.orders} orders ({w.share})</span>
                  <span className="font-bold text-emerald-700">{w.tip}</span>
                </div>
              ))}
            </div>
          </div>
          <button className="w-full mt-4 py-2 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 hover:bg-slate-50">
            View All Allocation Rules
          </button>
        </div>
      </div>
    </div>
  );
}

function StatRow({ icon: Icon, label, value, sub }) {
  return (
    <div className="bg-white p-4 rounded-2xl border border-slate-200 flex items-center gap-4">
      <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
        <Icon size={22} />
      </div>
      <div>
        <p className="text-[11px] text-slate-400 font-medium">{label}</p>
        <p className="text-lg font-bold text-slate-800 leading-tight">{value}</p>
        <p className="text-[10px] text-emerald-600 font-medium mt-0.5">{sub}</p>
      </div>
    </div>
  );
}