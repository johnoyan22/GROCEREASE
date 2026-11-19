import { useEffect, useRef } from 'react';
import ShopperSidebar from './ShopperSidebar';

export default function ShopperMobileNavigation({ activeTab, onNavigate, onClose }) {
  const dialog = useRef(null);
  useEffect(() => {
    const element = dialog.current;
    const previous = document.activeElement;
    const overflow = document.body.style.overflow;
    const desktop = window.matchMedia('(min-width: 1024px)');
    const resize = () => { if (desktop.matches) onClose(); };
    element.showModal();
    document.body.style.overflow = 'hidden';
    desktop.addEventListener('change', resize);
    resize();
    return () => {
      desktop.removeEventListener('change', resize);
      element.close();
      document.body.style.overflow = overflow;
      const target = previous?.isConnected && previous.getClientRects().length ? previous : document.getElementById('shopper-content');
      target?.focus({ preventScroll: true });
    };
  }, [onClose]);
  return <dialog id="shopper-mobile-menu" ref={dialog} aria-labelledby="shopper-menu-title" onCancel={event => { event.preventDefault(); onClose(); }} onClick={event => { if (event.target === event.currentTarget) onClose(); }} className="fixed inset-y-0 left-0 m-0 h-dvh max-h-none w-[min(20rem,92vw)] max-w-none overflow-y-auto border-0 bg-white p-0 shadow-xl backdrop:bg-black/40"><ShopperSidebar mobile activeTab={activeTab} setActiveTab={onNavigate} onClose={onClose} /></dialog>;
}
