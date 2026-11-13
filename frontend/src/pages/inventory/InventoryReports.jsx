import InventoryLayout from '../../components/inventory/layout/InventoryLayout';
import ReportWorkspace from '../../components/reports/ReportWorkspace';

export default function InventoryReports() {
  return <InventoryLayout activePage="Reports"><ReportWorkspace role="inventory_worker" /></InventoryLayout>;
}
