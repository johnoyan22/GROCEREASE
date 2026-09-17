import {
  LowStockIcon,
  PauseCircleIcon,
  ProductBoxIcon,
  StockUpdateIcon,
  VerificationIcon,
} from "../shared/InventoryIcons";

const stockStats = [
  {
    title: "Total Stock Items",
    value: "1,248",
    description: "Across all categories",
    color: "bg-green-50 text-green-700",
    icon: <ProductBoxIcon />,
  },
  {
    title: "In Stock",
    value: "892",
    description: "71.5% of total items",
    color: "bg-blue-50 text-blue-700",
    icon: <VerificationIcon className="h-5 w-5" />,
  },
  {
    title: "Low Stock Items",
    value: "198",
    description: "15.9% of total items",
    color: "bg-orange-50 text-orange-700",
    icon: <LowStockIcon className="h-5 w-5" />,
  },
  {
    title: "Out of Stock Items",
    value: "98",
    description: "7.8% of total items",
    color: "bg-red-50 text-red-600",
    icon: <PauseCircleIcon />,
  },
  {
    title: "Last Stock Update",
    value: "May 23, 2024",
    description: "10:30 AM",
    color: "bg-purple-50 text-purple-700",
    icon: <StockUpdateIcon className="h-5 w-5" />,
  },
];

function StockStatCards() {
  return (
    <section aria-label="Stock summary" className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
      {stockStats.map((stat) => (
        <article key={stat.title} className="flex min-h-28 items-center gap-3 rounded-xl border border-gray-200 bg-white p-4">
          <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full ${stat.color}`}>
            {stat.icon}
          </span>

          <div className="min-w-0">
            <p className="text-xs font-medium text-gray-500">{stat.title}</p>
            <p className="mt-1 truncate text-xl font-bold text-gray-800">{stat.value}</p>
            <p className="mt-1 text-[11px] text-gray-400">{stat.description}</p>
          </div>
        </article>
      ))}
    </section>
  );
}

export default StockStatCards;
