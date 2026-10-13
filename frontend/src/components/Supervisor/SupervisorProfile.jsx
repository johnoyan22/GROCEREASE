import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { UserRound } from 'lucide-react'
import { PageHeader } from './SupervisorUI'
import { storeInfo } from './SupervisorData'
import { useSupervisor } from './SupervisorContext'
import { changeSupervisorPassword } from '../../services/api'

export function SupervisorProfile() {
  const { profile } = useSupervisor()
  const navigate = useNavigate()

  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPasswords, setShowPasswords] = useState(false)
  const [isChangingPassword, setIsChangingPassword] = useState(false)
  const [passwordError, setPasswordError] = useState('')
  const [passwordSuccess, setPasswordSuccess] = useState('')

  const fullName = profile.firstName + ' ' + profile.lastName

  let passwordInputType = 'password'

  if (showPasswords) {
    passwordInputType = 'text'
  }

  function clearPasswordFields() {
    setCurrentPassword('')
    setNewPassword('')
    setConfirmPassword('')
    setShowPasswords(false)
  }

  function clearPasswordForm() {
    if (isChangingPassword) {
      return
    }

    clearPasswordFields()
    setPasswordError('')
    setPasswordSuccess('')
  }

  function handleCurrentPasswordChange(event) {
    setCurrentPassword(event.target.value)
    setPasswordError('')
    setPasswordSuccess('')
  }

  function handleNewPasswordChange(event) {
    setNewPassword(event.target.value)
    setPasswordError('')
    setPasswordSuccess('')
  }

  function handleConfirmPasswordChange(event) {
    setConfirmPassword(event.target.value)
    setPasswordError('')
    setPasswordSuccess('')
  }

  function togglePasswordVisibility(event) {
    setShowPasswords(event.target.checked)
  }

  async function handlePasswordSubmit(event) {
    event.preventDefault()

    if (isChangingPassword) {
      return
    }

    setPasswordError('')
    setPasswordSuccess('')

    if (newPassword !== confirmPassword) {
      setPasswordError('The new passwords do not match.')
      return
    }

    setIsChangingPassword(true)

    try {
      const result = await changeSupervisorPassword({
        current_password: currentPassword,
        password: newPassword,
        password_confirmation: confirmPassword,
      })

      clearPasswordFields()
      setPasswordSuccess(result.message)
    } catch (error) {
      if (error.status === 401) {
        clearPasswordFields()
        navigate('/login', { replace: true })
        return
      }

      if (error.status === 422) {
        setPasswordError(error.message)
      } else if (error.status === 419) {
        setPasswordError(
          'Your security session expired. Refresh the page and try again.'
        )
      } else if (error.status === 403) {
        setPasswordError(
          'Only Supervisor accounts can use this password form.'
        )
      } else if (error.status === 429) {
        setPasswordError(
          'Too many attempts. Please wait one minute before trying again.'
        )
      } else {
        setPasswordError(
          'Could not confirm the change. Check your connection. If you submitted a change, try signing in with the new password before repeating it.'
        )
      }
    } finally {
      setIsChangingPassword(false)
    }
  }

  return (
    <div>
      <PageHeader
        title="Profile"
        subtitle="View your account information."
        storeName={storeInfo.name}
        storeAddress={storeInfo.address}
      />

      <section className="rounded-2xl border border-green-200 bg-white p-6 shadow-sm">
        <div className="mb-6 flex items-center gap-4">
          <div className="flex h-20 w-20 items-center justify-center rounded-full bg-slate-100 text-slate-400">
            <UserRound size={40} />
          </div>

          <div>
            <h2 className="font-semibold text-slate-900">
              {fullName}
            </h2>
            <p className="text-sm text-slate-500">
              {profile.role}
            </p>
          </div>
        </div>

        <dl className="grid gap-4 sm:grid-cols-2">
          <div>
            <dt className="text-sm text-slate-500">First name</dt>
            <dd className="mt-1 break-words font-medium">
              {profile.firstName}
            </dd>
          </div>

          <div>
            <dt className="text-sm text-slate-500">Last name</dt>
            <dd className="mt-1 break-words font-medium">
              {profile.lastName}
            </dd>
          </div>

          <div>
            <dt className="text-sm text-slate-500">Email address</dt>
            <dd className="mt-1 break-all font-medium">
              {profile.email}
            </dd>
          </div>

          <div>
            <dt className="text-sm text-slate-500">Phone number</dt>
            <dd className="mt-1 break-words font-medium">
              {profile.phone}
            </dd>
          </div>

        </dl>
      </section>
            <section className="mt-6 rounded-2xl border border-green-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">
          Change password
        </h2>

        <p className="mt-1 text-sm text-slate-600">
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
              Change your supervisor password
            </legend>

            <div>
              <label
                htmlFor="supervisor-current-password"
                className="mb-1 block text-sm font-medium"
              >
                Current password
              </label>

              <input id="supervisor-current-password"
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
                htmlFor="supervisor-new-password"
                className="mb-1 block text-sm font-medium"
              >
                New password
              </label>

              <input id="supervisor-new-password"
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
                htmlFor="supervisor-confirm-password"
                className="mb-1 block text-sm font-medium"
              >
                Confirm new password
              </label>

              <input id="supervisor-confirm-password"
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
                className="rounded-lg bg-green-700 px-4 py-2 text-sm font-semibold text-white"
              >
                {isChangingPassword && <span>Saving...</span>}
                {!isChangingPassword && <span>Save password</span>}
              </button>
            </div>
          </fieldset>
        </form>
      </section>
    </div>
  )
}