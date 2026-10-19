import InventoryLayout from '../../components/inventory/layout/InventoryLayout';
import StockWorkspace from '../../components/inventory/stock-management/StockWorkspace';

export default function ActivityLog() {
  return <InventoryLayout activePage="Activity Log"><StockWorkspace title="Stock Availability Activity" initialView="activity" /></InventoryLayout>;
}
