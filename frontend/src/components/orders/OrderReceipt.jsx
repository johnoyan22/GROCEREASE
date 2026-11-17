import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { getOrderReceipt, getOrderSummary } from '../../services/api';

const money = new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' });
const localTime = new Intl.DateTimeFormat('en-PH', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Manila' });
const stamp = value => value ? localTime.format(new Date(value)) : 'Not scheduled';

export function OrderDocumentDialog({ orderId, role, summary = false, onClose }) {
  const dialog = useRef(null);
  const [documentData, setDocumentData] = useState(null);
  const [error, setError] = useState('');
  useEffect(function () {
    const element = dialog.current;
    element.showModal();
    const controller = new AbortController();
    let active = true;
    const read = summary ? getOrderSummary : getOrderReceipt;
    read(orderId, role, { signal: controller.signal }).then(function (result) { if (active) setDocumentData(summary ? result.summary : result.receipt); })
      .catch(function (failure) { if (active && failure.name !== 'AbortError') setError(failure.message); });
    return function () { active = false; controller.abort(); element.close(); };
  }, [orderId, role, summary]);
  const order = documentData?.order;
  return createPortal(<dialog id="order-document" ref={dialog} aria-labelledby="document-title" onCancel={event => { event.preventDefault(); onClose(); }} className="fixed inset-0 m-auto max-h-[90dvh] w-[min(95vw,760px)] overflow-y-auto rounded-xl border border-gray-200 bg-white p-5 shadow-xl backdrop:bg-black/40">
    <style>{`@media print {
      @page { size: A4; margin: 15mm; }
      html, body { height: auto !important; overflow: visible !important; }
      body > * { display: none !important; }
      body > #order-document { display: block !important; position: static !important; inset: auto !important; width: 100% !important; max-width: none !important; height: auto !important; max-height: none !important; overflow: visible !important; margin: 0 !important; padding: 0 !important; border: 0 !important; box-shadow: none !important; color: black; }
      #order-document::backdrop { display: none !important; }
      #order-document .document-actions { display: none !important; }
      #order-document thead { display: table-header-group; }
      #order-document tr, #order-document .document-totals, #order-document footer { break-inside: avoid; }
      #order-document table { font-size: 10pt; table-layout: fixed; }
    }`}</style>
    <h2 id="document-title" className="text-xl font-bold">{summary ? 'GrocerEase Order Summary' : 'GrocerEase Pickup Receipt'}</h2>
    {error && <p role="alert" className="mt-4 text-sm text-red-700">{error}</p>}
    {!order && !error && <p role="status" className="mt-4">Loading order document...</p>}
    {order && <div className="mt-4 space-y-3 text-sm">
      {order.sandbox && <p className="rounded-lg border-2 border-amber-600 p-2 font-bold">TEST / SANDBOX PAYMENT - No real money collected through this integration.</p>}
      <h3 className="text-lg font-semibold">{order.store_name}</h3><p className="whitespace-pre-wrap break-words">{order.store_address}</p>
      <p className="font-semibold">Order reference: {order.order_reference}</p>
      {!summary && <p>Receipt: {documentData.receipt_number}</p>}
      <p>Ordered: {stamp(order.created_at)} (Philippine time)</p><p>Shopper: {order.shopper_name}</p>
      <p>Pickup: {stamp(order.pickup_window_start_at)} to {stamp(order.pickup_window_end_at)} (Philippine time)</p>
      <p>Payment: {order.payment_method === 'cash_on_pickup' ? 'Cash on Pickup' : 'Digital'} - {order.payment_confirmed ? 'Payment confirmed' : order.payment_status === 'paid' ? 'Awaiting verified evidence' : order.payment_display_status || order.payment_status}</p>
      <p>Current order status: {order.status.replaceAll('_', ' ')} - Claim status: {order.claim_status?.replaceAll('_', ' ')}</p>
      {summary ? <p>This summary records the order. Payment and physical handover require separate confirmation.</p> : <p>Completed handover: {stamp(documentData.handed_over_at)} (Philippine time)<br />Actual claimant: {documentData.claimant_name}</p>}
      <table className="w-full table-fixed text-left text-xs sm:text-sm"><thead><tr className="border-b border-gray-300"><th scope="col" className="w-[43%] py-2">Item / size / unit</th><th scope="col" className="w-[12%]">Qty</th><th scope="col" className="w-[23%]">Unit price</th><th scope="col" className="w-[22%]">Total</th></tr></thead><tbody>{order.items.map((item, index) => <tr key={index} className="border-b border-gray-200"><td className="break-words py-3 pr-2">{item.product_name}<span className="block">{item.size} {item.selling_unit}</span></td><td>{item.quantity}</td><td className="break-words">{money.format(item.unit_price_centavos / 100)}</td><td className="break-words">{money.format(item.line_total_centavos / 100)}</td></tr>)}</tbody></table>
      <div className="document-totals space-y-2 pt-3"><p>Subtotal: {money.format(order.subtotal_centavos / 100)}</p><p>Service fee: {money.format(order.service_fee_centavos / 100)}</p><p className="text-lg font-bold">Grand total: {money.format(order.total_centavos / 100)}</p>{!summary && <p className="font-bold">Confirmed amount paid: {money.format(documentData.amount_paid_centavos / 100)}</p>}</div>
      <footer className="space-y-2 border-t border-gray-300 pt-4 text-xs"><p>Order record only. The grocery's sales invoice is issued separately.</p><p className="font-bold">THIS DOCUMENT IS NOT VALID FOR CLAIM OF INPUT TAX.</p></footer>
    </div>}
    <div className="document-actions mt-6 flex flex-wrap gap-3"><button type="button" disabled={!order} onClick={() => window.print()} className="rounded-lg bg-green-700 px-4 py-2 text-sm text-white disabled:opacity-50">{summary ? 'Print / Save Order Summary' : 'Print Pickup Receipt'}</button><button type="button" onClick={onClose} className="rounded-lg border border-gray-300 px-4 py-2 text-sm">Close</button></div>
  </dialog>, document.body);
}

export default function OrderReceipt({ orderId, role, summary = false }) {
  const [open, setOpen] = useState(false);
  return <><button type="button" onClick={() => setOpen(true)} className="mt-4 rounded-lg border border-green-700 px-4 py-2 text-sm text-green-800">{summary ? 'View / Print Order Summary' : 'View / Print Pickup Receipt'}</button>{open && <OrderDocumentDialog orderId={orderId} role={role} summary={summary} onClose={() => setOpen(false)} />}</>;
}
