import InventoryLayout from '../../components/inventory/layout/InventoryLayout';
import StockWorkspace from '../../components/inventory/stock-management/StockWorkspace';

export default function LowStockMonitoring() {
  return <InventoryLayout activePage="Low Stock Monitoring"><StockWorkspace title="Low Stock Monitoring" initialView="low" /></InventoryLayout>;
}
