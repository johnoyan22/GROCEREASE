import { useState } from 'react';
import {
  User, Lock, Mail, Bell, ShoppingCart, Sparkles, Receipt,
  Store, History, Wallet, Settings as SettingsIcon
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { changeShopperPassword } from '../../services/api';

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

  const navigate = useNavigate();

const [showPasswordForm, setShowPasswordForm] = useState(false);
const [currentPassword, setCurrentPassword] = useState('');
const [newPassword, setNewPassword] = useState('');
const [confirmPassword, setConfirmPassword] = useState('');
const [isChangingPassword, setIsChangingPassword] = useState(false);
const [passwordError, setPasswordError] = useState('');

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

const [passwordSuccess, setPasswordSuccess] = useState('');

function clearPasswordFields() {
  setCurrentPassword('');
  setNewPassword('');
  setConfirmPassword('');

  setIsChecked(false);
  setPasswordInputType('password');
}



function openPasswordForm() {
  clearPasswordFields();
  setPasswordError('');
  setPasswordSuccess('');
  setShowPasswordForm(true);
}

function cancelPasswordChange() {
  if (isChangingPassword) {
    return;
  }

  clearPasswordFields();
  setPasswordError('');
  setShowPasswordForm(false);
}

function handleCurrentPasswordChange(event) {
  setCurrentPassword(event.target.value);
  setPasswordError('');
}

function handleNewPasswordChange(event) {
  setNewPassword(event.target.value);
  setPasswordError('');
}

function handleConfirmPasswordChange(event) {
  setConfirmPassword(event.target.value);
  setPasswordError('');
}

async function handlePasswordSubmit(event) {
  event.preventDefault();

  if (isChangingPassword) {
    return;
  }

  setPasswordError('');
  setPasswordSuccess('');

  if (newPassword !== confirmPassword) {
    setPasswordError('The new passwords do not match.');
    return;
  }

  setIsChangingPassword(true);

  try {
    const result = await changeShopperPassword({
      current_password: currentPassword,
      password: newPassword,
      password_confirmation: confirmPassword,
    });

    clearPasswordFields();
    setShowPasswordForm(false);
    setPasswordSuccess(result.message);
  } catch (error) {
    if (error.status === 401) {
      clearPasswordFields();
      navigate('/login', { replace: true });
      return;
    }

    if (error.status === 422) {
      setPasswordError(error.message);
    } else if (error.status === 419) {
      setPasswordError(
        'Your security session expired. Refresh the page and try again.'
      );
    } else if (error.status === 403) {
      setPasswordError(
        'You cannot change this password right now. Refresh the page to check your account.'
      );
    } else if (error.status === 429) {
      setPasswordError(
        'Too many attempts. Please wait one minute before trying again.'
      );
    } else {
      setPasswordError(
        'Could not confirm the change. Check your connection. If you submitted a change, try signing in with the new password before repeating it.'
      );
    }
  } finally {
    setIsChangingPassword(false);
  }
}

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

              <div className='pb-3 border-b border-gray-200'>
                <div className='flex items-center justify-between gap-3'>
                  <div className='flex items-center gap-2 text-gray-700'>
                    <Lock className='w-4 hh-4 text-gray-500'/>
                    <span>Change Password</span>
                  </div>
                </div>

                <button type='button' onClick={openPasswordForm} disabled={showPasswordForm}
                  className='text-[11px] font-semibold text-[#006e00] disabled:opacity-50'>
                    Change 
                </button>
              </div>

              {passwordError && (
                <p role='alert' className='mt-3 text-red-700'>
                  {passwordError}
                </p>
              )}

              {passwordSuccess && (
                <p role="status" className="mt-3 text-green-700">
                  {passwordSuccess}
                </p>
              )}

              {showPasswordForm && (
                <form onSubmit={handlePasswordSubmit} className='mt-4'>
                  <fieldset disabled={isChangingPassword} className='space-y-3'>
                    <legend className='sr-only'>Change your password</legend>

                    <div>
                      <label htmlFor='current-password' className='block mb-1'>Current password</label>
                      <input id='current-password'
                        name='current_password'
                        type={passwordInputType}
                        autoComplete='current-password'
                        value={currentPassword}
                        onChange={handleCurrentPasswordChange}
                        required
                        className='w-full rounded-lg border border-gray-300 px-3 py-2'
                        />
                    </div>

                    <div>
                      <label htmlFor="new-password" className="block mb-1">
                        New password
                      </label>
                      <input id="new-password"
                        name="password"
                        type={passwordInputType}
                        autoComplete="new-password"
                        value={newPassword}
                        onChange={handleNewPasswordChange}
                        required
                        minLength={8}
                        maxLength={72}
                        className="w-full rounded-lg border border-gray-300 px-3 py-2"
                      />
                    </div>

                    <div>
                      <label htmlFor="confirm-password" className="block mb-1">
                        Confirm new password
                      </label>
                      <input id="confirm-password"
                        name="password_confirmation"
                        type={passwordInputType}
                        autoComplete="new-password"
                        value={confirmPassword}
                        onChange={handleConfirmPasswordChange}
                        required
                        minLength={8}
                        maxLength={72}
                        className="w-full rounded-lg border border-gray-300 px-3 py-2"
                      />
                    </div>
                    <label className="flex items-center gap-2 text-xs font-semibold text-[#006e00]">
                         <input 
                          type="checkbox" 
                          checked={isChecked}
                          onChange={togglePasswordVisibility} 
                          className=''
                        />
                      {passwordInputType === 'password' && (
                        <span>Show all passwords</span>
                      )}

                      {passwordInputType === 'text' && (
                        <span>Hide all passwords</span>
                      )}
                    </label>
                   
                    <p className="text-gray-500"> Use at least 8 characters.</p>

                    <div className="flex justify-end gap-3">
                      <button type="button" onClick={cancelPasswordChange} className="rounded-lg border border-gray-300 px-3 py-2">
                        Cancel
                      </button>

                      <button type="submit" className="rounded-lg bg-[#006e00] px-3 py-2 text-white">
                        {isChangingPassword && <span>Saving...</span>}
                        {!isChangingPassword && <span>Save password</span>}
                      </button>
                    </div>
                  </fieldset>
                </form>
              )}

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