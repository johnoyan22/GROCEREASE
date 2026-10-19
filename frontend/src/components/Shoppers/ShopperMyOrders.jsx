import OrderWorkspace from '../orders/OrderWorkspace';

export default function ShopperMyOrders() {
  return <div className="p-6"><OrderWorkspace role="shopper" title="My Orders" /></div>;
}
