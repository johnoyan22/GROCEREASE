import { 
  ShoppingBag, 
  AlertTriangle, 
  ShieldAlert, 
  DollarSign, 
  Filter, 
  Lock, 
  Ban 
} from 'lucide-react';

export default function CopManagement() {
  const shoppers = [
    { name: 'Maria Santos', id: 'COP-100512', amount: '₱2,450.00', date: 'May 16, 2025', count: 0, status: 'Active' },
    { name: 'John Reyes', id: 'COP-100498', amount: '₱3,120.00', date: 'May 14, 2025', count: 1, status: 'Warning' },
    { name: 'Liza Gomez', id: 'COP-10047', amount: '₱1,980.00', date: 'May 11, 2025', count: 2, status: 'Restricted 30 Days' },
    { name: 'David Garcia', id: 'COP-100452', amount: '₱4,175.00', date: 'May 09, 2025', count: 2, status: 'Restricted 30 Days' },
    { name: 'Mark Dela Cruz', id: 'COP-100401', amount: '₱5,890.00', date: 'May 05, 2025', count: 3, status: 'Permanent Restriction' },
  ];

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">COP Management</h1>
        <p className="text-xs text-slate-500">Monitor failure-to-claim records and enforce account restrictions for Cash on Pickup (COP) orders.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <CopCard icon={ShoppingBag} label="Total COP Orders Today" value="214" sub="↑ 18.7% vs yesterday" />
        <CopCard icon={AlertTriangle} label="Failed Claims This Week" value="23" sub="↓ 8.0% vs last week" isRed />
        <CopCard icon={ShieldAlert} label="Restricted Accounts" value="12" sub="↑ 3 vs last week" isOrange />
        <CopCard icon={DollarSign} label="Max COP Order Policy" value="₱15,000.00" sub="Per order limit" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
          <div className="flex justify-between items-center mb-6">
            <h3 className="font-bold text-slate-800">Failure-to-Claim Monitoring</h3>
            <button className="flex items-center gap-1.5 border border-slate-200 px-3 py-1.5 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-50">
              <Filter size={14} /> Filter
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="text-slate-400 border-b border-slate-100">
                  <th className="pb-3 font-semibold">Shopper</th>
                  <th className="pb-3 font-semibold">Order ID</th>
                  <th className="pb-3 font-semibold">Amount</th>
                  <th className="pb-3 font-semibold">Last Date</th>
                  <th className="pb-3 font-semibold text-center">Failed</th>
                  <th className="pb-3 font-semibold">Status</th>
                  <th className="pb-3 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {shoppers.map((s, i) => (
                  <tr key={i} className="hover:bg-slate-50/50">
                    <td className="py-3 font-semibold text-slate-700">{s.name}</td>
                    <td className="py-3 text-slate-500">{s.id}</td>
                    <td className="py-3 font-bold">{s.amount}</td>
                    <td className="py-3 text-slate-500">{s.date}</td>
                    <td className="py-3 text-center font-bold">{s.count}</td>
                    <td className="py-3">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                        s.status === 'Active' ? 'bg-emerald-50 text-emerald-700' :
                        s.status === 'Warning' ? 'bg-amber-50 text-amber-700' : 'bg-red-50 text-red-700'
                      }`}>
                        {s.status}
                      </span>
                    </td>
                    <td className="py-3 text-right">
                      <button className="text-[11px] font-semibold px-2.5 py-1 border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50">
                        View History
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="space-y-6">
          <div className="bg-white rounded-2xl border border-slate-200 p-5">
            <h3 className="font-bold text-sm text-slate-800 mb-3">COP Restriction Rules</h3>
            <div className="space-y-3 text-xs">
              <RuleItem icon={AlertTriangle} title="Warning Stage" desc="After 1 failed claim: User receives warning." tone="amber" />
              <RuleItem icon={Lock} title="Temporary Restriction" desc="After 2 failed claims: 30 days blocked from COP." tone="orange" />
              <RuleItem icon={Ban} title="Permanent Restriction" desc="After 3+ failed claims: Permanently restricted." tone="red" />
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 p-5">
            <h3 className="font-bold text-sm text-slate-800 mb-3">Recent COP Activity</h3>
            <div className="space-y-3 text-xs">
              <ActivityItem text="Warning issued to Liza Gomez" time="9:21 AM" />
              <ActivityItem text="John Reyes restricted for 30 days" time="9:16 AM" />
              <ActivityItem text="Restriction lifted for Ana Villanueva" time="8:45 AM" />
              <ActivityItem text="Mark Dela Cruz permanently restricted" time="8:32 AM" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function CopCard({ icon: Icon, label, value, sub, isRed, isOrange }) {
  return (
    <div className="bg-white p-4 rounded-2xl border border-slate-200 flex items-center gap-4">
      <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${
        isRed ? 'bg-red-50 text-red-600' : isOrange ? 'bg-amber-50 text-amber-600' : 'bg-emerald-50 text-emerald-600'
      }`}>
        <Icon size={22} />
      </div>
      <div>
        <p className="text-[11px] text-slate-400 font-medium">{label}</p>
        <p className="text-xl font-bold text-slate-800 leading-tight">{value}</p>
        <p className="text-[10px] text-slate-400 mt-0.5">{sub}</p>
      </div>
    </div>
  );
}

function RuleItem({ icon: Icon, title, desc, tone }) {
  const tones = {
    amber: 'text-amber-600 bg-amber-50',
    orange: 'text-orange-600 bg-orange-50',
    red: 'text-red-600 bg-red-50',
  };
  return (
    <div className="flex gap-3 p-2.5 rounded-xl border border-slate-100">
      <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${tones[tone]}`}><Icon size={14} /></div>
      <div>
        <p className="font-bold text-slate-800">{title}</p>
        <p className="text-slate-400 text-[11px] leading-tight mt-0.5">{desc}</p>
      </div>
    </div>
  );
}

function ActivityItem({ text, time }) {
  return (
    <div className="flex justify-between items-center py-1.5 border-b border-slate-50">
      <span className="text-slate-700 font-medium">{text}</span>
      <span className="text-[10px] text-slate-400">{time}</span>
    </div>
  );
}