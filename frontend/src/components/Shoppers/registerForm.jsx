import { useState } from 'react';
import { User, Mail, Lock, Phone, MapPin } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { API_BASE_URL } from '../../services/api';

function RegisterForm() {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    phoneNumber: '',
    address: '',
    password: '',
    confirmPassword: '',
    agreeToTerms: false,
  });
  const [errorMessage, setErrorMessage] = useState('');
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    setErrorMessage('');

    // Basic client-side validation
    if (formData.password !== formData.confirmPassword) {
      setErrorMessage('Passwords do not match.');
      return;
    }

    // Split full name into first/last for the backend
    const nameParts = formData.fullName.trim().split(' ');
    const firstName = nameParts[0] || '';
    const lastName = nameParts.slice(1).join(' ') || '';

    setLoading(true);

    try {
      const response = await fetch(`${API_BASE_URL}/register/shopper`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify({
          first_name: firstName,
          last_name: lastName,
          email: formData.email,
          phone_number: formData.phoneNumber,
          password: formData.password,
          address: formData.address, // optional
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setErrorMessage(data.message || 'Registration failed.');
        setLoading(false);
        return;
      }

      alert('Account created successfully! You can now log in.');
      navigate('/login');
    } catch (error) {
      console.error('Registration error:', error);
      setErrorMessage('Cannot connect to backend server. Make sure php artisan serve is running.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-1/2 border border-gray-300 rounded-3xl p-8 lg:p-10 flex flex-col justify-between bg-white">
      <div>
        <h1 className="text-3xl font-black text-center text-black tracking-tight mb-2">
          Create Your Account
        </h1>
        <p className="text-xs font-medium text-center text-gray-500 mb-8">
          Sign up and start your easy grocery shopping journey.
        </p>

        {errorMessage && (
          <div className="mb-4 text-center text-xs font-semibold text-red-600 bg-red-50 border border-red-200 py-2 px-3 rounded-md">
            {errorMessage}
          </div>
        )}

        <form onSubmit={handleRegister} className="space-y-4">
          {/* Full Name */}
          <div>
            <label className="block text-xs font-bold text-black mb-1.5">Full Name</label>
            <div className="relative">
              <User className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-500 w-4 h-4" />
              <input
                type="text"
                name="fullName"
                placeholder="Enter your full name"
                value={formData.fullName}
                onChange={handleChange}
                className="w-full pl-10 pr-4 py-2.5 text-xs border border-gray-300 rounded-lg focus:outline-none focus:border-[#006e00] text-gray-800 placeholder-gray-400"
                required
              />
            </div>
          </div>

          {/* Email Address */}
          <div>
            <label className="block text-xs font-bold text-black mb-1.5">Email Address</label>
            <div className="relative">
              <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-500 w-4 h-4" />
              <input
                type="email"
                name="email"
                placeholder="Enter your email"
                value={formData.email}
                onChange={handleChange}
                className="w-full pl-10 pr-4 py-2.5 text-xs border border-gray-300 rounded-lg focus:outline-none focus:border-[#006e00] text-gray-800 placeholder-gray-400"
                required
              />
            </div>
          </div>

          {/* Phone Number */}
          <div>
            <label className="block text-xs font-bold text-black mb-1.5">Phone Number</label>
            <div className="relative">
              <Phone className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-500 w-4 h-4" />
              <input
                type="tel"
                name="phoneNumber"
                placeholder="09XXXXXXXXX"
                value={formData.phoneNumber}
                onChange={handleChange}
                className="w-full pl-10 pr-4 py-2.5 text-xs border border-gray-300 rounded-lg focus:outline-none focus:border-[#006e00] text-gray-800 placeholder-gray-400"
                required
              />
            </div>
          </div>

          {/* Address (optional) */}
          <div>
            <label className="block text-xs font-bold text-black mb-1.5">Address <span className="text-gray-400 font-normal">(optional)</span></label>
            <div className="relative">
              <MapPin className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-500 w-4 h-4" />
              <input
                type="text"
                name="address"
                placeholder="Enter your address"
                value={formData.address}
                onChange={handleChange}
                className="w-full pl-10 pr-4 py-2.5 text-xs border border-gray-300 rounded-lg focus:outline-none focus:border-[#006e00] text-gray-800 placeholder-gray-400"
              />
            </div>
          </div>

          {/* Password */}
          <div>
            <label className="block text-xs font-bold text-black mb-1.5">Password</label>
            <div className="relative">
              <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-500 w-4 h-4" />
              <input
                type="password"
                name="password"
                placeholder="Create your password"
                value={formData.password}
                onChange={handleChange}
                className="w-full pl-10 pr-4 py-2.5 text-xs border border-gray-300 rounded-lg focus:outline-none focus:border-[#006e00] text-gray-800 placeholder-gray-400"
                required
              />
            </div>
          </div>

          {/* Confirm Password */}
          <div>
            <label className="block text-xs font-bold text-black mb-1.5">Confirm Password</label>
            <div className="relative">
              <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-500 w-4 h-4" />
              <input
                type="password"
                name="confirmPassword"
                placeholder="Confirm your password"
                value={formData.confirmPassword}
                onChange={handleChange}
                className="w-full pl-10 pr-4 py-2.5 text-xs border border-gray-300 rounded-lg focus:outline-none focus:border-[#006e00] text-gray-800 placeholder-gray-400"
                required
              />
            </div>
          </div>

          {/* Terms Checkbox */}
          <div className="flex items-center gap-2 pt-1">
            <input
              type="checkbox"
              name="agreeToTerms"
              id="terms"
              checked={formData.agreeToTerms}
              onChange={handleChange}
              className="w-4 h-4 accent-[#006e00] rounded border-gray-300"
              required
            />
            <label htmlFor="terms" className="text-[11px] text-gray-600">
              I agree to the <a href="#" className="text-[#006e00] font-bold hover:underline">Terms of Service</a> and <a href="#" className="text-[#006e00] font-bold hover:underline">Privacy Policy</a>
            </label>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-[#006e00] hover:bg-[#005400] text-white font-bold py-3 px-4 rounded-lg transition duration-150 text-xs shadow-sm mt-2 disabled:opacity-60"
          >
            {loading ? 'Creating Account...' : 'Create Account'}
          </button>
        </form>
      </div>

      {/* Social Sign Up & Login Footer */}
      <div>
        <div className="text-center my-3">
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

        <p className="text-center text-xs text-gray-600 mt-4">
          Already have an account? <Link to="/login" className="text-[#006e00] font-bold hover:underline">Login</Link>
        </p>
      </div>
    </div>
  );
}

export default RegisterForm;
