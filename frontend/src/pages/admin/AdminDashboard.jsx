import useDashboardSummary from '../../hooks/useDashboardSummary';
import DashboardLoadState from '../../components/DashboardLoadState';
import { useNavigate } from 'react-router-dom';
import {
  Users,
  ShoppingCart,
  Package,
  Ban,
  DollarSign,
  Coins,
  RotateCw
} from 'lucide-react';

export default function AdminDashboard() {
  const navigate = useNavigate();
  const summary = useDashboardSummary('admin');
  const data = summary.data;
  const value = key => summary.loading ? 'Loading...' : data?.[key] ?? 'Not available';
  const money = new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' });

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Administrator Dashboard</h1>
        <p className="text-xs text-slate-500 mt-0.5">
          Monitor operations, manage users, inventory, pricing, COP rules, and reports.
        </p>
      </div>

      <DashboardLoadState summary={summary} />
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3.5">
        <StatCard icon={Users} label="Total Users" value={value('total_users')} iconBg="bg-emerald-50 text-emerald-600" />
        <StatCard icon={ShoppingCart} label="Active Orders" value={value('active_orders')} iconBg="bg-emerald-50 text-emerald-600" />
        <StatCard icon={Package} label="Low Stock Products" value={value('low_stock_products')} iconBg="bg-amber-50 text-amber-600" />
        <StatCard icon={Ban} label="COP Restricted Accounts" value={value('cop_restricted_accounts')} iconBg="bg-red-50 text-red-600" />
        <StatCard icon={DollarSign} label="Today's Sales" value={data ? money.format(data.todays_sales_centavos / 100) : value('todays_sales_centavos')} iconBg="bg-emerald-50 text-emerald-600" />
        <StatCard icon={Coins} label="Service Charge Pool" value="Not configured" iconBg="bg-emerald-50 text-emerald-600" />
      </div>

      <p className="text-xs text-slate-500">Today's sales: gross verified supermarket payments confirmed today in Asia/Manila, excluding completed refunds. SaaS subscription revenue: Not available. Low stock uses available units and each configured threshold.</p>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="bg-white rounded-2xl border border-slate-200 p-5 flex flex-col justify-between shadow-sm">
          <div>
            <div className="flex justify-between items-center mb-4">
              <div className="flex items-center gap-2">
                <Package size={18} className="text-emerald-600" />
                <h3 className="font-bold text-sm text-slate-800">Low Stock Overview</h3>
              </div>
              <button onClick={() => navigate('/admin/stores')} className="text-xs text-emerald-600 hover:underline font-medium">
                View All
              </button>
            </div>

            <table className="w-full text-left text-xs">
              <thead>
                <tr className="text-slate-400 border-b border-slate-100">
                  <th className="pb-2 font-medium">Product</th>
                  <th className="pb-2 font-medium">Available units</th>
                  <th className="pb-2 font-medium">Status</th>
                  <th className="pb-2 font-medium text-right">Threshold</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {(data?.low_stock_records ?? []).map((row) => (
                  <tr key={row.store_inventory_id} className="hover:bg-slate-50/50">
                    <td className="py-2.5 font-medium text-slate-700">{row.product_name}<span className="block text-[10px] text-slate-400">{row.store_name}</span></td>
                    <td className="py-2.5 font-bold">{row.available_stock}</td>
                    <td className="py-2.5">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                        row.available_stock > row.low_stock_threshold ? 'bg-emerald-50 text-emerald-700' :
                        row.available_stock > 0 ? 'bg-amber-50 text-amber-700' : 'bg-red-50 text-red-700'
                      }`}>
                        Low stock
                      </span>
                    </td>
                    <td className="py-2.5 text-right text-slate-400 font-medium">{row.low_stock_threshold}</td>
                  </tr>
                ))}
                {data?.low_stock_records.length === 0 && <tr><td colSpan="4" className="py-4 text-slate-500">No products at or below a configured threshold.</td></tr>}
              </tbody>
            </table>
          </div>

          <div className="pt-4 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-400">
            <span>{data ? new Date(data.server_time).toLocaleString('en-PH', { timeZone: 'Asia/Manila' }) : 'Awaiting data'}</span>
            <button onClick={summary.reload} className="flex items-center gap-1 text-emerald-700 font-semibold hover:underline">
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
              <button onClick={() => navigate('/admin/accounts')} className="text-xs text-emerald-600 hover:underline font-medium">
                Manage Accounts
              </button>
            </div>

            <div className="space-y-3">
              {(data?.roles ?? []).map((r) => (
                <div key={r.slug} className="flex items-center justify-between p-2 rounded-xl hover:bg-slate-50 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-emerald-50 flex items-center justify-center text-emerald-700 text-xs font-bold">
                      {r.name[0]}
                    </div>
                    <div>
                      <p className="text-xs font-bold text-slate-800">{r.name}</p>
                      <p className="text-[11px] text-slate-400">{r.user_count} users</p>
                    </div>
                  </div>

                </div>
              ))}
            </div>
          </div>

          <div className="pt-4 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-400">
            <span>Total Roles: {data?.roles.length ?? '?'} | Total Users: {data?.total_users ?? '?'}</span>
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
                desc="Not configured; checkout uses store selling prices."
                btnText="Configure"
                onClick={() => navigate('/admin/financial')}
              />
              <FinancialItem
                title="Service Charge Monitoring"
                desc="No service charge allocation is configured."
                btnText="Review"
                onClick={() => navigate('/admin/financial')}
              />
              <FinancialItem
                title="Worker Tip Allocation Rules"
                desc="Pending an approved allocation formula."
                btnText="Configure"
                onClick={() => navigate('/admin/financial')}
              />
            </div>
          </div>

          <div className="pt-4 border-t border-slate-100 text-center">
            <span className="text-[11px] text-slate-400">Financial allocation rules are not approved or configured.</span>
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
                <th className="pb-2 font-medium">Valid strikes</th>
                <th className="pb-2 font-medium">Current restriction</th>
                <th className="pb-2 font-medium text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {(data?.restricted_accounts ?? []).map((c) => (
                <tr key={c.user_id} className="hover:bg-slate-50/50">
                  <td className="py-2.5 flex items-center gap-2.5 font-medium text-slate-700">
                    <div className="w-7 h-7 rounded-full bg-slate-200 flex items-center justify-center font-bold text-[10px]">
                      {c.user_id}
                    </div>
                    Shopper #{c.user_id}
                  </td>
                  <td className="py-2.5 text-slate-500">{c.strike_count} valid strikes</td>
                  <td className="py-2.5 text-red-500 font-semibold">{c.strike_count >= 3 ? 'Permanent' : '30-day suspension'}</td>
                  <td className="py-2.5 text-right">
                    <button
                      onClick={() => navigate('/admin/cop')}
                      className="text-red-500 bg-red-50 border border-red-200 px-3 py-1 rounded-lg text-[11px] font-semibold hover:bg-red-100"
                    >
                      Review
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

function StatCard({ icon: Icon, label, value, iconBg }) {
  return (
    <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
      <div className={`w-9 h-9 rounded-xl flex items-center justify-center mb-3 ${iconBg}`}>
        <Icon size={18} />
      </div>
      <div>
        <p className="text-[11px] font-medium text-slate-500">{label}</p>
        <h4 className="text-lg font-bold text-slate-900 tracking-tight mt-0.5">{value}</h4>

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
