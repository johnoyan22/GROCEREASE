import InventoryLayout from '../../components/inventory/layout/InventoryLayout';
import StockWorkspace from '../../components/inventory/stock-management/StockWorkspace';

export default function StockVerificationRequests() {
  return <InventoryLayout activePage="Stock Verification Requests"><StockWorkspace title="Stock Correction Requests" initialView="requests" /></InventoryLayout>;
}
