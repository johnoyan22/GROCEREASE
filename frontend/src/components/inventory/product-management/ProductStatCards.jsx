import {
  CategoryTagIcon,
  PauseCircleIcon,
  ProductBoxIcon,
  StockUpdateIcon,
  VerificationIcon,
} from "../shared/InventoryIcons";

function ProductStatCards({ products }) {
  const availableProducts = products.filter((product) => product.hard_stock_qty > 0).length;
  const outOfStockProducts = products.filter((product) => product.hard_stock_qty === 0).length;
  const categoryCount = new Set(products.map((product) => product.category)).size;
  const latestUpdatedAt = products
    .map((product) => product.updated_at)
    .filter(Boolean)
    .sort()
    .at(-1);

  const lastUpdated = latestUpdatedAt
    ? new Date(latestUpdatedAt).toLocaleString("en-PH", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    })
    : "No updates yet";

  const productStats = [
    {
      title: "Total Products",
      value: products.length,
      description: "Assigned to this store",
      icon: <ProductBoxIcon />,
      color: "bg-green-50 text-green-700",
    },
    {
      title: "Available",
      value: availableProducts,
      description: "With physical stock",
      icon: <VerificationIcon className="h-5 w-5" />,
      color: "bg-blue-50 text-blue-700",
    },
    {
      title: "Out of Stock",
      value: outOfStockProducts,
      description: "Needs replenishment",
      icon: <PauseCircleIcon />,
      color: "bg-orange-50 text-orange-700",
    },
    {
      title: "Categories",
      value: categoryCount,
      description: "Product categories",
      icon: <CategoryTagIcon />,
      color: "bg-purple-50 text-purple-700",
    },
    {
      title: "Last Updated",
      value: latestUpdatedAt ? "Recorded" : "—",
      description: lastUpdated,
      icon: <StockUpdateIcon className="h-5 w-5" />,
      color: "bg-cyan-50 text-cyan-700",
    },
  ];

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
