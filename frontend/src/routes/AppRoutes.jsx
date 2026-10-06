import { Route, Routes, Navigate } from 'react-router-dom';
import ProtectedRoute from '../components/auth/ProtectedRoute';

import LandingPage from '../pages/public/LandingPage';
import LoginPage from '../pages/auth/LoginPage';
import Register from '../pages/shopper/Register';
import ShopperDashboard from '../pages/shopper/ShopperDashboard';

import InventoryDashboard from '../pages/inventory/InventoryDashboard';
import ProductManagement from '../pages/inventory/ProductManagement';
import StockManagement from '../pages/inventory/StockManagement';
import StockVerificationRequests from '../pages/inventory/StockVerificationRequests';
import LowStockMonitoring from '../pages/inventory/LowStockMonitoring';
import SubmitStockUpdate from '../pages/inventory/SubmitStockUpdate';
import InventoryNotifications from '../pages/inventory/InventoryNotifications';
import ActivityLog from '../pages/inventory/ActivityLog';
import SupervisorApp from '../components/Supervisor/SupervisorApp';

import AdminLayout from '../components/admin/AdminLayout';
import AdminDashboard from '../pages/admin/AdminDashboard';
import RoleManagement from '../pages/admin/RoleManagement';
import AdminStockManagement from '../pages/admin/StockManagement';
import FinancialSetup from '../pages/admin/FinancialSetup';
import CopManagement from '../pages/admin/CopManagement';
import ReportModule from '../pages/admin/ReportModule';
import Settings from '../pages/admin/Settings';

function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<Register />} />

      <Route element={<ProtectedRoute allowedRoles={['shopper']}/>}>
        <Route path="/dashboard" element={<ShopperDashboard />} />
        <Route path="/shopper/dashboard" element={<ShopperDashboard />} />
      </Route>

      <Route element={<ProtectedRoute allowedRoles={['inventory_worker']}/>}>
        <Route path="/inventory/dashboard" element={<InventoryDashboard />} />
        <Route path="/inventory/products" element={<ProductManagement />} />
        <Route path="/inventory/stock" element={<StockManagement />} />
        <Route path="/inventory/verifications" element={<StockVerificationRequests />} />
        <Route path="/inventory/low-stock" element={<LowStockMonitoring />} />
        <Route path="/inventory/stock-update" element={<SubmitStockUpdate />} />
        <Route path="/inventory/notifications" element={<InventoryNotifications />} />
        <Route path="/inventory/activity" element={<ActivityLog />} />
      </Route>

      <Route element={<ProtectedRoute allowedRoles={['supervisor']}/>}>
        <Route path="/supervisor/*" element={<SupervisorApp />} />
      </Route>

      <Route element={<ProtectedRoute allowedRoles={['admin']}/>}>
        <Route path="/admin" element={<Navigate to="/admin/dashboard" replace />} />
        <Route path="/admin/dashboard" element={<AdminLayout><AdminDashboard /></AdminLayout>} />
        <Route path="/admin/roles" element={<AdminLayout><RoleManagement /></AdminLayout>} />
        <Route path="/admin/stock" element={<AdminLayout><AdminStockManagement /></AdminLayout>} />
        <Route path="/admin/financial" element={<AdminLayout><FinancialSetup /></AdminLayout>} />
        <Route path="/admin/cop" element={<AdminLayout><CopManagement /></AdminLayout>} />
        <Route path="/admin/reports" element={<AdminLayout><ReportModule /></AdminLayout>} />
        <Route path="/admin/settings" element={<AdminLayout><Settings /></AdminLayout>} />
      </Route>

      <Route path="*" element={<LandingPage />} />
    </Routes>
  );
}

export default AppRoutes;
