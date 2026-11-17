import { useSearchParams } from 'react-router-dom';
import InventoryLayout from '../../components/inventory/layout/InventoryLayout';
import ReportsWorkspace from '../../components/reports/ReportsWorkspace';
export default function InventoryReports() {
  const [params] = useSearchParams();
  return <InventoryLayout activePage="Reports"><ReportsWorkspace role="inventory_worker" initialType={params.get('type') === 'availability' ? 'availability' : undefined} /></InventoryLayout>;
}
