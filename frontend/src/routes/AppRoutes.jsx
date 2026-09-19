import { Route, Routes } from 'react-router-dom'
import LandingPage from '../pages/shopper/LandingPage'
import LoginPage from '../pages/shopper/LoginPage'
import Register from '../pages/shopper/Register'
import ShopperDashboard from '../pages/shopper/ShopperDashboard'
import InventoryDashboard from '../pages/inventory/InventoryDashboard'
import ProductManagement from '../pages/inventory/ProductManagement'
import StockManagement from '../pages/inventory/StockManagement'
import StockVerificationRequests from '../pages/inventory/StockVerificationRequests'
import LowStockMonitoring from '../pages/inventory/LowStockMonitoring'
import SubmitStockUpdate from '../pages/inventory/SubmitStockUpdate'
import InventoryNotifications from '../pages/inventory/InventoryNotifications'
import ActivityLog from '../pages/inventory/ActivityLog'
import SupervisorDashboardPage from '../pages/supervisor/SupervisorDashboardPage'

function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<Register />} />

      <Route path="/dashboard" element={<ShopperDashboard />} />
      <Route path="/shopper/dashboard" element={<ShopperDashboard />} />

      <Route path="/inventory/dashboard" element={<InventoryDashboard />} />
      <Route path="/inventory/products" element={<ProductManagement />} />
      <Route path="/inventory/stock" element={<StockManagement />} />
      <Route path="/inventory/verifications" element={<StockVerificationRequests />} />
      <Route path="/inventory/low-stock" element={<LowStockMonitoring />} />
      <Route path="/inventory/stock-update" element={<SubmitStockUpdate />} />
      <Route path="/inventory/notifications" element={<InventoryNotifications />} />
      <Route path="/inventory/activity" element={<ActivityLog />} />

      <Route path="/supervisor/dashboard" element={<SupervisorDashboardPage />} />

      <Route path="*" element={<LandingPage />} />
    </Routes>
  )
}

export default AppRoutes
