import { useState } from 'react';
import { CreditCard, Store, MapPin, Edit3, Sliders } from 'lucide-react';

export default function ShopperPaymentMethods() {
  const [autoSaveCards, setAutoSaveCards] = useState(true);
  const [requireVerification, setRequireVerification] = useState(true);

  return (
    <div className="flex-1 bg-white min-h-screen p-6 font-sans">
      {/* Title Header */}
      <div className="mb-6">
        <h1 className="text-sm font-bold text-black">Payment Methods</h1>
        <p className="text-xs text-gray-600 mt-0.5">
          Manage your saved payment options for faster and more secure checkout.
        </p>
      </div>

      <div className="max-w-5xl space-y-4">
        {/* Saved Payment Methods Section */}
        <div className="border border-green-600 rounded-xl p-5 bg-white shadow-xs">
          <h2 className="text-xs font-bold text-black mb-4">Saved Payment Methods</h2>

          <div className="space-y-4 text-xs">
            {/* Visa/Debit Card Item */}
            <div className="flex items-center justify-between pb-4 border-b border-gray-200">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-800 shrink-0">
                  <CreditCard className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-black">Visa/Debit Card</span>
                    <span className="border border-green-600 text-[#006e00] text-[9px] font-bold px-1.5 py-0.2 rounded">
                      Default
                    </span>
                  </div>
                  <span className="text-[11px] text-gray-500 block mt-0.5">**** **** **** 4567</span>
                </div>
              </div>

              <div className="flex items-center gap-12">
                <div>
                  <span className="text-[10px] text-gray-500 block">Cardholder Name</span>
                  <span className="font-semibold text-black">Juan Dela Cruz</span>
                </div>
                <div>
                  <span className="text-[10px] text-gray-500 block">Expiry Date</span>
                  <span className="font-semibold text-black">08/30</span>
                </div>
                <div className="flex items-center gap-2">
                  <button className="text-[#006e00] font-bold text-xs hover:underline">Edit</button>
                  <span className="text-gray-300">|</span>
                  <button className="text-red-500 font-medium text-xs hover:underline">Remove</button>
                </div>
              </div>
            </div>

            {/* GCash Item */}
            <div className="flex items-center justify-between pb-4 border-b border-gray-200">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-extrabold text-sm shrink-0">
                  G
                </div>
                <div>
                  <span className="font-bold text-black block">GCash</span>
                </div>
              </div>

              <div className="flex items-center gap-12">
                <div>
                  <span className="text-[10px] text-gray-500 block">Account Name</span>
                  <span className="font-semibold text-black">Juan Dela Cruz</span>
                </div>
                <div>
                  <span className="text-[10px] text-gray-500 block">Mobile Number</span>
                  <span className="font-semibold text-black">+63 923 123 2345</span>
                </div>
                <div className="flex items-center gap-2">
                  <button className="text-[#006e00] font-bold text-xs hover:underline">Edit</button>
                  <span className="text-gray-300">|</span>
                  <button className="text-red-500 font-medium text-xs hover:underline">Remove</button>
                </div>
              </div>
            </div>

            {/* Cash on Pickup Item */}
            <div className="flex items-center justify-between pt-1">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-800 shrink-0">
                  <Store className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-black">Cash on Pickup (COP)</span>
                  </div>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-[11px] text-gray-500">Pay at the store upon pickup</span>
                    <span className="border border-green-600 text-[#006e00] text-[9px] font-bold px-1.5 py-0.2 rounded">
                      Available
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Cards Row */}
        <div className="grid grid-cols-2 gap-4">
          {/* Billing Address Card */}
          <div className="border border-gray-300 rounded-xl p-4 bg-white relative">
            <div className="flex items-center gap-2 mb-3">
              <div className="p-1 bg-emerald-100 rounded-full text-emerald-800">
                <MapPin className="w-4 h-4" />
              </div>
              <h3 className="text-xs font-bold text-black">Billing Address</h3>
            </div>

            <div className="space-y-2 text-xs">
              <div className="flex justify-between pb-1.5 border-b border-gray-200">
                <span className="text-gray-600">Full Name</span>
                <span className="font-semibold text-black">Juan Dela Cruz</span>
              </div>
              <div className="flex justify-between pb-1.5 border-b border-gray-200">
                <span className="text-gray-600">Address</span>
                <span className="font-semibold text-black">Bulacao St.jude</span>
              </div>
              <div className="flex justify-between pb-1.5 border-b border-gray-200">
                <span className="text-gray-600">City</span>
                <span className="font-semibold text-black">Cebu City</span>
              </div>
              <div className="flex justify-between pb-1.5 border-b border-gray-200">
                <span className="text-gray-600">Province</span>
                <span className="font-semibold text-black">Cebu</span>
              </div>
              <div className="flex justify-between pt-0.5">
                <span className="text-gray-600">Postal</span>
                <span className="font-semibold text-black">6000</span>
              </div>
            </div>

            <div className="flex justify-end mt-2">
              <button className="text-[#006e00] font-bold text-xs hover:underline flex items-center gap-1">
                <Edit3 className="w-3.5 h-3.5" />
                Edit Address
              </button>
            </div>
          </div>

          {/* Payment Preferences Card */}
          <div className="border border-gray-300 rounded-xl p-4 bg-white">
            <div className="flex items-center gap-2 mb-3">
              <div className="p-1 bg-emerald-100 rounded-full text-emerald-800">
                <Sliders className="w-4 h-4" />
              </div>
              <h3 className="text-xs font-bold text-black">Payment Preferences</h3>
            </div>

            <div className="space-y-3 text-xs">
              <div className="flex items-center justify-between pb-1.5 border-b border-gray-200">
                <span className="text-gray-600">Default Method</span>
                <span className="text-[11px] font-medium text-gray-800">Debit Card ending in 4567</span>
              </div>

              {/* Toggle 1 */}
              <div className="flex items-center justify-between pb-1.5 border-b border-gray-200">
                <span className="text-gray-600">Auto-save New Cards</span>
                <div className="flex items-center gap-2">
                  <button 
                    onClick={() => setAutoSaveCards(!autoSaveCards)}
                    className={`w-9 h-5 flex items-center rounded-full p-0.5 transition-colors duration-200 ${
                      autoSaveCards ? 'bg-[#006e00]' : 'bg-gray-300'
                    }`}
                  >
                    <div className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform duration-200 ${
                      autoSaveCards ? 'translate-x-4' : 'translate-x-0'
                    }`} />
                  </button>
                  <span className="text-[11px] font-medium text-gray-700">
                    {autoSaveCards ? 'Enabled' : 'Disabled'}
                  </span>
                </div>
              </div>

              {/* Toggle 2 */}
              <div className="flex items-center justify-between pt-0.5">
                <span className="text-gray-600">Require Verification for changes</span>
                <div className="flex items-center gap-2">
                  <button 
                    onClick={() => setRequireVerification(!requireVerification)}
                    className={`w-9 h-5 flex items-center rounded-full p-0.5 transition-colors duration-200 ${
                      requireVerification ? 'bg-[#006e00]' : 'bg-gray-300'
                    }`}
                  >
                    <div className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform duration-200 ${
                      requireVerification ? 'translate-x-4' : 'translate-x-0'
                    }`} />
                  </button>
                  <span className="text-[11px] font-medium text-gray-700">
                    {requireVerification ? 'Enabled' : 'Disabled'}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-end gap-3 pt-2">
          <button className="border border-red-300 text-gray-700 hover:bg-gray-50 text-xs font-semibold px-4 py-1.5 rounded-lg transition">
            Cancel
          </button>
          <button className="bg-[#006e00] hover:bg-green-800 text-white text-xs font-semibold px-4 py-1.5 rounded-lg transition shadow-xs">
            Save Changes
          </button>
        </div>
      </div>
    </div>
  );
}