import { useState } from "react";
import { useNavigate, useOutletContext } from "react-router-dom";
import InventoryLayout from "../../components/inventory/layout/InventoryLayout";
import { changeInventoryPassword } from "../../services/api";
import { UserRound } from "lucide-react";

function InventoryProfile() {
  const { user } = useOutletContext();
  const profile = user.profile;
  const navigate = useNavigate();

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPasswords, setShowPasswords] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [passwordError, setPasswordError] = useState("");
  const [passwordSuccess, setPasswordSuccess] = useState("");

  let passwordInputType = "password";

  if (showPasswords) {
    passwordInputType = "text";
  }

  function clearPasswordFields() {
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
    setShowPasswords(false);
  }

  function clearPasswordForm() {
    if (isChangingPassword) {
      return;
    }

    clearPasswordFields();
    setPasswordError("");
    setPasswordSuccess("");
  }

  function handleCurrentPasswordChange(event) {
    setCurrentPassword(event.target.value);
    setPasswordError("");
    setPasswordSuccess("");
  }

  function handleNewPasswordChange(event) {
    setNewPassword(event.target.value);
    setPasswordError("");
    setPasswordSuccess("");
  }

  function handleConfirmPasswordChange(event) {
    setConfirmPassword(event.target.value);
    setPasswordError("");
    setPasswordSuccess("");
  }

  function togglePasswordVisibility(event) {
    setShowPasswords(event.target.checked);
  }

  async function handlePasswordSubmit(event) {
    event.preventDefault();

    if (isChangingPassword) {
      return;
    }

    setPasswordError("");
    setPasswordSuccess("");

    if (newPassword !== confirmPassword) {
      setPasswordError("The new passwords do not match.");
      return;
    }

    setIsChangingPassword(true);

    try {
      const result = await changeInventoryPassword({
        current_password: currentPassword,
        password: newPassword,
        password_confirmation: confirmPassword,
      });

      clearPasswordFields();
      setPasswordSuccess(result.message);
    } catch (error) {
      if (error.status === 401) {
        clearPasswordFields();
        navigate("/login", { replace: true });
        return;
      }

      if (error.status === 422) {
        setPasswordError(error.message);
      } else if (error.status === 419) {
        setPasswordError(
          "Your security session expired. Refresh the page and try again."
        );
      } else if (error.status === 403) {
        setPasswordError(
          "Only Inventory Worker accounts can use this password form."
        );
      } else if (error.status === 429) {
        setPasswordError(
          "Too many attempts. Please wait one minute before trying again."
        );
      } else {
        setPasswordError(
          "Could not confirm the change. Check your connection. If you submitted a change, try signing in with the new password before repeating it."
        );
      }
    } finally {
      setIsChangingPassword(false);
        }
    }

    if (!profile) {
        return (
        <InventoryLayout activePage="Profile">
            <h1 className="text-2xl font-bold">My profile</h1>

            <p role="alert" className="mt-4 text-red-700">
            Your staff profile could not be found. Please contact your administrator.
            </p>
        </InventoryLayout>
        );
    }

  const fullName = profile.first_name + " " + profile.last_name;

  return (
    <InventoryLayout activePage="Profile">
      <div className="mb-5">
        <h1 className="text-2xl font-bold text-gray-800">
          My profile
        </h1>

        <p className="mt-1 text-sm text-gray-600">
          View your account information. Contact your administrator to update
          your staff details.
        </p>
      </div>

      <section className="rounded-xl border border-gray-200 bg-white p-6">
        <div className="flex items-center gap-4">
          <div
            aria-hidden="true"
            className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-gray-100 text-gray-400"
          >
            <UserRound size={36} />
          </div>

          <div className="min-w-0">
            <h2 className="break-words text-lg font-semibold text-gray-800">
              {fullName}
            </h2>

            <p className="mt-1 text-sm text-gray-500">
              {user.role.name}
            </p>
          </div>
        </div>

        <dl className="mt-6 grid gap-5 sm:grid-cols-2">
          <div>
            <dt className="text-sm text-gray-500">First name</dt>
            <dd className="mt-1 break-words font-medium">
              {profile.first_name}
            </dd>
          </div>

          <div>
            <dt className="text-sm text-gray-500">Last name</dt>
            <dd className="mt-1 break-words font-medium">
              {profile.last_name}
            </dd>
          </div>

          <div>
            <dt className="text-sm text-gray-500">Email address</dt>
            <dd className="mt-1 break-all font-medium">
              {user.email}
            </dd>
          </div>

          <div>
            <dt className="text-sm text-gray-500">Phone number</dt>
            <dd className="mt-1 break-words font-medium">
              {profile.phone_number || "Not provided"}
            </dd>
          </div>
        </dl>
      </section>
            <section className="mt-6 rounded-xl border border-gray-200 bg-white p-6">
        <h2 className="text-lg font-semibold text-gray-800">
          Change password
        </h2>

        <p className="mt-1 text-sm text-gray-600">
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
              Change your inventory worker password
            </legend>

            <div>
              <label
                htmlFor="inventory-current-password"
                className="mb-1 block text-sm font-medium"
              >
                Current password
              </label>

              <input
                id="inventory-current-password"
                name="current_password"
                type={passwordInputType}
                autoComplete="current-password"
                value={currentPassword}
                onChange={handleCurrentPasswordChange}
                required
                className="w-full rounded-lg border border-gray-300 px-3 py-2"
              />
            </div>

            <div>
              <label
                htmlFor="inventory-new-password"
                className="mb-1 block text-sm font-medium"
              >
                New password
              </label>

              <input
                id="inventory-new-password"
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
              <label
                htmlFor="inventory-confirm-password"
                className="mb-1 block text-sm font-medium"
              >
                Confirm new password
              </label>

              <input
                id="inventory-confirm-password"
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

            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input
                type="checkbox"
                checked={showPasswords}
                onChange={togglePasswordVisibility}
              />
              Show all passwords
            </label>

            <p className="text-sm text-gray-500">
              Use at least 8 characters.
            </p>

            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={clearPasswordForm}
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm"
              >
                Clear
              </button>

              <button
                type="submit"
                className="rounded-lg bg-green-700 px-4 py-2 text-sm font-semibold text-white"
              >
                {isChangingPassword && <span>Saving...</span>}
                {!isChangingPassword && <span>Save password</span>}
              </button>
            </div>
          </fieldset>
        </form>
      </section>
    </InventoryLayout>
  );
}

export default InventoryProfile;