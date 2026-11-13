import { useEffect, useRef } from 'react';
import { PickupSettingsWorkspace } from '../shared/PickupSettingsWorkspace';
export default function StorePickupSettings({ store, onClose }) {
  const dialog = useRef(null);
  useEffect(function () {
    const element = dialog.current;
    element.showModal();
    return function () { element.close(); };
  }, []);
  return <dialog ref={dialog} onCancel={function (event) { event.preventDefault(); onClose(); }} className="fixed inset-0 m-auto max-h-[90vh] w-[min(95vw,850px)] overflow-y-auto rounded-2xl bg-white p-6 shadow-xl backdrop:bg-black/40">
    <PickupSettingsWorkspace key={store.store_id} readOnly storeId={store.store_id} />
    <button type="button" onClick={onClose} className="mt-6 rounded-lg border border-gray-300 px-4 py-2 text-sm">Close</button>
  </dialog>;
}
