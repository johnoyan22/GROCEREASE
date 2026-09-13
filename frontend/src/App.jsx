import './App.css';
//import LandingPage from './pages/LandingPage';
import InventoryDashboard from "./pages/inventory/InventoryDashboard";
import ProductManagement from "./pages/inventory/ProductManagement";
import StockManagement from "./pages/inventory/StockManagement";
import StockVerificationRequests from "./pages/inventory/StockVerificationRequests";
import LowStockMonitoring from "./pages/inventory/LowStockMonitoring";
import SubmitStockUpdate from "./pages/inventory/SubmitStockUpdate";
import SupervisorNotifications from "./pages/inventory/SupervisorNotifications";
import ActivityLog from "./pages/inventory/ActivityLog";

function App() {
  const currentPath = window.location.pathname;

  if (currentPath === "/inventory/products") {
    return <ProductManagement />;
  }

  if (currentPath === "/inventory/stock") {
    return <StockManagement />;
  }

  if (currentPath === "/inventory/verifications") {
    return <StockVerificationRequests />;
  }

  if (currentPath === "/inventory/low-stock") {
    return <LowStockMonitoring />;
  }

  if (currentPath === "/inventory/stock-update") {
    return <SubmitStockUpdate />;
  }

  if (currentPath === "/inventory/notifications") {
    return <SupervisorNotifications />;
  }

  if (currentPath === "/inventory/activity") {
    return <ActivityLog />;
  }

  return <InventoryDashboard />;
}

export default App
