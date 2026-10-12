import { useState } from 'react';
import {
  User, Lock, Mail, Bell, ShoppingCart, Sparkles, Receipt,
  Store, History, Wallet, Settings as SettingsIcon
} from 'lucide-react';

// Place ToggleSwitch OUTSIDE ShopperSettings here
const ToggleSwitch = ({ enabled, setEnabled }) => (
  <div className="flex items-center gap-2">
    <button 
      type="button"
      onClick={() => setEnabled(!enabled)}
      className={`w-9 h-5 flex items-center rounded-full p-0.5 transition-colors duration-200 ${
        enabled ? 'bg-[#006e00]' : 'bg-gray-300'
      }`}
    >
      <div className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform duration-200 ${
        enabled ? 'translate-x-4' : 'translate-x-0'
      }`} />
    </button>
    <span className="text-[11px] font-medium text-gray-700">
      {enabled ? 'Enabled' : 'Disabled'}
    </span>
  </div>
);

export default function ShopperSettings({ user }) {
  const fullName =`${user?.profile?.first_name || ''} ${user?.profile?.last_name || ''}`.trim();
  // Notification States
  const [orderStatus, setOrderStatus] = useState(true);
  const [paymentAlerts, setPaymentAlerts] = useState(true);
  const [pickupReminders, setPickupReminders] = useState(true);
  const [aiAlerts, setAiAlerts] = useState(true);
  const [altProductUpdates, setAltProductUpdates] = useState(true);

  // Shopping & Pickup States
  const [altSuggestions, setAltSuggestions] = useState(true);
  const [aiRecommendation, setAiRecommendation] = useState(true);
  const [digitalReceipt, setDigitalReceipt] = useState(true);

  // App Preference States
  const [historyForRec, setHistoryForRec] = useState(true);
  const [budgetMonitoring, setBudgetMonitoring] = useState(true);

  return (
    <div className="flex-1 bg-white min-h-screen p-6 font-sans">
      {/* Page Title Header */}
      <div className="mb-6">
        <h1 className="text-sm font-bold text-black">Settings</h1>
        <p className="text-xs text-amber-700 mt-2">
          Account information is live. The preference controls below are previews
          only and are not saved yet.
        </p>
      </div>

      <div className="max-w-5xl space-y-4">
        {/* Top Row Grid */}
        <div className="grid grid-cols-2 gap-4">
          
          {/* 1. Account & Security Card */}
          <div className="border border-gray-300 rounded-xl p-4 bg-white">
            <div className="flex items-center gap-2 mb-4">
              <div className="p-1.5 bg-emerald-100 rounded-full text-emerald-800">
                <User className="w-4 h-4" />
              </div>
              <h2 className="text-xs font-bold text-black">Account & Security</h2>
            </div>

            <div className="space-y-3 text-xs">
              <div className="flex items-center justify-between gap-3 pb-2 border-b border-gray-200">
                <div className="flex items-center gap-2 text-gray-700">
                  <User className="w-4 h-4 text-gray-500" />
                  <span>Full Name</span>
                </div>
                <span className="font-semibold text-black text-right break-words">
                  {fullName || 'Not provided'}
                </span>
              </div>

              <div className="flex items-center justify-between gap-3 pb-2 border-b border-gray-200">
                <div className="flex items-center gap-2 text-gray-700">
                  <Mail className="w-4 h-4 text-gray-500" />
                  <span>Email Address</span>
                </div>
                <span className="font-semibold text-black text-right break-all">
                  {user?.email || 'Not provided'}
                </span>
              </div>

              <div className="flex items-center justify-between gap-3 pb-2 border-b border-gray-200">
                <div className="flex items-center gap-2 text-gray-700">
                  <Lock className="w-4 h-4 text-gray-500" />
                  <span>Change Password</span>
                </div>
                <button
                  type="button"
                  disabled
                  className="text-[11px] font-semibold text-gray-400 cursor-not-allowed"
                >
                  Not available yet
                </button>
              </div>

              <div className="flex items-center justify-between gap-3 pt-0.5">
                <div className="flex items-center gap-2 text-gray-700">
                  <Mail className="w-4 h-4 text-gray-500" />
                  <span>Email Verification</span>
                </div>
                <span
                  className={`border text-[10px] font-bold px-2 py-0.5 rounded ${
                    user?.email_verified_at
                      ? 'border-green-600 text-[#006e00]'
                      : 'border-amber-500 text-amber-700'
                  }`}
                >
                  {user?.email_verified_at ? 'Verified' : 'Not verified'}
                </span>
              </div>
            </div>
          </div>

          {/* 2. Notification Preferences Card */}
          <div className="border border-gray-300 rounded-xl p-4 bg-white">
            <div className="flex items-center gap-2 mb-4">
              <div className="p-1.5 bg-emerald-100 rounded-full text-emerald-800">
                <Bell className="w-4 h-4" />
              </div>
              <h2 className="text-xs font-bold text-black">Notification Preferences</h2>
            </div>

            <div className="space-y-2.5 text-xs">
              <div className="flex items-center justify-between pb-1.5 border-b border-gray-200">
                <div className="flex items-center gap-2 text-gray-700">
                  <Bell className="w-4 h-4 text-gray-500" />
                  <span>Order Status Updates</span>
                </div>
                <ToggleSwitch enabled={orderStatus} setEnabled={setOrderStatus} />
              </div>

              <div className="flex items-center justify-between pb-1.5 border-b border-gray-200">
                <div className="flex items-center gap-2 text-gray-700">
                  <Bell className="w-4 h-4 text-gray-500" />
                  <span>Payment Alerts</span>
                </div>
                <ToggleSwitch enabled={paymentAlerts} setEnabled={setPaymentAlerts} />
              </div>

              <div className="flex items-center justify-between pb-1.5 border-b border-gray-200">
                <div className="flex items-center gap-2 text-gray-700">
                  <Bell className="w-4 h-4 text-gray-500" />
                  <span>Pickup Reminders</span>
                </div>
                <ToggleSwitch enabled={pickupReminders} setEnabled={setPickupReminders} />
              </div>

              <div className="flex items-center justify-between pb-1.5 border-b border-gray-200">
                <div className="flex items-center gap-2 text-gray-700">
                  <Bell className="w-4 h-4 text-gray-500" />
                  <span>AI Recommendation Alerts</span>
                </div>
                <ToggleSwitch enabled={aiAlerts} setEnabled={setAiAlerts} />
              </div>

              <div className="flex items-center justify-between pt-0.5">
                <div className="flex items-center gap-2 text-gray-700">
                  <Bell className="w-4 h-4 text-gray-500" />
                  <span>Alternative Product Updates</span>
                </div>
                <ToggleSwitch enabled={altProductUpdates} setEnabled={setAltProductUpdates} />
              </div>
            </div>
          </div>

        </div>

        {/* Bottom Row Grid */}
        <div className="grid grid-cols-2 gap-4">

          {/* 3. Shopping & Pickup Preferences Card */}
          <div className="border border-gray-300 rounded-xl p-4 bg-white">
            <div className="flex items-center gap-2 mb-4">
              <div className="p-1.5 bg-emerald-100 rounded-full text-emerald-800">
                <ShoppingCart className="w-4 h-4" />
              </div>
              <h2 className="text-xs font-bold text-black">Shopping & Pickup Preferences</h2>
            </div>

            <div className="space-y-3 text-xs">
              <div className="flex items-center justify-between pb-2 border-b border-gray-200">
                <div className="flex items-center gap-2 text-gray-700">
                  <Store className="w-4 h-4 text-gray-500" />
                  <span className="text-[11px]">Preferred Pickup Branch</span>
                </div>
                <span className="text-[10px] text-gray-800 font-medium">
                  Not configured
                </span>
              </div>

              <div className="flex items-center justify-between pb-2 border-b border-gray-200">
                <div className="flex items-center gap-2 text-gray-700">
                  <ShoppingCart className="w-4 h-4 text-gray-500" />
                  <span>Alternative Product Suggestion</span>
                </div>
                <ToggleSwitch enabled={altSuggestions} setEnabled={setAltSuggestions} />
              </div>

              <div className="flex items-center justify-between pb-2 border-b border-gray-200">
                <div className="flex items-center gap-1.5 text-gray-700">
                  <span className="bg-emerald-100 text-[#006e00] text-[9px] font-bold px-1 py-0.2 rounded flex items-center gap-0.5">
                    <Sparkles className="w-2.5 h-2.5" /> AI
                  </span>
                  <span>AI Recommendation</span>
                </div>
                <ToggleSwitch enabled={aiRecommendation} setEnabled={setAiRecommendation} />
              </div>

              <div className="flex items-center justify-between pt-0.5">
                <div className="flex items-center gap-2 text-gray-700">
                  <Receipt className="w-4 h-4 text-gray-500" />
                  <span>Digital Receipt After Claim</span>
                </div>
                <ToggleSwitch enabled={digitalReceipt} setEnabled={setDigitalReceipt} />
              </div>
            </div>
          </div>

          {/* 4. App Preferences Card */}
          <div className="border border-gray-300 rounded-xl p-4 bg-white">
            <div className="flex items-center gap-2 mb-4">
              <div className="p-1.5 bg-emerald-100 rounded-full text-emerald-800">
                <SettingsIcon className="w-4 h-4" />
              </div>
              <h2 className="text-xs font-bold text-black">App Preferences</h2>
            </div>

            <div className="space-y-3 text-xs">
              <div className="flex items-center justify-between pb-2 border-b border-gray-200">
                <div className="flex items-center gap-2 text-gray-700">
                  <History className="w-4 h-4 text-gray-500" />
                  <span>Shopping History for Recommendation</span>
                </div>
                <ToggleSwitch enabled={historyForRec} setEnabled={setHistoryForRec} />
              </div>

              <div className="flex items-center justify-between pt-0.5">
                <div className="flex items-center gap-2 text-gray-700">
                  <Wallet className="w-4 h-4 text-gray-500" />
                  <span>Show Budget Monitoring in Cart</span>
                </div>
                <ToggleSwitch enabled={budgetMonitoring} setEnabled={setBudgetMonitoring} />
              </div>
            </div>
          </div>

        </div>

        {/* Footer Action Buttons */}
        <div className="flex items-center justify-end gap-3 pt-2">
          <button
            type="button"
            disabled
            className="border border-gray-300 text-gray-400 text-xs font-semibold px-4 py-1.5 rounded-lg cursor-not-allowed"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled
            className="bg-gray-200 text-gray-500 text-xs font-semibold px-4 py-1.5 rounded-lg cursor-not-allowed"
          >
            Save Preferences — unavailable
          </button>
        </div>
      </div>
    </div>
  );
}