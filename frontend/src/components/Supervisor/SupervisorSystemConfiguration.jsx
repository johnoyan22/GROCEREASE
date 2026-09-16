// SupervisorSystemConfiguration.jsx
import { useState } from 'react'
import { PageHeader } from './SupervisorUI'
import { storeInfo } from './SupervisorData'

export function SupervisorSystemConfiguration({ config, onSaveConfig }) {
  const [form, setForm] = useState(config)
  const [saved, setSaved] = useState(false)

  function update(field, value) {
    setForm((current) => ({ ...current, [field]: value }))
    setSaved(false)
  }

  function submit(event) {
    event.preventDefault()
    onSaveConfig(form)
    setSaved(true)
  }

  const fields = [
    { key: 'storeName', label: 'Store display name', type: 'text' },
    { key: 'lowStockThreshold', label: 'Low stock threshold', type: 'number' },
    { key: 'maxOrdersPerWorker', label: 'Max orders per worker', type: 'number' },
    { key: 'morningShift', label: 'Morning shift', type: 'text' },
    { key: 'afternoonShift', label: 'Afternoon shift', type: 'text' },
    { key: 'eveningShift', label: 'Evening shift', type: 'text' },
  ]

  const toggles = [
    { key: 'pickupEnabled', label: 'Enable in-store pickup' },
    { key: 'copEnabled', label: 'Allow cash on pickup' },
    { key: 'prepaidEnabled', label: 'Allow prepaid / online' },
    { key: 'autoAssignWorkers', label: 'Suggest auto-assign for available workers' },
    { key: 'notifyOnNewOrder', label: 'Notify on new order' },
    { key: 'notifyOnLowStock', label: 'Notify on low stock' },
    { key: 'notifyOnPaymentFail', label: 'Notify on failed payment' },
  ]

  return (
    <div>
      <PageHeader
        title="System Configuration"
        subtitle="Control pickup rules, stock alerts, and notification preferences for this supervisor console."
        storeName={storeInfo.name}
        storeAddress={storeInfo.address}
      />

      <form onSubmit={submit} className="max-w-4xl rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="grid gap-4 sm:grid-cols-2">
          {fields.map((field) => (
            <label key={field.key} className="block text-sm">
              <span className="mb-1 block text-slate-500">{field.label}</span>
              <input
                type={field.type}
                value={form[field.key]}
                onChange={(event) => update(field.key, field.type === 'number' ? Number(event.target.value) : event.target.value)}
                className="w-full rounded-xl border border-slate-200 px-3 py-2"
              />
            </label>
          ))}
        </div>
        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          {toggles.map((field) => (
            <label key={field.key} className="flex items-center gap-3 rounded-xl border border-slate-200 px-3 py-2 text-sm">
              <input type="checkbox" checked={form[field.key]} onChange={(event) => update(field.key, event.target.checked)} />
              {field.label}
            </label>
          ))}
        </div>
        <div className="mt-6 flex items-center gap-3">
          <button type="submit" className="rounded-xl bg-green-700 px-5 py-2 text-white">
            Save configuration
          </button>
          {saved ? <p className="text-sm text-green-700">Saved. Other pages will use these values.</p> : null}
        </div>
      </form>
    </div>
  )
}
