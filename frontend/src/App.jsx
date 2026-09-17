import { BrowserRouter, Routes, Route } from 'react-router-dom';
import LandingPage from './pages/LandingPage';
import Register from './pages/Register';
import LoginPage from './pages/LoginPage';
import ShopperDashboard from './pages/ShopperDashboard';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<Register />} />
        <Route path="/dashboard" element={<ShopperDashboard />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;