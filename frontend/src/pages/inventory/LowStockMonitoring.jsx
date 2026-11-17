import InventoryLayout from '../../components/inventory/layout/InventoryLayout';
import AutomaticLowStock from '../../components/inventory/low-stock/AutomaticLowStock';

export default function LowStockMonitoring() {
  return <InventoryLayout activePage="Low Stock Monitoring"><AutomaticLowStock /></InventoryLayout>;
}
