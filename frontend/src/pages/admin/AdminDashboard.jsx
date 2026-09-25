import { useNavigate } from 'react-router-dom';
import { 
  Users, 
  ShoppingCart, 
  Package, 
  Ban, 
  DollarSign, 
  Coins, 
  ArrowUp, 
  ArrowDown, 
  RotateCw 
} from 'lucide-react';

export default function AdminDashboard() {
  const navigate = useNavigate();

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Administrator Dashboard</h1>
        <p className="text-xs text-slate-500 mt-0.5">
          Monitor operations, manage users, inventory, pricing, COP rules, and reports.
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3.5">
        <StatCard icon={Users} label="Total Users" value="1,248" change="5.2% vs last month" isPositive={true} iconBg="bg-emerald-50 text-emerald-600" />
        <StatCard icon={ShoppingCart} label="Active Orders" value="156" change="12.8% vs yesterday" isPositive={true} iconBg="bg-emerald-50 text-emerald-600" />
        <StatCard icon={Package} label="Low Stock Products" value="23" change="8.3% vs yesterday" isPositive={false} iconBg="bg-amber-50 text-amber-600" />
        <StatCard icon={Ban} label="COP Restricted Accounts" value="14" change="16.7% vs last month" isPositive={false} iconBg="bg-red-50 text-red-600" />
        <StatCard icon={DollarSign} label="Today's Sales" value="₱125,340.00" change="9.6% vs yesterday" isPositive={true} iconBg="bg-emerald-50 text-emerald-600" />
        <StatCard icon={Coins} label="Service Charge Pool" value="₱18,250.75" change="4.3% vs yesterday" isPositive={true} iconBg="bg-emerald-50 text-emerald-600" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="bg-white rounded-2xl border border-slate-200 p-5 flex flex-col justify-between shadow-sm">
          <div>
            <div className="flex justify-between items-center mb-4">
              <div className="flex items-center gap-2">
                <Package size={18} className="text-emerald-600" />
                <h3 className="font-bold text-sm text-slate-800">Stock Overview</h3>
              </div>
              <button onClick={() => navigate('/admin/stock')} className="text-xs text-emerald-600 hover:underline font-medium">
                View All
              </button>
            </div>

            <table className="w-full text-left text-xs">
              <thead>
                <tr className="text-slate-400 border-b border-slate-100">
                  <th className="pb-2 font-medium">Product</th>
                  <th className="pb-2 font-medium">Stock Level</th>
                  <th className="pb-2 font-medium">Status</th>
                  <th className="pb-2 font-medium text-right">Limit</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {[
                  { name: 'Jasmine Rice 5kg', stock: 120, status: 'In Stock', limit: 20, tone: 'green' },
                  { name: 'Cooking Oil 1L', stock: 18, status: 'Low Stock', limit: 20, tone: 'yellow' },
                  { name: 'Chicken Thigh (1kg)', stock: 6, status: 'Critical', limit: 10, tone: 'red' },
                  { name: 'Eggs (Tray)', stock: 42, status: 'In Stock', limit: 15, tone: 'green' },
                  { name: 'Milk 1L', stock: 8, status: 'Low Stock', limit: 10, tone: 'yellow' },
                ].map((row, i) => (
                  <tr key={i} className="hover:bg-slate-50/50">
                    <td className="py-2.5 font-medium text-slate-700">{row.name}</td>
                    <td className="py-2.5 font-bold">{row.stock}</td>
                    <td className="py-2.5">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                        row.tone === 'green' ? 'bg-emerald-50 text-emerald-700' :
                        row.tone === 'yellow' ? 'bg-amber-50 text-amber-700' : 'bg-red-50 text-red-700'
                      }`}>
                        {row.status}
                      </span>
                    </td>
                    <td className="py-2.5 text-right text-slate-400 font-medium">{row.limit}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="pt-4 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-400">
            <span>Last updated: May 16, 2025 9:30 AM</span>
            <button className="flex items-center gap-1 text-emerald-700 font-semibold hover:underline">
              <RotateCw size={12} /> Refresh
            </button>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 p-5 flex flex-col justify-between shadow-sm">
          <div>
            <div className="flex justify-between items-center mb-4">
              <div className="flex items-center gap-2">
                <Users size={18} className="text-emerald-600" />
                <h3 className="font-bold text-sm text-slate-800">Role Management</h3>
              </div>
              <button onClick={() => navigate('/admin/roles')} className="text-xs text-emerald-600 hover:underline font-medium">
                Manage Roles
              </button>
            </div>

            <div className="space-y-3">
              {[
                { role: 'Shoppers', count: '864 Users', tags: ['Browse', 'Order'] },
                { role: 'Supervisors', count: '48 Users', tags: ['Approve', 'Monitor'] },
                { role: 'Inventory Workers', count: '24 Users', tags: ['Stock In', 'Stock Out'] },
                { role: 'Administrators', count: '6 Users', tags: ['All Access'] },
              ].map((r, i) => (
                <div key={i} className="flex items-center justify-between p-2 rounded-xl hover:bg-slate-50 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-emerald-50 flex items-center justify-center text-emerald-700 text-xs font-bold">
                      {r.role[0]}
                    </div>
                    <div>
                      <p className="text-xs font-bold text-slate-800">{r.role}</p>
                      <p className="text-[11px] text-slate-400">{r.count}</p>
                    </div>
                  </div>
                  <div className="flex gap-1.5">
                    {r.tags.map((t, idx) => (
                      <span key={idx} className="bg-slate-100 text-slate-600 text-[10px] font-medium px-2 py-0.5 rounded-md">
                        {t}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="pt-4 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-400">
            <span>Total Roles: 4 | Total Users: 942</span>
            <button onClick={() => navigate('/admin/roles')} className="text-emerald-700 font-semibold hover:underline">
              View All
            </button>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 p-5 flex flex-col justify-between shadow-sm">
          <div>
            <div className="flex justify-between items-center mb-4">
              <div className="flex items-center gap-2">
                <DollarSign size={18} className="text-emerald-600" />
                <h3 className="font-bold text-sm text-slate-800">Financial Setup</h3>
              </div>
              <button onClick={() => navigate('/admin/financial')} className="text-xs text-emerald-600 hover:underline font-medium">
                Manage Settings
              </button>
            </div>

            <div className="space-y-4">
              <FinancialItem 
                title="Product Markup Rules" 
                desc="Set and manage product markup percentages" 
                btnText="Configure" 
                onClick={() => navigate('/admin/financial')}
              />
              <FinancialItem 
                title="Service Charge Monitoring" 
                desc="Monitor and review service charge collections." 
                btnText="Review" 
                onClick={() => navigate('/admin/financial')}
              />
              <FinancialItem 
                title="Worker Tip Allocation Rules" 
                desc="Define and manage tip allocation rules." 
                btnText="Configure" 
                onClick={() => navigate('/admin/financial')}
              />
            </div>
          </div>

          <div className="pt-4 border-t border-slate-100 text-center">
            <span className="text-[11px] text-slate-400">Rules applied real-time across checkout</span>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
        <div className="flex justify-between items-center mb-4">
          <div className="flex items-center gap-2">
            <Ban size={18} className="text-red-500" />
            <h3 className="font-bold text-sm text-slate-800">Failure-to-Claim Monitoring (COP)</h3>
          </div>
          <button onClick={() => navigate('/admin/cop')} className="text-xs text-emerald-600 hover:underline font-medium">
            View All
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="text-slate-400 border-b border-slate-100">
                <th className="pb-2 font-medium">Shopper</th>
                <th className="pb-2 font-medium">Last Order Date</th>
                <th className="pb-2 font-medium">Days Unclaimed</th>
                <th className="pb-2 font-medium text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {[
                { name: 'Maria Santos', date: 'May 10, 2025', days: '6 days' },
                { name: 'John Reyes', date: 'May 09, 2025', days: '7 days' },
                { name: 'Liza Gomez', date: 'May 08, 2025', days: '8 days' },
              ].map((c, i) => (
                <tr key={i} className="hover:bg-slate-50/50">
                  <td className="py-2.5 flex items-center gap-2.5 font-medium text-slate-700">
                    <div className="w-7 h-7 rounded-full bg-slate-200 flex items-center justify-center font-bold text-[10px]">
                      {c.name[0]}
                    </div>
                    {c.name}
                  </td>
                  <td className="py-2.5 text-slate-500">{c.date}</td>
                  <td className="py-2.5 text-red-500 font-semibold">{c.days}</td>
                  <td className="py-2.5 text-right">
                    <button 
                      onClick={() => navigate('/admin/cop')}
                      className="text-red-500 bg-red-50 border border-red-200 px-3 py-1 rounded-lg text-[11px] font-semibold hover:bg-red-100"
                    >
                      Restrict
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function StatCard({ icon: Icon, label, value, change, isPositive, iconBg }) {
  return (
    <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
      <div className={`w-9 h-9 rounded-xl flex items-center justify-center mb-3 ${iconBg}`}>
        <Icon size={18} />
      </div>
      <div>
        <p className="text-[11px] font-medium text-slate-500">{label}</p>
        <h4 className="text-lg font-bold text-slate-900 tracking-tight mt-0.5">{value}</h4>
        <div className={`flex items-center gap-0.5 text-[10px] font-semibold mt-1.5 ${isPositive ? 'text-emerald-600' : 'text-red-500'}`}>
          {isPositive ? <ArrowUp size={11} /> : <ArrowDown size={11} />}
          <span>{change}</span>
        </div>
      </div>
    </div>
  );
}

function FinancialItem({ title, desc, btnText, onClick }) {
  return (
    <div className="flex items-center justify-between p-3 rounded-xl border border-slate-100 bg-slate-50/50">
      <div>
        <p className="text-xs font-bold text-slate-800">{title}</p>
        <p className="text-[10px] text-slate-400 mt-0.5">{desc}</p>
      </div>
      <button onClick={onClick} className="text-xs font-semibold px-3 py-1.5 border border-slate-200 rounded-lg bg-white text-slate-700 hover:bg-slate-50 shadow-2xs">
        {btnText}
      </button>
    </div>
  );
}