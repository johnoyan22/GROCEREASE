import { useState } from 'react';
import { User, Mail, Lock, Phone, MapPin } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { register } from '../../services/api';

function RegisterForm() {
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phoneNumber: '',
    address: '',
    password: '',
    confirmPassword: '',
    agreeToTerms: false,
  });

  const [errorMessage, setErrorMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const navigate = useNavigate();

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
  };

  const handleRegister = async (e) => {
    e.preventDefault();

    if (isSubmitting) {
      return;
    }

    setErrorMessage('');

    if (formData.password !== formData.confirmPassword) {
      setErrorMessage('Passwords do not match.');
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await register({
        first_name: formData.firstName.trim(),
        last_name: formData.lastName.trim(),
        email: formData.email.trim(),
        phone_number: formData.phoneNumber.trim(),
        address: formData.address.trim() || null,
        password: formData.password,
        password_confirmation: formData.confirmPassword,
        agree_to_terms: formData.agreeToTerms,
      });

      navigate('/verify-email', {
        replace: true,
        state: {
          registration: {
            email: response.user.email,
            verificationEmailSent: response.verification_email_sent,
          },
        },
      });
    } catch (error) {
      setErrorMessage(
        error.message || 'Registration failed. Please try again.'
      );
    } finally {
      setIsSubmitting(false);
    }
  };
  return (
    <div className="w-full lg:w-1/2 border border-gray-300 rounded-3xl p-8 lg:p-10 flex flex-col justify-between bg-white">
      <div>
        <h1 className="text-3xl font-black text-center text-black tracking-tight mb-2">
          Create Your Account
        </h1>
      <p className="text-xs font-medium text-center text-gray-500 mb-8">
        Create your account, then sign in to verify your email.
      </p>

        {errorMessage && (
          <div className="mb-4 text-center text-xs font-semibold text-red-600 bg-red-50 border border-red-200 py-2 px-3 rounded-md">
            {errorMessage}
          </div>
        )}

        <form onSubmit={handleRegister} className="space-y-4">
         {/* First and Last Name */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label
              htmlFor="firstName"
              className="block text-xs font-bold text-black mb-1.5"
            >
              First Name
            </label>
            <div className="relative">
              <User className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-500 w-4 h-4" />
              <input
                id="firstName"
                type="text"
                name="firstName"
                placeholder="First name"
                value={formData.firstName}
                onChange={handleChange}
                className="w-full pl-10 pr-4 py-2.5 text-xs border border-gray-300 rounded-lg focus:outline-none focus:border-primary text-gray-800 placeholder-gray-400"
                required
              />
            </div>
          </div>

          <div>
            <label
              htmlFor="lastName"
              className="block text-xs font-bold text-black mb-1.5"
            >
              Last Name
            </label>
            <div className="relative">
              <User className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-500 w-4 h-4" />
              <input
                id="lastName"
                type="text"
                name="lastName"
                placeholder="Last name"
                value={formData.lastName}
                onChange={handleChange}
                className="w-full pl-10 pr-4 py-2.5 text-xs border border-gray-300 rounded-lg focus:outline-none focus:border-primary text-gray-800 placeholder-gray-400"
                required
              />
            </div>
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
                className="w-full pl-10 pr-4 py-2.5 text-xs border border-gray-300 rounded-lg focus:outline-none focus:border-primary text-gray-800 placeholder-gray-400"
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
                className="w-full pl-10 pr-4 py-2.5 text-xs border border-gray-300 rounded-lg focus:outline-none focus:border-primary text-gray-800 placeholder-gray-400"
                required
              />
            </div>
          </div>

          {/* Address (optional) */}
          <div>
            <label className="block text-xs font-bold text-black mb-1.5">Address <span className="text-gray-500 font-normal">(optional)</span></label>
            <div className="relative">
              <MapPin className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-500 w-4 h-4" />
              <input
                type="text"
                name="address"
                placeholder="Enter your address"
                value={formData.address}
                onChange={handleChange}
                className="w-full pl-10 pr-4 py-2.5 text-xs border border-gray-300 rounded-lg focus:outline-none focus:border-primary text-gray-800 placeholder-gray-400"
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
                className="w-full pl-10 pr-4 py-2.5 text-xs border border-gray-300 rounded-lg focus:outline-none focus:border-primary text-gray-800 placeholder-gray-400"
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
                className="w-full pl-10 pr-4 py-2.5 text-xs border border-gray-300 rounded-lg focus:outline-none focus:border-primary text-gray-800 placeholder-gray-400"
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
            <label htmlFor="terms" className="text-xs text-gray-600">
              I agree to the Terms of Service and Privacy Policy provided by the GrocerEase team.
            </label>
          </div>

          {/* Submit Button */}
          <button
            disabled={isSubmitting}
            type="submit"
            className="w-full bg-primary hover:bg-primary-hover text-white font-bold py-3 px-4 rounded-lg transition duration-150 text-xs shadow-sm mt-2 disabled:opacity-60"
          >
            {isSubmitting ? 'Creating account...' : 'Create Account'}
          </button>
        </form>
      </div>

      {/* Social Sign Up & Login Footer */}
      <div>

        <p className="text-center text-xs text-gray-600 mt-4">
          Already have an account? <Link to="/login" className="text-primary font-bold hover:underline">Login</Link>
        </p>
      </div>
    </div>
  );
}

export default RegisterForm;
