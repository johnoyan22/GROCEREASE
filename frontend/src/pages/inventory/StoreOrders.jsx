import InventoryLayout from '../../components/inventory/layout/InventoryLayout';
import OrderWorkspace from '../../components/orders/OrderWorkspace';

export default function StoreOrders() {
  return <InventoryLayout activePage="Store Orders"><OrderWorkspace role="inventory_worker" title="Store Orders" /></InventoryLayout>;
}
