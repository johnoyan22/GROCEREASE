import { useState } from 'react';
import { useNavigate, useOutletContext } from 'react-router-dom';
import { User, Bell } from 'lucide-react';
import { changeAdminPassword } from '../../services/api';

export default function Settings() {
  const { user } = useOutletContext();
  const profile = user.profile;
  const navigate = useNavigate();

  const [toggles, setToggles] = useState([true, true, true, true]);

    const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPasswords, setShowPasswords] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [passwordError, setPasswordError] = useState('');
  const [passwordSuccess, setPasswordSuccess] = useState('');

  let passwordInputType = 'password';

  if (showPasswords) {
    passwordInputType = 'text';
  }

  function clearPasswordFields() {
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
    setShowPasswords(false);
  }

  function clearPasswordForm() {
    if (isChangingPassword) {
      return;
    }

    clearPasswordFields();
    setPasswordError('');
    setPasswordSuccess('');
  }

  function handleCurrentPasswordChange(event) {
    setCurrentPassword(event.target.value);
    setPasswordError('');
    setPasswordSuccess('');
  }

  function handleNewPasswordChange(event) {
    setNewPassword(event.target.value);
    setPasswordError('');
    setPasswordSuccess('');
  }

  function handleConfirmPasswordChange(event) {
    setConfirmPassword(event.target.value);
    setPasswordError('');
    setPasswordSuccess('');
  }

  function togglePasswordVisibility(event) {
    setShowPasswords(event.target.checked);
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
      const result = await changeAdminPassword({
        current_password: currentPassword,
        password: newPassword,
        password_confirmation: confirmPassword,
      });

      clearPasswordFields();
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
          'Only Admin accounts can use this password form.'
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

  function toggleSwitch(index) {
    setToggles(function (currentToggles) {
      const updatedToggles = currentToggles.slice();

      updatedToggles[index] = !updatedToggles[index];

      return updatedToggles;
    });
  }

  let firstName = 'Not provided';
  let lastName = 'Not provided';
  let phoneNumber = 'Not provided';

  if (profile) {
    firstName = profile.first_name || 'Not provided';
    lastName = profile.last_name || 'Not provided';
    phoneNumber = profile.phone_number || 'Not provided';
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Profile</h1>
        <p className="text-xs text-slate-500">View your administrator account information.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="flex flex-col justify-between rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="space-y-6">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
                <User size={24} />
              </div>

              <h2 className="text-lg font-bold text-slate-800">
                Account & Security
              </h2>
            </div>

            {!profile && (
              <p role="alert" className="text-sm text-amber-700">
                Your account profile could not be found.
              </p>
            )}

            <dl className="space-y-4">
              <div>
                <dt className="text-xs font-bold text-slate-700">
                  First name
                </dt>
                <dd className="mt-1 break-words text-sm font-semibold text-slate-800">
                  {firstName}
                </dd>
              </div>

              <div>
                <dt className="text-xs font-bold text-slate-700">
                  Last name
                </dt>
                <dd className="mt-1 break-words text-sm font-semibold text-slate-800">
                  {lastName}
                </dd>
              </div>

              <div>
                <dt className="text-xs font-bold text-slate-700">
                  Email address
                </dt>
                <dd className="mt-1 break-all text-sm font-semibold text-slate-800">
                  {user.email}
                </dd>
              </div>

              <div>
                <dt className="text-xs font-bold text-slate-700">
                  Phone number
                </dt>
                <dd className="mt-1 break-words text-sm font-semibold text-slate-800">
                  {phoneNumber}
                </dd>
              </div>

              <div>
                <dt className="text-xs font-bold text-slate-700">
                  Role
                </dt>
                <dd className="mt-1 text-sm font-semibold text-slate-800">
                  {user.role.name}
                </dd>
              </div>
            </dl>

            <div className="border-t border-slate-100 pt-4">
              <h3 className="font-semibold text-slate-800">
                Change password
              </h3>

              <p className="mt-1 text-sm text-slate-500">
                Enter your current password to change your account password.
              </p>

              {passwordError && (
                <p role="alert" className="mt-4 text-sm text-red-700">
                  {passwordError}
                </p>
              )}

              {passwordSuccess && (
                <p role="status" className="mt-4 text-sm text-green-700">
                  {passwordSuccess}
                </p>
              )}

              <form onSubmit={handlePasswordSubmit} className="mt-4">
                <fieldset disabled={isChangingPassword} className="space-y-4">
                  <legend className="sr-only">
                    Change your administrator password
                  </legend>

                  <div>
                    <label
                      htmlFor="admin-current-password"
                      className="mb-1 block text-sm font-medium"
                    >
                      Current password
                    </label>

                    <input
                      id="admin-current-password"
                      name="current_password"
                      type={passwordInputType}
                      autoComplete="current-password"
                      value={currentPassword}
                      onChange={handleCurrentPasswordChange}
                      required
                      className="w-full rounded-lg border border-slate-300 px-3 py-2"
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="admin-new-password"
                      className="mb-1 block text-sm font-medium"
                    >
                      New password
                    </label>

                    <input
                      id="admin-new-password"
                      name="password"
                      type={passwordInputType}
                      autoComplete="new-password"
                      value={newPassword}
                      onChange={handleNewPasswordChange}
                      required
                      minLength={8}
                      maxLength={72}
                      className="w-full rounded-lg border border-slate-300 px-3 py-2"
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="admin-confirm-password"
                      className="mb-1 block text-sm font-medium"
                    >
                      Confirm new password
                    </label>

                    <input
                      id="admin-confirm-password"
                      name="password_confirmation"
                      type={passwordInputType}
                      autoComplete="new-password"
                      value={confirmPassword}
                      onChange={handleConfirmPasswordChange}
                      required
                      minLength={8}
                      maxLength={72}
                      className="w-full rounded-lg border border-slate-300 px-3 py-2"
                    />
                  </div>

                  <label className="flex items-center gap-2 text-sm text-slate-700">
                    <input
                      type="checkbox"
                      checked={showPasswords}
                      onChange={togglePasswordVisibility}
                    />
                    Show all passwords
                  </label>

                  <p className="text-sm text-slate-500">
                    Use at least 8 characters.
                  </p>

                  <div className="flex justify-end gap-3">
                    <button
                      type="button"
                      onClick={clearPasswordForm}
                      className="rounded-lg border border-slate-300 px-4 py-2 text-sm"
                    >
                      Clear
                    </button>

                    <button
                      type="submit"
                      className="rounded-lg bg-[#0E5C2F] px-4 py-2 text-sm font-semibold text-white"
                    >
                      {isChangingPassword && <span>Saving...</span>}
                      {!isChangingPassword && <span>Save password</span>}
                    </button>
                  </div>
                </fieldset>
              </form>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-3 mb-6">
              <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                <Bell size={24} />
              </div>
              <h2 className="text-lg font-bold text-slate-800">Notification Preferences</h2>
            </div>

            <div className="divide-y divide-slate-100">
              {['Order Alerts', 'Inventory Low Stock Alerts', 'COP Restriction Alerts', 'Financial Report Summaries'].map((label, i) => (
                <div key={i} className="py-4 flex justify-between items-center">
                  <span className="text-sm font-semibold text-slate-700">{label}</span>
                  <button
                    onClick={() => toggleSwitch(i)}
                    className={`w-12 h-6 flex items-center rounded-full p-1 cursor-pointer transition-colors duration-200 ease-in-out ${
                      toggles[i] ? 'bg-[#0E5C2F]' : 'bg-slate-200'
                    }`}
                  >
                    <div
                      className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform duration-200 ease-in-out ${
                        toggles[i] ? 'translate-x-6' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-3 pt-2">
        <button className="bg-[#0E5C2F] text-white px-6 py-2.5 rounded-xl font-bold text-sm hover:bg-emerald-900 transition-all shadow-sm">
          Save Changes
        </button>
        <button className="bg-white border border-slate-200 text-slate-600 px-6 py-2.5 rounded-xl font-bold text-sm hover:bg-slate-50 transition-all">
          Cancel
        </button>
      </div>
    </div>
  );
}