import NavigationDrawer from '../../components/shared/NavigationDrawer';
import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { storeIntent } from '../../services/storeIntent';
import { getCurrentUser } from '../../services/api';
import useShopperCart from '../../hooks/useShopperCart';
import useDashboardSummary from '../../hooks/useDashboardSummary';
import ShopperMyCart from '../../components/Shoppers/ShopperMyCart';
import ShopperSidebar from '../../components/Shoppers/ShopperSidebar';
import ShopperHeader from '../../components/Shoppers/ShopperHeader';
import ShopperMainContent from '../../components/Shoppers/ShopperMainContent';
import ShopperBrowseProducts from '../../components/Shoppers/ShopperBrowseProducts';
import ShopperAIRecommendations from '../../components/Shoppers/ShopperAIrecommendations';
import ShopperMyOrders from '../../components/Shoppers/ShopperMyOrders';
import ShopperPickupInformation from '../../components/Shoppers/ShopperPickupInformation';
import ShopperNotifications from '../../components/Shoppers/ShopperNotifications';
import ShopperMyProfile from '../../components/Shoppers/ShopperMyProfile';
import ShopperPaymentMethods from '../../components/Shoppers/ShopperPaymentMethods';
import ShopperHistory from '../../components/Shoppers/ShopperHistory';
import ShopperSettings from '../../components/Shoppers/ShopperSettings';

export default function ShopperDashboard() {
  const navigate = useNavigate();

  const [user, setUser ] = useState(null);
  const [isLoading, setIsLoading ] = useState(true);
  const [loadError, setLoadError ] = useState('');
  const [loadVersion, setLoadVersion] = useState(0);

  useEffect(() => {
    let active = true;

    getCurrentUser()
      .then((currentUser) => {
        if (!active) return;

        if (currentUser.role?.slug !== 'shopper') {
          navigate('/', { replace: true });
          return;
        }

        if (!currentUser.email_verified_at) {
          navigate('/verify-email', { replace: true });
          return;
        }

        setUser(currentUser);
      })
      .catch((error) => {
        if (!active) return;

        if (error.status === 401) {
          navigate('/login', { replace: true });
          return;
        }

        setLoadError('Could not load your account. Please try again.');
      })
      .finally(() => {
        if (active) setIsLoading(false);
      });

    return () => {
      active = false;
    };
  }, [navigate, loadVersion]);

  function retryLoading() {
    setLoadError('');
    setIsLoading(true);
    setLoadVersion((version) => version + 1);
  }

  if (isLoading) return <p role="status" className="p-6 text-sm text-gray-600">Loading your account...</p>;
  if (loadError) return <div className="p-6"><p role="alert" className="text-sm text-red-600">{loadError}</p><button type="button" onClick={retryLoading} className="mt-3 rounded-lg bg-primary px-4 py-2 text-xs font-semibold text-white">Retry</button></div>;
  return user ? <ShopperWorkspace key={user.id} user={user} setUser={setUser} /> : null;
}

function ShopperWorkspace({ user, setUser }) {
  const [searchParams, setSearchParams] = useSearchParams();
  const requestedStoreId = storeIntent(searchParams.get('store'));
  const [activeTab, setActiveTab] = useState(requestedStoreId ? 'Browse' : 'Dashboard');
  const [navigationOpen, setNavigationOpen] = useState(false);
  function navigateTab(tab) { setActiveTab(tab); setNavigationOpen(false); }
  const [search, setSearch] = useState('');
  const shopping = useShopperCart(user.id);
  const summary = useDashboardSummary('shopper', activeTab);
  function searchProducts(value) { setSearch(value); setActiveTab('Browse'); }
  return <div className="flex h-dvh bg-page overflow-hidden font-sans">
    <div className="hidden h-full overflow-y-auto lg:block"><ShopperSidebar user={user} activeTab={activeTab} setActiveTab={navigateTab} /></div>
    {navigationOpen && <NavigationDrawer onClose={() => setNavigationOpen(false)}><ShopperSidebar user={user} activeTab={activeTab} setActiveTab={navigateTab} /></NavigationDrawer>}
    <div className="min-w-0 flex-1 flex flex-col overflow-hidden">
      <ShopperHeader onNavigation={() => setNavigationOpen(true)} user={user} quantity={shopping.quantity} unreadCount={summary.data?.unread_notifications} onCart={() => setActiveTab('Cart')} onNotifications={() => setActiveTab('Notifications')} onProfile={() => setActiveTab('Profile')} onSearch={searchProducts} />
      <div className="min-w-0 flex-1 overflow-y-auto">
        {activeTab === 'Dashboard' && <ShopperMainContent setActiveTab={setActiveTab} shopping={shopping} summary={summary} />}
        {activeTab === 'Browse' && <ShopperBrowseProducts shopping={shopping} search={search} setSearch={setSearch} requestedStoreId={requestedStoreId} onDismissStoreRequest={() => { const next = new URLSearchParams(searchParams); next.delete('store'); setSearchParams(next, { replace: true }); }} onViewCart={() => setActiveTab('Cart')} />}
        {activeTab === 'Cart' && <ShopperMyCart shopping={shopping} userId={user.id} onContinue={() => setActiveTab('Browse')} />}
        {activeTab === 'AI' && <ShopperAIRecommendations key={shopping.storeId ?? 'no-store'} shopping={shopping} onAddToCart={shopping.addRecommendation} onSelectStore={() => setActiveTab('Browse')} onViewCart={() => setActiveTab('Cart')} />}
        {activeTab === 'Orders' && <ShopperMyOrders />}
        {(activeTab === 'Pickup' || activeTab === 'Pick up Information') && <ShopperPickupInformation />}
        {activeTab === 'Notifications' && <ShopperNotifications />}
        {(activeTab === 'Profile' || activeTab === 'My Profile') && <ShopperMyProfile user={user} onProfileUpdated={setUser} />}
        {(activeTab === 'Payment' || activeTab === 'Payment Methods') && <ShopperPaymentMethods key={shopping.storeId} storeId={shopping.storeId} />}
        {activeTab === 'History' && <ShopperHistory />}
        {activeTab === 'Settings' && <ShopperSettings user={user} />}
      </div>
    </div>
  </div>;
}
