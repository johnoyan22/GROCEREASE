import {
  CategoryTagIcon,
  PauseCircleIcon,
  ProductBoxIcon,
  StockUpdateIcon,
  VerificationIcon,
} from "../shared/InventoryIcons";

const productStats = [
  {
    title: "Total Products",
    value: "352",
    description: "All registered products",
    icon: <ProductBoxIcon />,
    color: "bg-green-50 text-green-700",
  },
  {
    title: "Active Products",
    value: "318",
    description: "Currently available",
    icon: <VerificationIcon className="h-5 w-5" />,
    color: "bg-blue-50 text-blue-700",
  },
  {
    title: "Inactive Products",
    value: "34",
    description: "Temporarily unavailable",
    icon: <PauseCircleIcon />,
    color: "bg-orange-50 text-orange-700",
  },
  {
    title: "Categories",
    value: "24",
    description: "Product categories",
    icon: <CategoryTagIcon />,
    color: "bg-purple-50 text-purple-700",
  },
  {
    title: "Last Updated",
    value: "May 23, 2026",
    description: "10:30 AM",
    icon: <StockUpdateIcon className="h-5 w-5" />,
    color: "bg-cyan-50 text-cyan-700",
  },
];

function ProductStatCards() {
  return (
    <section aria-label="Product summary" className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
      {productStats.map((stat) => (
        <article key={stat.title} className="flex min-h-28 items-center gap-3 rounded-xl border border-gray-200 bg-white p-4">
          <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-lg font-bold ${stat.color}`}>
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

export default ProductStatCards;
