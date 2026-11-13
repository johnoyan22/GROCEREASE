import { useState } from 'react';
import { Mail, Lock } from 'lucide-react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { login } from '../../services/api';

function LoginForm() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [passwordInputType, setPasswordInputType] = useState('password');
  const [isChecked, setIsChecked] = useState(false);

function togglePasswordVisibility(event) {
  const checked = event.target.checked;

  setIsChecked(checked);

  if (checked) {
    setPasswordInputType('text');
  } else {
    setPasswordInputType('password');
  }
}

  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [isLoading, setIsLoading] = useState(false);

  const handleLogin = async (e) => {
    e.preventDefault();

    if (isLoading) {
      return;
    }

    setErrorMessage('');
    setIsLoading(true);

    try {
      const user = await login({ email, password });

      const dashboardByRole = {
        shopper: '/shopper/dashboard',
        inventory_worker: '/inventory/dashboard',
        supervisor: '/supervisor',
        admin: '/admin/dashboard',
      };

      const destination = dashboardByRole[user.role?.slug];

      if (!destination) {
        throw new Error('This account role does not have a dashboard yet.');
      }

      const unverifiedShopper = user.role?.slug === 'shopper' && !user.email_verified_at;

      const verificationLogin = user.role?.slug === 'shopper' && searchParams.get('verification') === 'required';

      if (unverifiedShopper || verificationLogin) {
        navigate('/verify-email', { replace: true });
        return;
      }

      navigate(destination, { replace: true });
    } catch (error) {
      setErrorMessage(error.message || 'Login failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="w-full lg:w-1/2 border border-gray-300 rounded-3xl p-8 lg:p-12 flex flex-col justify-center bg-white">
      <div className="w-full max-w-md mx-auto">
        <h1 className="text-3xl font-black text-center text-black tracking-tight mb-2">
          Welcome Back
        </h1>

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
                className="w-full pl-10 pr-4 py-3 text-xs border border-gray-300 rounded-lg focus:outline-none focus:border-primary text-gray-800 placeholder-gray-400"
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
                type={passwordInputType}
                name="password"
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full pl-10 pr-4 py-3 text-xs border border-gray-300 rounded-lg focus:outline-none focus:border-primary text-gray-800 placeholder-gray-400"
                required
              />
            </div>

            <label className="mt-2 ml-2 flex items-center gap-2 text-xs font-semibold text-primary">
              <input
                type="checkbox"
                checked={isChecked}
                onChange={togglePasswordVisibility}
                disabled={isLoading}
              />
              <span>Show password</span>
            </label>
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={isLoading}
            className="w-full bg-primary hover:bg-primary-hover text-white font-bold py-3 px-4 rounded-lg transition duration-150 text-xs shadow-sm mt-4 disabled:opacity-60"
          >
            {isLoading ? 'Logging in...' : 'Login'}
          </button>
        </form>

        {/* OAuth & Routing */}
        <div className="mt-8">

          <p className="text-center text-xs text-gray-600 mt-6">
            Don't have an account?{' '}
            <Link to="/register" className="text-primary font-bold hover:underline">
              Register
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}

export default LoginForm;
