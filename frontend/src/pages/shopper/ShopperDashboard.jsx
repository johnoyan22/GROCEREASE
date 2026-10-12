import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getCurrentUser } from '../../services/api';
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
  const [activeTab, setActiveTab] = useState('Dashboard');

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

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden font-sans">
      <ShopperSidebar 
        activeTab={activeTab} 
        setActiveTab={setActiveTab} 
      />

      <div className="flex-1 flex flex-col overflow-hidden">
        <ShopperHeader user={user} />

        <div className="flex-1 overflow-y-auto">
          {isLoading ? (
            <p role='status' className='p-6 text-sm text-gray-600'>Loading your account...</p>
          ) : loadError ? (
            <div className='p-6'>
              <p role='alert' className='text-sm text-red-600'>{loadError}</p>
              <button type='button' onClick={retryLoading}
                className='mt-3 rounded-lg bg-[#006e00] px-4 py-2 text-xs font-semibold text-white'>
                  Retry
                </button>
            </div>) : user ? (
              <>
                {activeTab === 'Dashboard' && (<ShopperMainContent setActiveTab={setActiveTab}/>)}
                {activeTab === 'Browse' && <ShopperBrowseProducts />}
                {activeTab === 'AI' && <ShopperAIRecommendations />}
                {activeTab === 'Orders' && <ShopperMyOrders />}
                {(activeTab === 'Pickup' || activeTab === 'Pick up Information') && <ShopperPickupInformation />}
                {activeTab === 'Notifications' && <ShopperNotifications />}
                {(activeTab === 'Profile' || activeTab === 'My Profile') && (<ShopperMyProfile 
                  user={user}  
                  onProfileUpdated={setUser}
                />
                )}
                {(activeTab === 'Payment' || activeTab === 'Payment Methods') && <ShopperPaymentMethods />}
                {activeTab === 'History' && <ShopperHistory />}
                {activeTab === 'Settings' && (<ShopperSettings user={user} />)}
              </>
            ): null}
          </div>
      </div>
    </div>
  );
}