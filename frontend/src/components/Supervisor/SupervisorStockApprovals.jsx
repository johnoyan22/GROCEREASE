import StockReceivingWorkspace from '../inventory/stock-management/StockReceivingWorkspace';
import StockWorkspace from '../inventory/stock-management/StockWorkspace';

export function SupervisorStockApprovals() {
  return <><StockWorkspace title="Stock Approvals" initialView="requests" supervisor /><StockReceivingWorkspace supervisor /></>;
}