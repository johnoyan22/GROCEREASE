import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
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
import { logoutSession } from '../../services/api';

export default function ShopperDashboard() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('Settings');

  const handleLogout = async () => {
    await logoutSession();
    navigate('/login', { replace: true });
  };

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden font-sans">
      <ShopperSidebar 
        activeTab={activeTab} 
        setActiveTab={setActiveTab} 
        onLogout={handleLogout} 
      />

      <div className="flex-1 flex flex-col overflow-hidden">
        {activeTab !== 'AI' && <ShopperHeader />}

        <div className="flex-1 overflow-y-auto">
          {activeTab === 'Dashboard' && <ShopperMainContent setActiveTab={setActiveTab} />}
          {activeTab === 'Browse' && <ShopperBrowseProducts />}
          {activeTab === 'AI' && <ShopperAIRecommendations />}
          {activeTab === 'Orders' && <ShopperMyOrders />}
          {(activeTab === 'Pickup' || activeTab === 'Pick up Information') && <ShopperPickupInformation />}
          {activeTab === 'Notifications' && <ShopperNotifications />}
          {(activeTab === 'Profile' || activeTab === 'My Profile') && <ShopperMyProfile />}
          {(activeTab === 'Payment' || activeTab === 'Payment Methods') && <ShopperPaymentMethods />}
          {activeTab === 'History' && <ShopperHistory />}
          {activeTab === 'Settings' && <ShopperSettings />}
        </div>
      </div>
    </div>
  );
}
