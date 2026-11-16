import InventoryLayout from '../../components/inventory/layout/InventoryLayout';
import StockWorkspace from '../../components/inventory/stock-management/StockWorkspace';
import { useSearchParams } from 'react-router-dom';

export default function StockVerificationRequests() {
  const [params, setParams] = useSearchParams();
  // Missing/unknown values retain the existing correction-history default.
  const section = params.get('section') === 'addition' ? 'addition' : 'correction';

  function selectSection(nextSection) {
    if (!['addition', 'correction'].includes(nextSection) || nextSection === section) return;
    const next = new URLSearchParams(params);
    next.set('section', nextSection);
    // These list parameters cannot carry over between different request types.
    for (const name of ['page', 'search', 'status']) next.delete(name);
    setParams(next);
  }

  return <InventoryLayout activePage="Stock Verification Requests"><StockWorkspace title="Stock Request" initialView="requests" requestSection={section} onRequestSectionChange={selectSection} /></InventoryLayout>;
}
