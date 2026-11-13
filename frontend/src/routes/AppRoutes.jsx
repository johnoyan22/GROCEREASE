import { lazy, Suspense } from 'react';
import { Route, Routes, Navigate } from 'react-router-dom';
import ProtectedRoute from '../components/auth/ProtectedRoute';

const VerifyEmailPage = lazy(() => import('../pages/auth/VerifyEmailPage'));

const LandingPage = lazy(() => import('../pages/public/LandingPage'));
const LoginPage = lazy(() => import('../pages/auth/LoginPage'));
const Register = lazy(() => import('../pages/auth/RegisterPage'));
const ShopperDashboard = lazy(() => import('../pages/shopper/ShopperDashboard'));

const InventoryDashboard = lazy(() => import('../pages/inventory/InventoryDashboard'));
const InventoryProfile = lazy(() => import('../pages/inventory/InventoryProfile'));
const ProductManagement = lazy(() => import('../pages/inventory/ProductManagement'));
const StockManagement = lazy(() => import('../pages/inventory/StockManagement'));
const StoreOrders = lazy(() => import('../pages/inventory/StoreOrders'));
const StockVerificationRequests = lazy(() => import('../pages/inventory/StockVerificationRequests'));
const LowStockMonitoring = lazy(() => import('../pages/inventory/LowStockMonitoring'));
const SubmitStockUpdate = lazy(() => import('../pages/inventory/SubmitStockUpdate'));
const InventoryNotifications = lazy(() => import('../pages/inventory/InventoryNotifications'));
const InventoryReports = lazy(() => import('../pages/inventory/InventoryReports'));
const ActivityLog = lazy(() => import('../pages/inventory/ActivityLog'));
const SupervisorApp = lazy(() => import('../components/Supervisor/SupervisorApp'));

const AdminLayout = lazy(() => import('../components/admin/AdminLayout'));
const AdminDashboard = lazy(() => import('../pages/admin/AdminDashboard'));
const AccountManagement = lazy(() => import('../pages/admin/AccountManagement'));
const RoleManagement = lazy(() => import('../pages/admin/RoleManagement'));
const StaffManagement = lazy(() => import('../pages/admin/StaffManagement'));
const StoreManagement = lazy(() => import('../pages/admin/StoreManagement'));
const FinancialSetup = lazy(() => import('../pages/admin/FinancialSetup'));
const CopManagement = lazy(() => import('../pages/admin/CopManagement'));
import TransactionRecords from '../components/orders/TransactionRecords';
const ReportModule = lazy(() => import('../pages/admin/ReportModule'));
const Settings = lazy(() => import('../pages/admin/Settings'));

function AppRoutes() {
  return (
    <Suspense fallback={<p role="status" className="p-6">Loading GrocerEase…</p>}><Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<Register />} />
      <Route path="/verify-email" element={<VerifyEmailPage />} />

    <Route element={<ProtectedRoute allowedRoles={['shopper']} requireVerifiedEmail/>}>
      <Route path="/shopper/dashboard" element={<ShopperDashboard />} />
    </Route>

      <Route element={<ProtectedRoute allowedRoles={['inventory_worker']}/>}>
        <Route path="/inventory/dashboard" element={<InventoryDashboard />} />
        <Route path="/inventory/profile" element={<InventoryProfile />} />
        <Route path="/inventory/products" element={<ProductManagement />} />
        <Route path="/inventory/stock" element={<StockManagement />} />
        <Route path="/inventory/orders" element={<StoreOrders />} />
        <Route path="/inventory/verifications" element={<StockVerificationRequests />} />
        <Route path="/inventory/low-stock" element={<LowStockMonitoring />} />
        <Route path="/inventory/stock-update" element={<SubmitStockUpdate />} />
        <Route path="/inventory/notifications" element={<InventoryNotifications />} />
        <Route path="/inventory/reports" element={<InventoryReports />} />
        <Route path="/inventory/activity" element={<ActivityLog />} />
      </Route>

      <Route element={<ProtectedRoute allowedRoles={['supervisor']}/>}>
        <Route path="/supervisor/*" element={<SupervisorApp />} />
      </Route>

      <Route element={<ProtectedRoute allowedRoles={['admin']}/>}>
        <Route path="/admin" element={<Navigate to="/admin/dashboard" replace />} />
        <Route path="/admin/dashboard" element={<AdminLayout><AdminDashboard /></AdminLayout>} />
        <Route path="/admin/accounts" element={<AdminLayout><AccountManagement /></AdminLayout>} />
        <Route path="/admin/staff" element={<AdminLayout><StaffManagement /></AdminLayout>} />
        <Route path="/admin/stores" element={<AdminLayout><StoreManagement /></AdminLayout>} />
        <Route path="/admin/roles" element={<AdminLayout><RoleManagement /></AdminLayout>} />
        <Route path="/admin/financial" element={<AdminLayout><FinancialSetup /></AdminLayout>} />
        <Route path="/admin/cop" element={<AdminLayout><CopManagement /></AdminLayout>} />
        <Route path="/admin/transactions" element={<AdminLayout><TransactionRecords role="admin" /></AdminLayout>} />
        <Route path="/admin/reports" element={<AdminLayout><ReportModule /></AdminLayout>} />
        <Route path="/admin/settings" element={<AdminLayout><Settings /></AdminLayout>} />
      </Route>

      <Route path="*" element={<LandingPage />} />
    </Routes></Suspense>
  );
}

export default AppRoutes;
