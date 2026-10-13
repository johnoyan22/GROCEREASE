import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { User, Edit3 } from 'lucide-react';
import { updateShopperProfile } from '../../services/api';

export default function ShopperMyProfile({ user, onProfileUpdated }) {
  const navigate = useNavigate();

  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [draft, setDraft] = useState({
    first_name: '',
    last_name: '',
    address: '',
  });
  const [fieldErrors, setFieldErrors] = useState({});
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  const profile = user?.profile;

  function startEditing() {
    setDraft({
      first_name: profile.first_name || '',
      last_name: profile.last_name || '',
      address: profile.address || '',
    });
    setFieldErrors({});
    setErrorMessage('');
    setSuccessMessage('');
    setIsEditing(true);
  }

  function cancelEditing() {
    if (isSaving) return;

    setFieldErrors({});
    setErrorMessage('');
    setIsEditing(false);
  }

  function handleChange(event) {
    const { name, value } = event.target;

    setDraft((currentDraft) => ({
      ...currentDraft,
      [name]: value,
    }));

    setFieldErrors((currentErrors) => ({
      ...currentErrors,
      [name]: [],
    }));
    setErrorMessage('');
  }

  async function handleSave(event) {
    event.preventDefault();

    if (isSaving) return;

    setIsSaving(true);
    setFieldErrors({});
    setErrorMessage('');
    setSuccessMessage('');

    try {
      const result = await updateShopperProfile({
        first_name: draft.first_name.trim(),
        last_name: draft.last_name.trim(),
        address: draft.address.trim() || null,
      });

      onProfileUpdated(result.user);
      setIsEditing(false);
      setSuccessMessage(result.message);
    } catch (error) {
      if (error.status === 401) {
        navigate('/login', { replace: true });
        return;
      }

      if (error.status === 422) {
        setFieldErrors(error.errors || {});
        setErrorMessage('Please correct the highlighted fields.');
      } else if (error.status === 419) {
        setErrorMessage(
          'Your security session expired. Refresh the page and try again.'
        );
      } else if (error.status === 403) {
        setErrorMessage(
          'You no longer have permission to update this profile. Refresh the page to check your account.'
        );
      } else if (error.status === 404) {
        setErrorMessage(
          'Your profile could not be found. Please contact your administrator.'
        );
      } else {
        setErrorMessage(
          'Could not confirm the save. Check your connection and reload your profile before trying again.'
        );
      }
    } finally {
      setIsSaving(false);
    }
  }

  if (!profile) {
    return (
      <div className="p-6">
        <p role="alert" className="text-sm text-red-600">
          Your account does not have a profile. Please contact your administrator.
        </p>
      </div>
    );
  }

  const fullName =
    `${profile.first_name || ''} ${profile.last_name || ''}`.trim();

  const savedDetails = [
    ['Full name', fullName || 'Not provided'],
    ['Email address', user.email],
    ['Phone number', profile.phone_number || 'Not provided'],
    ['Address', profile.address || 'Not provided'],
    [
      'Email verification',
      user.email_verified_at ? 'Verified' : 'Not verified',
    ],
  ];

  const editableFields = [
    { name: 'first_name', label: 'First name', required: true },
    { name: 'last_name', label: 'Last name', required: true },
    { name: 'address', label: 'Address', required: false },
  ];


  return (
    <div className="flex-1 bg-white min-h-screen p-6 font-sans">
      {/* Title Header */}
      <div className="mb-6">
        <h1 className="text-sm font-bold text-black">My Profile</h1>
        <p className="text-xs text-gray-600 mt-0.5">Manage your personal information and account details.</p>
      </div>

      <div className="max-w-5xl space-y-4">
        {successMessage && (
          <p role='status' className='rounded-lg border border-green-200 bg-green-50 p-3 text-xs text-green-800'>
            {successMessage}
          </p>
        )}
        {errorMessage && (
          <p role='alert' className="rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-700">
            {errorMessage}
          </p>
        )}

         <section className="border border-green-600 rounded-xl p-5 bg-white shadow-xs">
          <div className="flex items-center justify-between gap-3 mb-5 pb-4 border-b border-gray-100">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full border border-gray-300 flex items-center justify-center bg-gray-50">
                <User className="w-5 h-5 text-gray-700" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-black">
                  {fullName || 'Shopper'}
                </h2>
                <p className="text-[11px] text-gray-500">Shopper</p>
              </div>
            </div>

            {!isEditing && (
              <button
                type="button"
                onClick={startEditing}
                className="border border-green-700 text-[#006e00] text-xs font-bold px-3 py-2 rounded-lg hover:bg-green-50 flex items-center gap-2"
              >
                <Edit3 className="w-4 h-4" />
                Edit Profile
              </button>
            )}
          </div>

          {isEditing ? (
            <form onSubmit={handleSave} className="space-y-4">
              <fieldset
                disabled={isSaving}
                className="grid gap-4 sm:grid-cols-2"
              >
                <legend className="sr-only">Edit personal details</legend>

                {editableFields.map((field) => (
                  <div
                    key={field.name}
                    className={field.name === 'address' ? 'sm:col-span-2' : ''}
                  >
                    <label
                      htmlFor={`profile-${field.name}`}
                      className="block text-xs font-semibold text-gray-700 mb-2"
                    >
                      {field.label}
                    </label>
                    <input
                      id={`profile-${field.name}`}
                      name={field.name}
                      type="text"
                      value={draft[field.name]}
                      onChange={handleChange}
                      required={field.required}
                      maxLength={255}
                      aria-invalid={Boolean(fieldErrors[field.name]?.length)}
                      aria-describedby={
                        fieldErrors[field.name]?.length
                          ? `profile-${field.name}-error`
                          : undefined
                      }
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:border-green-700 disabled:bg-gray-100"
                    />
                    {fieldErrors[field.name]?.length > 0 && (
                      <p
                        id={`profile-${field.name}-error`}
                        className="mt-1 text-xs text-red-600"
                      >
                        {fieldErrors[field.name][0]}
                      </p>
                    )}
                  </div>
                ))}
              </fieldset>

              <p className="text-xs text-gray-500">
                Email and phone number cannot be changed through this form.
              </p>

              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={cancelEditing}
                  disabled={isSaving}
                  className="rounded-lg border border-gray-300 px-4 py-2 text-xs font-semibold text-gray-700 disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="rounded-lg bg-[#006e00] px-4 py-2 text-xs font-semibold text-white hover:bg-green-800 disabled:opacity-50"
                >
                  {isSaving ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          ) : (
            <dl className="grid gap-4 sm:grid-cols-2">
              {savedDetails.map(([label, value]) => (
                <div key={label} className="border-b border-gray-200 pb-3">
                  <dt className="text-xs text-gray-600">{label}</dt>
                  <dd className="mt-1 text-sm font-semibold text-black break-words">
                    {value}
                  </dd>
                </div>
              ))}
            </dl>
          )}
        </section>

        <p className="text-xs text-gray-500">
          You can update your first name, last name, and address here.
        </p>
      </div>
    </div>
  );
}