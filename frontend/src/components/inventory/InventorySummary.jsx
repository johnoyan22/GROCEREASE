import { InventoryTip } from "./InventoryIcons";

const inventoryStatuses = [
  {
    label: "In Stock",
    count: 892,
    percentage: 71.5,
    color: "bg-green-600",
  },
  {
    label: "Low Stock",
    count: 185,
    percentage: 14.8,
    color: "bg-orange-500",
  },
  {
    label: "Out of Stock",
    count: 91,
    percentage: 7.3,
    color: "bg-red-500",
  },
  {
    label: "For Verification",
    count: 80,
    percentage: 6.4,
    color: "bg-gray-400",
  },
];

const totalItems = inventoryStatuses.reduce((total, status) => total + status.count, 0);

function InventorySummary() {
    return(
        <section className="rounded-xl border border-gray-200 bg-white p-5">
            <div className="mb-4 flex items-center justify-between">
                <h2 className="text-base font-semibold text-gray-800">Inventory Summary</h2>
            </div>
            <div className="flex flex-col items-center justify-center gap-4 sm:flex-row">
                <div className="flex h-28 w-28 shrink-0 items-center justify-center rounded-full"
                    style={{
                            background: "conic-gradient(#16a34a 0% 71.5%, #f97316 71.5% 86.3%, #ef4444 86.3% 93.6%, #9ca3af 93.6% 100%)",
                            }}>
                    <div className="flex h-20 w-20 items-center justify-center rounded-full bg-white">
                        <div className="text-center">
                            <p className="text-xl font-bold text-gray-800">{totalItems.toLocaleString()}</p>
                            <p className="text-xs text-gray-500">Total Items</p>
                        </div>
                    </div>
                </div>

                <div className="w-full max-w-[190px] space-y-3">
                    {inventoryStatuses.map((status) => (
                        <div key={status.label} className="flex items-center justify-between gap-4">
                            <div className="flex items-center gap-2">
                                <span className={`h-2.5 w-2.5 rounded-full ${status.color}`}></span>
                                <span className="text-xs text-gray-600">{status.label}</span>

                            </div>
                            <span className="whitespace-nowrap text-xs font-medium text-gray-800">
                                {status.count} ({status.percentage}%)
                            </span>

                        </div>
                    ))}
                </div>

            </div>

            <div className="mt-5 flex items-start gap-3 rounded-lg bg-green-50 p-3">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-green-100 text-green-700">
                    <InventoryTip />
                </span>
                <div>
                    <h3 className="text-sm font-semibold text-green-800">Keep inventory updated</h3>
                    <p className="mt-0.5 text-xs leading-5 text-gray-600">
                        Regular stock updates help maintain accurate inventory levels and prevent stockouts.
                    </p>
                </div>
            </div>
        </section>
    );
}

export default InventorySummary;
