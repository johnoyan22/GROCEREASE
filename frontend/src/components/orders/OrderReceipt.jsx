import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { getOrderReceipt } from '../../services/api';

const money = new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' });
const localTime = new Intl.DateTimeFormat('en-PH', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Manila' });

function ReceiptDialog({ orderId, role, onClose }) {
  const dialog = useRef(null);
  const [receipt, setReceipt] = useState(null);
  const [error, setError] = useState('');
  useEffect(function () {
    const element = dialog.current;
    element.showModal();
    const controller = new AbortController();
    let active = true;
    getOrderReceipt(orderId, role, { signal: controller.signal }).then(function (result) { if (active) setReceipt(result.receipt); })
      .catch(function (failure) { if (active && failure.name !== 'AbortError') setError(failure.message); });
    return function () { active = false; controller.abort(); element.close(); };
  }, [orderId, role]);
  return createPortal(<dialog id="order-receipt" ref={dialog} aria-labelledby="receipt-title" onCancel={function (event) { event.preventDefault(); onClose(); }} className="fixed inset-0 m-auto max-h-[90vh] w-[min(95vw,640px)] overflow-y-auto rounded-xl border border-gray-200 bg-white p-6 shadow-xl backdrop:bg-black/40">
    <style>{'@media print { body > * { display: none !important; } body > #order-receipt { display: block !important; position: static; width: 100%; max-height: none; overflow: visible; margin: 0; border: 0; box-shadow: none; } #order-receipt .receipt-actions { display: none !important; } }'}</style>
    <h2 id="receipt-title" className="text-xl font-bold">GrocerEase order receipt</h2>
    {error && <p role="alert" className="mt-4 text-sm text-red-700">{error}</p>}
    {!receipt && !error && <p role="status" className="mt-4">Loading completed transaction...</p>}
    {receipt && <div className="mt-4 space-y-3 text-sm"><h3 className="text-lg font-semibold">{receipt.order.store_name}</h3><p>{receipt.order.store_address}</p><p>Receipt: {receipt.receipt_number} · Transaction #{receipt.transaction_id} · Order #{receipt.order.order_id}</p><p>Shopper: {receipt.order.shopper_name}</p><p>Payment: {receipt.order.payment_method === 'cash_on_pickup' ? 'Cash on Pickup' : receipt.order.payment_method} · Paid · Completed</p><p>Handed over: {localTime.format(new Date(receipt.order.completed_at))} (Philippine time)</p><table className="w-full text-left"><thead><tr className="border-b border-gray-200"><th scope="col" className="py-2">Item</th><th scope="col">Qty</th><th scope="col">Unit price</th><th scope="col">Total</th></tr></thead><tbody>{receipt.order.items.map(function (item) { return <tr key={item.order_item_id} className="border-b border-gray-100"><td className="py-3">{item.product_name} {item.size}</td><td>{item.quantity}</td><td>{money.format(item.unit_price_centavos / 100)}</td><td>{money.format(item.line_total_centavos / 100)}</td></tr>; })}</tbody></table><p>Groceries: {money.format(receipt.order.subtotal_centavos / 100)}</p><p>Service fee: {money.format(receipt.order.service_fee_centavos / 100)}</p><p className="text-lg font-bold">Total paid: {money.format(receipt.amount_paid_centavos / 100)}</p></div>}
    <div className="receipt-actions mt-6 flex gap-3"><button type="button" disabled={!receipt} onClick={function () { window.print(); }} className="rounded-lg bg-green-700 px-4 py-2 text-sm text-white disabled:opacity-50">Print receipt</button><button type="button" onClick={onClose} className="rounded-lg border border-gray-300 px-4 py-2 text-sm">Close</button></div>
  </dialog>, document.body);
}

export default function OrderReceipt({ orderId, role }) {
  const [open, setOpen] = useState(false);
  return <><button type="button" onClick={function () { setOpen(true); }} className="mt-4 rounded-lg border border-green-700 px-4 py-2 text-sm text-green-800">View / print receipt</button>{open && <ReceiptDialog orderId={orderId} role={role} onClose={function () { setOpen(false); }} />}</>;
}
