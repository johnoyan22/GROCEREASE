import { useState } from 'react';
import { User, Bell, CheckCircle2 } from 'lucide-react';

export default function Settings() {
  const [toggles, setToggles] = useState([true, true, true, true]);

  const toggleSwitch = (index) => {
    setToggles((prev) => prev.map((val, i) => (i === index ? !val : val)));
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Settings</h1>
        <p className="text-xs text-slate-500">Manage administrator account, systems preference, alerts, and report defaults.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm flex flex-col justify-between">
          <div className="space-y-6">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                <User size={24} />
              </div>
              <h2 className="text-lg font-bold text-slate-800">Account & Security</h2>
            </div>

            <div>
              <div className="flex justify-between items-center mb-1">
                <label className="text-xs font-bold text-slate-700">Username</label>
                <button className="text-xs text-emerald-700 font-semibold border border-emerald-600 px-3 py-1 rounded-lg hover:bg-emerald-50">
                  Change Password
                </button>
              </div>
              <p className="text-sm font-semibold text-slate-800">Admin</p>
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700">Email Address</label>
              <p className="text-sm font-semibold text-slate-800">Admin@gmail.com</p>
            </div>

            <div className="pt-4 border-t border-slate-100">
              <div className="flex justify-between items-center mb-1">
                <label className="text-xs font-bold text-slate-700">Mobile Verification</label>
                <button className="text-xs text-emerald-700 font-semibold border border-emerald-600 px-3 py-1 rounded-lg hover:bg-emerald-50">
                  Change Number
                </button>
              </div>
              <div className="flex items-center gap-2">
                <p className="text-sm font-semibold text-slate-800">+63 0992 324 324</p>
                <span className="flex items-center gap-1 text-[11px] font-semibold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">
                  <CheckCircle2 size={12} /> Verified
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-3 mb-6">
              <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                <Bell size={24} />
              </div>
              <h2 className="text-lg font-bold text-slate-800">Notification Preferences</h2>
            </div>

            <div className="divide-y divide-slate-100">
              {['Order Alerts', 'Inventory Low Stock Alerts', 'COP Restriction Alerts', 'Financial Report Summaries'].map((label, i) => (
                <div key={i} className="py-4 flex justify-between items-center">
                  <span className="text-sm font-semibold text-slate-700">{label}</span>
                  <button
                    onClick={() => toggleSwitch(i)}
                    className={`w-12 h-6 flex items-center rounded-full p-1 cursor-pointer transition-colors duration-200 ease-in-out ${
                      toggles[i] ? 'bg-[#0E5C2F]' : 'bg-slate-200'
                    }`}
                  >
                    <div
                      className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform duration-200 ease-in-out ${
                        toggles[i] ? 'translate-x-6' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-3 pt-2">
        <button className="bg-[#0E5C2F] text-white px-6 py-2.5 rounded-xl font-bold text-sm hover:bg-emerald-900 transition-all shadow-sm">
          Save Changes
        </button>
        <button className="bg-white border border-slate-200 text-slate-600 px-6 py-2.5 rounded-xl font-bold text-sm hover:bg-slate-50 transition-all">
          Cancel
        </button>
      </div>
    </div>
  );
}