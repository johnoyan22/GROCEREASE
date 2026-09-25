import { 
  Users, 
  Shield, 
  Clock, 
  Plus, 
  Edit2, 
  Eye, 
  MoreVertical 
} from 'lucide-react';

export default function RoleManagement() {
  const roles = [
    {
      role: 'Shoppers',
      desc: 'Place orders and track deliveries',
      count: '864 Users',
      access: 'Limited',
      accessDesc: 'Placing Orders',
      permissions: ['View Orders', 'Place Orders', 'Track Orders'],
      status: 'Active',
    },
    {
      role: 'Supervisors',
      desc: 'Approve orders and monitor operations',
      count: '48 Users',
      access: 'Limited',
      accessDesc: 'Approval & Oversight',
      permissions: ['View Orders', 'Approve Orders', 'Monitor COP'],
      status: 'Active',
    },
    {
      role: 'Inventory Workers',
      desc: 'Manage inventory and stock levels',
      count: '24 Users',
      access: 'Limited',
      accessDesc: 'Inventory & Stock',
      permissions: ['Manage Stock', 'Update Inventory', 'View Orders'],
      status: 'Active',
    },
    {
      role: 'Administrators',
      desc: 'Full system access and configuration',
      count: '6 Users',
      access: 'Full',
      accessDesc: 'All Dashboards',
      permissions: ['Full Access', 'Manage Users', 'Generate Reports'],
      status: 'Active',
    },
  ];

  const matrix = [
    { module: 'Dashboard', shoppers: true, supervisors: true, inventory: true, admins: true },
    { module: 'Stock Management', shoppers: false, supervisors: true, inventory: true, admins: true },
    { module: 'Financial Setup', shoppers: false, supervisors: false, inventory: false, admins: true },
    { module: 'COP Management', shoppers: true, supervisors: true, inventory: true, admins: true },
    { module: 'Report Module', shoppers: false, supervisors: true, inventory: true, admins: true },
    { module: 'Settings', shoppers: false, supervisors: false, inventory: false, admins: true },
  ];

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Role Management</h1>
        <p className="text-xs text-slate-500">Manage user roles, dashboards, views, and permissions across the GrocerEase system.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-2xl border border-slate-200 flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center"><Users size={22} /></div>
          <div>
            <p className="text-xs text-slate-400 font-medium">Total Roles</p>
            <h3 className="text-2xl font-bold text-slate-800">4</h3>
            <p className="text-[10px] text-emerald-600 font-medium">● All roles in the system</p>
          </div>
        </div>
        <div className="bg-white p-4 rounded-2xl border border-slate-200 flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center"><Users size={22} /></div>
          <div>
            <p className="text-xs text-slate-400 font-medium">Total Users</p>
            <h3 className="text-2xl font-bold text-slate-800">942</h3>
            <p className="text-[10px] text-emerald-600 font-medium">● Across all roles</p>
          </div>
        </div>
        <div className="bg-white p-4 rounded-2xl border border-slate-200 flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center"><Clock size={22} /></div>
          <div>
            <p className="text-xs text-slate-400 font-medium">Pending Access Requests</p>
            <h3 className="text-2xl font-bold text-slate-800">12</h3>
            <p className="text-[10px] text-amber-600 font-medium">● Require review</p>
          </div>
        </div>
        <div className="bg-white p-4 rounded-2xl border border-slate-200 flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center"><Shield size={22} /></div>
          <div>
            <p className="text-xs text-slate-400 font-medium">Active Permissions</p>
            <h3 className="text-2xl font-bold text-slate-800">28</h3>
            <p className="text-[10px] text-emerald-600 font-medium">● System permissions</p>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
        <div className="flex justify-between items-center mb-6">
          <h2 className="font-bold text-slate-800">Roles Overview</h2>
          <button className="bg-[#0E5C2F] text-white px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 hover:bg-emerald-900 transition-all">
            <Plus size={16} /> Add New Role
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="text-slate-400 border-b border-slate-100">
                <th className="pb-3 font-semibold">Role</th>
                <th className="pb-3 font-semibold">User Count</th>
                <th className="pb-3 font-semibold">Dashboard Access</th>
                <th className="pb-3 font-semibold">Key Permissions</th>
                <th className="pb-3 font-semibold">Status</th>
                <th className="pb-3 font-semibold text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {roles.map((r, i) => (
                <tr key={i} className="hover:bg-slate-50/50">
                  <td className="py-4">
                    <p className="font-bold text-slate-800">{r.role}</p>
                    <p className="text-[11px] text-slate-400">{r.desc}</p>
                  </td>
                  <td className="py-4 font-semibold text-slate-700">{r.count}</td>
                  <td className="py-4">
                    <span className="font-bold text-slate-800 block">{r.access}</span>
                    <span className="text-[11px] text-slate-400">{r.accessDesc}</span>
                  </td>
                  <td className="py-4">
                    <div className="flex gap-1.5 flex-wrap">
                      {r.permissions.map((p, idx) => (
                        <span key={idx} className="bg-emerald-50 text-emerald-700 border border-emerald-100 px-2 py-0.5 rounded-md text-[10px] font-semibold">
                          {p}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="py-4">
                    <span className="text-emerald-600 font-semibold flex items-center gap-1 text-[11px]">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-600"></span> Active
                    </span>
                  </td>
                  <td className="py-4 text-right">
                    <div className="flex items-center justify-end gap-3 text-slate-600">
                      <button className="flex items-center gap-1 hover:text-emerald-700 font-medium"><Edit2 size={13} /> Edit</button>
                      <button className="flex items-center gap-1 hover:text-emerald-700 font-medium"><Eye size={13} /> View Permissions</button>
                      <button className="text-slate-400 hover:text-slate-600"><MoreVertical size={16} /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h2 className="font-bold text-slate-800">Permission Matrix Preview</h2>
            <p className="text-xs text-slate-400">Overview of module access by role</p>
          </div>
          <div className="flex items-center gap-4 text-xs font-semibold text-slate-500">
            <span className="flex items-center gap-1"><span className="w-3.5 h-3.5 bg-emerald-600 text-white rounded-full flex items-center justify-center text-[9px]">✓</span> Full Access</span>
            <span className="flex items-center gap-1"><span className="w-3.5 h-3.5 border border-emerald-600 text-emerald-600 rounded-full flex items-center justify-center text-[9px]">✓</span> Limited Access</span>
            <span className="flex items-center gap-1"><span className="w-3.5 h-3.5 bg-slate-200 text-slate-500 rounded-full flex items-center justify-center text-[9px]">-</span> No Access</span>
          </div>
        </div>

        <table className="w-full text-left text-xs">
          <thead>
            <tr className="text-slate-400 border-b border-slate-100">
              <th className="pb-3 font-semibold">Module</th>
              <th className="pb-3 font-semibold text-center">Shoppers</th>
              <th className="pb-3 font-semibold text-center">Supervisors</th>
              <th className="pb-3 font-semibold text-center">Inventory Workers</th>
              <th className="pb-3 font-semibold text-center">Administrators</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {matrix.map((row, i) => (
              <tr key={i} className="hover:bg-slate-50/50">
                <td className="py-3.5 font-bold text-slate-700">{row.module}</td>
                <td className="py-3.5 text-center">{renderIcon(row.shoppers)}</td>
                <td className="py-3.5 text-center">{renderIcon(row.supervisors)}</td>
                <td className="py-3.5 text-center">{renderIcon(row.inventory)}</td>
                <td className="py-3.5 text-center">{renderIcon(row.admins)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function renderIcon(val) {
  if (val) {
    return <span className="inline-flex w-4 h-4 bg-emerald-600 text-white rounded-full items-center justify-center text-[10px] font-bold">✓</span>;
  }
  return <span className="inline-flex w-4 h-4 bg-slate-200 text-slate-400 rounded-full items-center justify-center text-[10px] font-bold">-</span>;
}