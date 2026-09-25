import { 
  Package, 
  ShoppingCart, 
  AlertTriangle, 
  AlertOctagon, 
  Tag, 
  Search, 
  Plus, 
  Eye, 
  Edit2, 
  Trash2 
} from 'lucide-react';

export default function StockManagement() {
  const products = [
    { name: 'Jasmine Rice 5kg', sku: 'RICE-SK5-001', category: 'Grains & Rice', price: '₱620.00', stock: 120, soft: 3, hard: 2, limit: 5, status: 'In Stock', tone: 'green' },
    { name: 'Del Monte Sweet Corn 425g', sku: 'CAN-DEL-425', category: 'Canned Goods', price: '₱110.00', stock: 18, soft: 1, hard: 1, limit: 10, status: 'Low Stock', tone: 'yellow' },
    { name: 'Amul Fresh Milk 1L', sku: 'MILK-AMUL-1L', category: 'Dairy', price: '₱64.00', stock: 42, soft: 2, hard: 2, limit: 5, status: 'In Stock', tone: 'green' },
    { name: 'Farm Fresh Eggs (Tray)', sku: 'EGG-TRAY-001', category: 'Dairy', price: '₱120.00', stock: 8, soft: 0, hard: 1, limit: 3, status: 'Critical', tone: 'red' },
    { name: 'Maggi 2-Min Noodles 280g', sku: 'MAGGI-280', category: 'Snacks & Noodles', price: '₱32.00', stock: 15, soft: 1, hard: 0, limit: 20, status: 'Low Stock', tone: 'yellow' },
    { name: 'Surf Excel Matic 2kg', sku: 'SURF-2KG', category: 'Household', price: '₱210.00', stock: 30, soft: 2, hard: 1, limit: 4, status: 'In Stock', tone: 'green' },
    { name: 'Fortune Sunlite Oil 1L', sku: 'OIL-SUN-1L', category: 'Cooking Oil', price: '₱145.00', stock: 6, soft: 1, hard: 1, limit: 4, status: 'Critical', tone: 'red' },
  ];

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Stock Management</h1>
        <p className="text-xs text-slate-500">Track and manage stock levels, soft deductions, hard deductions, and product quantity limits.</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3.5">
        <SmallCard label="Total Products" value="152" sub="↑ 8 new this month" icon={Package} tone="emerald" />
        <SmallCard label="In Stock" value="112" sub="73.68% of total" icon={ShoppingCart} tone="emerald" />
        <SmallCard label="Low Stock" value="26" sub="17.11% of total" icon={AlertTriangle} tone="amber" />
        <SmallCard label="Critical Stock" value="14" sub="9.21% of total" icon={AlertOctagon} tone="red" />
        <SmallCard label="Quantity Limits" value="38" sub="25.00% of total" icon={Tag} tone="emerald" />
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
          <div className="relative flex-1 min-w-[240px]">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <input 
              type="text" 
              placeholder="Search products by name or SKU..." 
              className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-xl text-xs bg-slate-50 focus:outline-none focus:ring-1 focus:ring-emerald-600"
            />
          </div>
          <select className="border border-slate-200 rounded-xl text-xs px-3 py-2 bg-slate-50 text-slate-600">
            <option>All Categories</option>
          </select>
          <select className="border border-slate-200 rounded-xl text-xs px-3 py-2 bg-slate-50 text-slate-600">
            <option>All Stock Status</option>
          </select>
          <button className="bg-[#0E5C2F] text-white px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 hover:bg-emerald-900 transition-all">
            <Plus size={16} /> Add Product
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="text-slate-400 border-b border-slate-100">
                <th className="pb-3 font-semibold">Product</th>
                <th className="pb-3 font-semibold">Category</th>
                <th className="pb-3 font-semibold">Base Price</th>
                <th className="pb-3 font-semibold">Current Stock</th>
                <th className="pb-3 font-semibold">Soft Deduction</th>
                <th className="pb-3 font-semibold">Hard Deduction</th>
                <th className="pb-3 font-semibold">Quantity Limit</th>
                <th className="pb-3 font-semibold">Status</th>
                <th className="pb-3 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {products.map((p, i) => (
                <tr key={i} className="hover:bg-slate-50/50">
                  <td className="py-3 font-semibold text-slate-800">
                    <div>{p.name}</div>
                    <div className="text-[10px] text-slate-400">SKU: {p.sku}</div>
                  </td>
                  <td className="py-3 text-slate-500">{p.category}</td>
                  <td className="py-3 font-bold">{p.price}</td>
                  <td className="py-3 font-bold">{p.stock}</td>
                  <td className="py-3 font-semibold text-slate-600">{p.soft}</td>
                  <td className="py-3 font-semibold text-slate-600">{p.hard}</td>
                  <td className="py-3 font-semibold text-slate-600">{p.limit}</td>
                  <td className="py-3">
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                      p.tone === 'green' ? 'bg-emerald-50 text-emerald-700' :
                      p.tone === 'yellow' ? 'bg-amber-50 text-amber-700' : 'bg-red-50 text-red-700'
                    }`}>
                      {p.status}
                    </span>
                  </td>
                  <td className="py-3 text-right">
                    <div className="flex items-center justify-end gap-2 text-slate-400">
                      <button className="hover:text-emerald-700 p-1"><Eye size={15} /></button>
                      <button className="hover:text-emerald-700 p-1"><Edit2 size={15} /></button>
                      <button className="hover:text-red-600 p-1"><Trash2 size={15} /></button>
                    </div>
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

function SmallCard({ label, value, sub, icon: Icon, tone }) {
  const colors = {
    emerald: 'bg-emerald-50 text-emerald-600',
    amber: 'bg-amber-50 text-amber-600',
    red: 'bg-red-50 text-red-600',
  };
  return (
    <div className="bg-white p-4 rounded-2xl border border-slate-200 flex items-center gap-3">
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${colors[tone]}`}>
        <Icon size={18} />
      </div>
      <div>
        <p className="text-[11px] text-slate-400 font-medium">{label}</p>
        <p className="text-xl font-bold text-slate-800 leading-tight">{value}</p>
        <p className="text-[10px] text-slate-400 mt-0.5">{sub}</p>
      </div>
    </div>
  );
}