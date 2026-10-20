import { InventoryTip } from "../shared/InventoryIcons";

function InventorySummary({ data }) {
    const counts = data.stock_statuses;
    const totalItems = data.inventory_records;
    const inventoryStatuses = [
      { label: 'In Stock', count: counts.in_stock, color: 'bg-green-600', hex: '#16a34a' },
      { label: 'Low Stock', count: counts.low_stock, color: 'bg-orange-500', hex: '#f97316' },
      { label: 'Out of Stock', count: counts.out_of_stock, color: 'bg-red-500', hex: '#ef4444' },
      { label: 'Inactive', count: counts.inactive, color: 'bg-gray-400', hex: '#9ca3af' },
    ];
    let offset = 0;
    const stops = inventoryStatuses.map(status => {
      status.percentage = totalItems ? Math.round(status.count / totalItems * 1000) / 10 : 0;
      const start = offset; offset += totalItems ? status.count / totalItems * 100 : 0;
      return status.hex + ' ' + start + '% ' + offset + '%';
    });
    return(
        <section className="rounded-xl border border-gray-200 bg-white p-5">
            <div className="mb-4 flex items-center justify-between">
                <h2 className="text-base font-semibold text-gray-800">Inventory Summary</h2>
            </div>
            <div className="flex flex-col items-center justify-center gap-4 sm:flex-row">
                <div className="flex h-28 w-28 shrink-0 items-center justify-center rounded-full"
                    style={{
                            background: totalItems ? 'conic-gradient(' + stops.join(', ') + ')' : '#e5e7eb',
                            }}>
                    <div className="flex h-20 w-20 items-center justify-center rounded-full bg-white">
                        <div className="text-center">
                            <p className="text-xl font-bold text-gray-800">{totalItems.toLocaleString()}</p>
                            <p className="text-xs text-gray-500">Product records</p>
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

            <p className="mt-4 text-xs text-gray-600">Physical: {data.physical_units} - Reserved: {data.reserved_units} - Available: {data.available_units}. Low stock uses each product's configured threshold.</p>
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
