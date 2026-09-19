// SupervisorProfile.jsx
import { useState } from 'react'
import { UserRound } from 'lucide-react'
import { PageHeader } from './SupervisorUI'
import { storeInfo } from './SupervisorData'
import { useSupervisor } from './SupervisorContext'

export function SupervisorProfile() {
  const { profile, saveProfile } = useSupervisor()
  const [form, setForm] = useState({ ...profile, password: '', confirmPassword: '' })
  const [message, setMessage] = useState('')

  const fields = [
    { key: 'firstName', label: 'First Name' },
    { key: 'lastName', label: 'Last Name' },
    { key: 'email', label: 'Email' },
    { key: 'phone', label: 'Number#' },
    { key: 'password', label: 'Password', type: 'password' },
    { key: 'confirmPassword', label: 'Confirm Password', type: 'password' },
  ]

  function update(key, value) {
    setForm((current) => ({ ...current, [key]: value }))
  }

  function onPhotoChange(event) {
    const file = event.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => update('photoUrl', String(reader.result))
    reader.readAsDataURL(file)
  }

  function cancel() {
    setForm({ ...profile, password: '', confirmPassword: '' })
    setMessage('Changes discarded.')
  }

  function save(event) {
    event.preventDefault()
    if (form.password && form.password !== form.confirmPassword) {
      setMessage('Password and confirm password must match.')
      return
    }
    saveProfile({ ...form, password: '', confirmPassword: '' })
    setForm((current) => ({ ...current, password: '', confirmPassword: '' }))
    setMessage('Profile saved.')
  }

  return (
    <div>
      <PageHeader
        title="Profile"
        subtitle="Change your details and photos on your profile."
        storeName={storeInfo.name}
        storeAddress={storeInfo.address}
      />

      <form onSubmit={save} className="rounded-2xl border border-green-200 bg-white p-6 shadow-sm">
        <div className="mb-6 flex flex-wrap items-center gap-6">
          <div className="flex h-28 w-28 items-center justify-center overflow-hidden rounded-full bg-slate-100 text-slate-400">
            {form.photoUrl ? <img src={form.photoUrl} alt="" className="h-full w-full object-cover" /> : <UserRound size={48} />}
          </div>
          <div>
            <p className="font-medium">{profile.role}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <label className="cursor-pointer rounded-xl border border-green-700 px-4 py-2 text-sm text-green-700">
                Change Photos
                <input type="file" accept="image/*" className="hidden" onChange={onPhotoChange} />
              </label>
              <button type="button" onClick={() => update('photoUrl', '')} className="rounded-xl border border-red-300 px-4 py-2 text-sm text-red-600">
                Delete Photos
              </button>
            </div>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          {fields.map((field) => (
            <label key={field.key} className="block text-sm">
              <span className="mb-1 block text-slate-500">{field.label}</span>
              <input
                type={field.type ?? 'text'}
                value={form[field.key]}
                onChange={(event) => update(field.key, event.target.value)}
                className="w-full rounded-xl border border-slate-200 px-3 py-2"
              />
            </label>
          ))}
        </div>

        <div className="mt-6 flex justify-end gap-3">
          <button type="button" onClick={cancel} className="rounded-xl border border-red-300 px-5 py-2 text-red-600">
            Cancel
          </button>
          <button type="submit" className="rounded-xl bg-green-700 px-5 py-2 text-white">
            Save
          </button>
        </div>
        {message ? <p className="mt-3 text-sm text-slate-600">{message}</p> : null}
      </form>
    </div>
  )
}
