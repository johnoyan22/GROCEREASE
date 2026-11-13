import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
export default function NavigationDrawer({ children, onClose }) {
  const dialog = useRef(null);
  useEffect(() => {
    const element = dialog.current; element.showModal();
    return () => element.close();
  }, []);
  return createPortal(<dialog ref={dialog} aria-label="Navigation" onCancel={event => { event.preventDefault(); onClose(); }} className="fixed inset-y-0 left-0 m-0 h-dvh max-h-dvh w-[min(90vw,288px)] max-w-none overflow-y-auto border-0 bg-white p-0 shadow-xl backdrop:bg-black/40"><div className="sticky top-0 z-10 flex items-center justify-between border-b bg-white px-4 py-2"><span className="font-semibold text-green-900">Navigation</span><button type="button" onClick={onClose} aria-label="Close navigation menu" className="rounded-lg p-2"><X size={20} /></button></div>{children}</dialog>, document.body);
}
