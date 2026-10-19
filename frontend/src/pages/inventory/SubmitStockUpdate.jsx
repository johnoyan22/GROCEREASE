import InventoryLayout from '../../components/inventory/layout/InventoryLayout';
import StockWorkspace from '../../components/inventory/stock-management/StockWorkspace';

export default function SubmitStockUpdate() {
  return <InventoryLayout activePage="Submit Stock Update"><StockWorkspace title="Submit Stock Correction" initialView="submit" /></InventoryLayout>;
}
