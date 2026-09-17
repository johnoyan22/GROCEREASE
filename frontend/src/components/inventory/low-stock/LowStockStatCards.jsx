import {
  LowStockIcon,
  PauseCircleIcon,
  ProductBoxIcon,
  StockUpdateIcon,
} from "../shared/InventoryIcons";

const lowStockStats = [
  { title: "Low Stock Items", value: "198", description: "15.9% of total items", color: "bg-red-50 text-red-600", icon: <ProductBoxIcon /> },
  { title: "Critical (10 or fewer)", value: "48", description: "4.0% of total items", color: "bg-orange-50 text-orange-700", icon: <PauseCircleIcon /> },
  { title: "Low (11 - 20 units)", value: "86", description: "6.9% of total items", color: "bg-yellow-50 text-yellow-700", icon: <LowStockIcon className="h-5 w-5" /> },
  { title: "Needs Reorder", value: "296", description: "Suggested for reordering", color: "bg-blue-50 text-blue-700", icon: <StockUpdateIcon className="h-5 w-5" /> },
];

function LowStockStatCards() {
  return (
    <section aria-label="Low stock summary" className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {lowStockStats.map((stat) => (
        <article key={stat.title} className="flex min-h-28 items-center gap-3 rounded-xl border border-gray-200 bg-white p-4">
          <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full ${stat.color}`}>{stat.icon}</span>
          <div>
            <p className="text-xs font-medium text-gray-500">{stat.title}</p>
            <p className="mt-1 text-xl font-bold text-gray-800">{stat.value}</p>
            <p className="mt-1 text-[11px] text-gray-400">{stat.description}</p>
          </div>
        </article>
      ))}
    </section>
  );
}

export default LowStockStatCards;
