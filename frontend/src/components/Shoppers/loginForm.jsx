import { useState } from 'react';
import { Mail, Lock } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';

function LoginForm() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e) => {
    e.preventDefault();
    setErrorMessage('');
    setLoading(true);

    try {
      const response = await fetch('http://localhost:8000/api/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        setErrorMessage(data.message || 'Invalid email or password.');
        setLoading(false);
        return;
      }

      // 1. Store session info
      localStorage.setItem('user_role', data.role);
      localStorage.setItem('user_profile', JSON.stringify(data.profile));

      // 2. Redirect based on role
      if (data.role === 'worker') {
        navigate('/inventory/dashboard');
      } else if (data.role === 'supervisor') {
        navigate('/supervisor/dashboard');
      } else if (data.role === 'admin') {
        navigate('/admin/dashboard');
      } else {
        navigate('/shopper/dashboard');
      }
    } catch (error) {
      console.error('Error connecting to backend:', error);
      setErrorMessage('Cannot connect to backend server. Make sure php artisan serve is running.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-1/2 border border-gray-300 rounded-3xl p-8 lg:p-12 flex flex-col justify-center bg-white">
      <div className="w-full max-w-md mx-auto">
        <h1 className="text-3xl font-black text-center text-black tracking-tight mb-2">
          Welcome Back
        </h1>
        <p className="text-xs font-medium text-center text-gray-500 mb-6">
          Login to your account and continue shopping
        </p>

        {errorMessage && (
          <div className="mb-4 text-center text-xs font-semibold text-red-600 bg-red-50 border border-red-200 py-2 px-3 rounded-md">
            {errorMessage}
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-6">
          {/* Email */}
          <div>
            <label className="block text-xs font-bold text-black mb-2">Email</label>
            <div className="relative">
              <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-500 w-4 h-4" />
              <input
                type="email"
                name="email"
                placeholder="Enter your email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full pl-10 pr-4 py-3 text-xs border border-gray-300 rounded-lg focus:outline-none focus:border-[#006e00] text-gray-800 placeholder-gray-400"
                required
              />
            </div>
          </div>

          {/* Password */}
          <div>
            <label className="block text-xs font-bold text-black mb-2">Password</label>
            <div className="relative">
              <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-500 w-4 h-4" />
              <input
                type="password"
                name="password"
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full pl-10 pr-4 py-3 text-xs border border-gray-300 rounded-lg focus:outline-none focus:border-[#006e00] text-gray-800 placeholder-gray-400"
                required
              />
            </div>
            <div className="text-right mt-2">
              <a href="#" className="text-[11px] text-[#006e00] font-semibold hover:underline">
                Forgot Password?
              </a>
            </div>
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-[#006e00] hover:bg-[#005400] text-white font-bold py-3 px-4 rounded-lg transition duration-150 text-xs shadow-sm mt-4 disabled:opacity-60"
          >
            {loading ? 'Logging in...' : 'Login'}
          </button>
        </form>

        {/* OAuth & Routing */}
        <div className="mt-8">
          <div className="text-center mb-4">
            <span className="text-[11px] text-gray-400">or sign up with</span>
          </div>

          <button
            type="button"
            className="w-full border border-gray-300 bg-white hover:bg-gray-50 text-gray-700 font-semibold py-2.5 px-4 rounded-lg flex items-center justify-center gap-2 text-xs transition duration-150"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
            </svg>
            Continue with Google
          </button>

          <p className="text-center text-xs text-gray-600 mt-6">
            Don't have an account?{' '}
            <Link to="/register" className="text-[#006e00] font-bold hover:underline">
              Register
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}

export default LoginForm;