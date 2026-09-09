import { useState } from 'react';
import { 
  User, Edit3, Mail, Phone, MapPin, Building, Calendar, Store, ShoppingBag 
} from 'lucide-react';

export default function ShopperMyProfile() {
  const [aiRecommendationEnabled, setAiRecommendationEnabled] = useState(true);

  return (
    <div className="flex-1 bg-white min-h-screen p-6 font-sans">
      {/* Title Header */}
      <div className="mb-6">
        <h1 className="text-sm font-bold text-black">My Profile</h1>
        <p className="text-xs text-gray-600 mt-0.5">Manage your personal information and account details.</p>
      </div>

      <div className="max-w-5xl space-y-4">
        {/* Main Personal Details Card */}
        <div className="border border-green-600 rounded-xl p-5 bg-white shadow-xs relative">
          {/* Top User Header & Edit Button */}
          <div className="flex items-center justify-between mb-6 pb-4 border-b border-gray-100">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full border border-gray-300 flex items-center justify-center bg-gray-50 text-gray-700">
                <User className="w-5 h-5 stroke-[1.5]" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-black">Juan Dela Cruz</h2>
                <span className="text-[11px] text-gray-500 block">Shopper</span>
              </div>
            </div>

            <button className="border border-green-700 text-[#006e00] text-xs font-bold px-3 py-1.5 rounded-lg hover:bg-green-50 transition flex items-center gap-1.5">
              <Edit3 className="w-3.5 h-3.5" />
              Edit Profile
            </button>
          </div>

          {/* Details Grid (Two Columns) */}
          <div className="grid grid-cols-2 gap-x-8 gap-y-4 text-xs">
            {/* Left Column */}
            <div className="space-y-3">
              <div className="flex items-center justify-between pb-2 border-b border-gray-200">
                <div className="flex items-center gap-2 text-gray-700 font-medium">
                  <User className="w-4 h-4 text-gray-800" />
                  <span>Full Name</span>
                </div>
                <span className="font-semibold text-black">Juan Dela Cruz</span>
              </div>

              <div className="flex items-center justify-between pb-2 border-b border-gray-200">
                <div className="flex items-center gap-2 text-gray-700 font-medium">
                  <Mail className="w-4 h-4 text-gray-800" />
                  <span>Email Address</span>
                </div>
                <span className="font-semibold text-black">Juan@gmail.com</span>
              </div>

              <div className="flex items-center justify-between pb-2 border-b border-gray-200">
                <div className="flex items-center gap-2 text-gray-700 font-medium">
                  <Phone className="w-4 h-4 text-gray-800" />
                  <span>Phone #</span>
                </div>
                <span className="font-semibold text-black">+63123456789</span>
              </div>

              <div className="flex items-center justify-between pb-2 border-b border-gray-200">
                <div className="flex items-center gap-2 text-gray-700 font-medium">
                  <MapPin className="w-4 h-4 text-gray-800" />
                  <span>Address</span>
                </div>
                <span className="font-semibold text-black">Bulacao St.jude</span>
              </div>

              <div className="flex items-center justify-between pb-2 border-b border-gray-200">
                <div className="flex items-center gap-2 text-gray-700 font-medium">
                  <Building className="w-4 h-4 text-gray-800" />
                  <span>City</span>
                </div>
                <span className="font-semibold text-black">Bulacao City</span>
              </div>
            </div>

            {/* Right Column */}
            <div className="space-y-3 border-l border-gray-200 pl-8">
              <div className="flex items-center justify-between pb-2 border-b border-gray-200">
                <div className="flex items-center gap-2 text-gray-700 font-medium">
                  <Building className="w-4 h-4 text-gray-800" />
                  <span>Province</span>
                </div>
                <span className="font-semibold text-black">Bulacao Cebu</span>
              </div>

              <div className="flex items-center justify-between pb-2 border-b border-gray-200">
                <div className="flex items-center gap-2 text-gray-700 font-medium">
                  <MapPin className="w-4 h-4 text-gray-800" />
                  <span>Postal Code</span>
                </div>
                <span className="font-semibold text-black">6000</span>
              </div>

              <div className="flex items-center justify-between pb-2 border-b border-gray-200">
                <div className="flex items-center gap-2 text-gray-700 font-medium">
                  <Calendar className="w-4 h-4 text-gray-800" />
                  <span>Date of birth</span>
                </div>
                <span className="font-semibold text-black">January 22 2004</span>
              </div>

              <div className="flex items-center justify-between pb-2 border-b border-gray-200">
                <div className="flex items-center gap-2 text-gray-700 font-medium">
                  <Store className="w-4 h-4 text-gray-800" />
                  <span>Preferred Pick up Branch</span>
                </div>
                <span className="font-semibold text-black">GrocerEase</span>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Cards Row */}
        <div className="grid grid-cols-2 gap-4">
          {/* Account Information Card */}
          <div className="border border-gray-300 rounded-xl p-4 bg-white">
            <div className="flex items-center gap-2 mb-3">
              <User className="w-4 h-4 text-gray-700" />
              <h3 className="text-xs font-bold text-black">Account Information</h3>
            </div>

            <div className="space-y-2.5 text-xs">
              <div className="flex items-center justify-between pb-1.5 border-b border-gray-200">
                <span className="text-gray-600">Username</span>
                <span className="font-semibold text-black">JuanDelaCruz</span>
              </div>

              <div className="flex items-center justify-between pb-1.5 border-b border-gray-200">
                <span className="text-gray-600">Password</span>
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-black">**********</span>
                  <button className="text-[11px] font-bold text-[#006e00] hover:underline">
                    Change
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between pt-1">
                <span className="text-gray-600">Account Status</span>
                <span className="border border-green-600 text-[#006e00] text-[10px] font-bold px-2 py-0.5 rounded">
                  Active
                </span>
              </div>
            </div>
          </div>

          {/* Shopping Preferences Card */}
          <div className="border border-gray-300 rounded-xl p-4 bg-white">
            <div className="flex items-center gap-2 mb-3">
              <div className="p-1 bg-green-100 rounded-full text-green-800">
                <ShoppingBag className="w-3.5 h-3.5" />
              </div>
              <h3 className="text-xs font-bold text-black">Shopping Preferences</h3>
            </div>

            <div className="space-y-3 text-xs">
              <div className="flex items-center justify-between pb-1.5 border-b border-gray-200">
                <span className="text-gray-600">Preferred Payment Method</span>
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-medium text-gray-800">Debit Card ending in 4567</span>
                  <button className="text-[11px] font-bold text-[#006e00] hover:underline">
                    Change
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between pt-1 border-t border-gray-200">
                <span className="text-gray-600">AI Recommendation</span>
                <div className="flex items-center gap-2">
                  <button 
                    onClick={() => setAiRecommendationEnabled(!aiRecommendationEnabled)}
                    className={`w-9 h-5 flex items-center rounded-full p-0.5 transition-colors duration-200 ${
                      aiRecommendationEnabled ? 'bg-[#006e00]' : 'bg-gray-300'
                    }`}
                  >
                    <div className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform duration-200 ${
                      aiRecommendationEnabled ? 'translate-x-4' : 'translate-x-0'
                    }`} />
                  </button>
                  <span className="text-[11px] font-medium text-gray-700">
                    {aiRecommendationEnabled ? 'Enabled' : 'Disabled'}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}