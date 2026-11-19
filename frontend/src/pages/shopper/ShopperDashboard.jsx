import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getCurrentUser } from '../../services/api';
import useShopperCart from '../../hooks/useShopperCart';
import useDashboardSummary from '../../hooks/useDashboardSummary';
import ShopperMyCart from '../../components/Shoppers/ShopperMyCart';
import ShopperSidebar from '../../components/Shoppers/ShopperSidebar';
import ShopperHeader from '../../components/Shoppers/ShopperHeader';
import ShopperMobileNavigation from '../../components/Shoppers/ShopperMobileNavigation';
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
  if (loadError) return <div className="p-6"><p role="alert" className="text-sm text-red-600">{loadError}</p><button type="button" onClick={retryLoading} className="mt-3 rounded-lg bg-[#006e00] px-4 py-2 text-xs font-semibold text-white">Retry</button></div>;
  return user ? <ShopperWorkspace key={user.id} user={user} setUser={setUser} /> : null;
}

function ShopperWorkspace({ user, setUser }) {
  const [activeTab, setActiveTab] = useState(() => /^[1-9][0-9]{0,19}$/.test(new URLSearchParams(window.location.search).get('payment_order') ?? '') ? 'Orders' : 'Dashboard');
  const [search, setSearch] = useState('');
  const [menuOpen, setMenuOpen] = useState(false);
  const closeMenu = useCallback(() => setMenuOpen(false), []);
  const shopping = useShopperCart(user.id);
  const summary = useDashboardSummary('shopper', activeTab);
  useEffect(() => { document.scrollingElement?.scrollTo?.({ top: 0, left: 0, behavior: 'auto' }); }, [activeTab]);
  function searchProducts(value) { setSearch(value); setActiveTab('Browse'); }
  function navigateTab(tab) { setActiveTab(tab); setMenuOpen(false); }
  return <div className="shopper-app flex min-h-dvh min-w-0 bg-gray-50 font-sans">
    <a href="#shopper-content" className="sr-only z-50 rounded-lg bg-white p-3 text-green-800 focus:not-sr-only focus:fixed focus:left-4 focus:top-4">Skip to content</a>
    <ShopperSidebar activeTab={activeTab} setActiveTab={setActiveTab} />
    {menuOpen && <ShopperMobileNavigation activeTab={activeTab} onNavigate={navigateTab} onClose={closeMenu} />}
    <div className="flex min-w-0 flex-1 flex-col">
      <ShopperHeader user={user} quantity={shopping.quantity} unreadCount={summary.data?.unread_notifications} onCart={() => navigateTab('Cart')} onNotifications={() => navigateTab('Notifications')} onProfile={() => navigateTab('Profile')} onSearch={searchProducts} onMenu={() => setMenuOpen(true)} menuOpen={menuOpen} />
      <div id="shopper-content" tabIndex="-1" className="mx-auto w-full min-w-0 max-w-[1600px] flex-1 outline-none">
        {activeTab === 'Dashboard' && <ShopperMainContent setActiveTab={setActiveTab} shopping={shopping} summary={summary} />}
        {activeTab === 'Browse' && <ShopperBrowseProducts shopping={shopping} search={search} setSearch={setSearch} onViewCart={() => setActiveTab('Cart')} />}
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
