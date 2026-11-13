import { useCallback, useEffect, useState } from 'react';
import { getCurrentUser } from '../../services/api';
import Navbar from '../../components/public/Navbar';
import HeroSection from '../../components/public/HeroSection';
import CategorySection from '../../components/public/CategorySection';
import PublicCatalog from '../../components/public/PublicCatalog';

export default function LandingPage({ mapConfig }) {
  const [role, setRole] = useState(null);
  const [selectedStore, setSelectedStore] = useState(null);
  const chooseStore = useCallback(store => setSelectedStore(store), []);
  useEffect(() => { let active = true; getCurrentUser().then(user => { if (active) setRole(user.role?.slug); }).catch(() => {}); return () => { active = false; }; }, []);
  const shopPath = ({ shopper: '/shopper/dashboard', inventory_worker: '/inventory/dashboard', supervisor: '/supervisor', admin: '/admin/dashboard' })[role] || '/login';
  return <div className="min-h-screen bg-page"><Navbar /><main><HeroSection shopPath={shopPath} staff={role && role !== 'shopper'} selectedStoreId={selectedStore?.store_id} onStoreSelect={chooseStore} mapConfig={mapConfig} />{selectedStore && <PublicCatalog key={selectedStore.store_id} store={selectedStore} role={role} shopPath={shopPath} />}<CategorySection shopPath={shopPath} /></main><footer className="border-t border-slate-200 bg-white px-4 py-6 text-center text-sm text-slate-600">© {new Date().getFullYear()} GrocerEase · Shop thoughtfully. Pick up with ease.</footer></div>;
}
