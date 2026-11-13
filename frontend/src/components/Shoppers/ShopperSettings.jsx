import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { changeShopperPassword } from '../../services/api';
export default function ShopperSettings({ user }) {
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


  return <section className="mx-auto w-full max-w-2xl p-4 sm:p-6">
    <h1 className="text-2xl font-bold text-green-900">Account &amp; Security</h1>
    <p className="mt-2 text-sm text-slate-600">Manage your password. Personal details and your photo are in My Profile.</p>
    <div className="mt-6 rounded-xl border border-slate-200 bg-white p-5">
      <p className="break-all text-sm">{user?.email}</p>
      <p className="mt-2 text-sm text-green-800">{user?.email_verified_at ? 'Email verified' : 'Email not verified'}</p>
      <button type="button" onClick={openPasswordForm} disabled={showPasswordForm} className="mt-4 rounded-lg bg-green-800 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">Change password</button>
      {passwordError && <p role="alert" className="mt-3 text-red-700">{passwordError}</p>}
      {passwordSuccess && <p role="status" className="mt-3 text-green-800">{passwordSuccess}</p>}
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

    </div>
  </section>;
}
