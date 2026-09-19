// SupervisorUI.jsx
// Small reusable pieces shared by the Supervisor pages: stat cards, badges,
// a data table, a donut/bar chart drawn with plain CSS, pagination, etc.
// Kept in one file (not a folder) on purpose.

import { ChevronDown, Home, Search } from 'lucide-react'

// ---------- layout bits ----------

export function StorePicker({ storeName, storeAddress }) {
  return (
    <button
      type="button"
      className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-left shadow-sm"
    >
      <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-green-50 text-green-700">
        <Home size={16} />
      </span>
      <span>
        <span className="block text-sm font-semibold text-slate-800">{storeName}</span>
        <span className="block text-xs text-slate-400">{storeAddress}</span>
      </span>
      <ChevronDown size={16} className="ml-2 text-slate-400" />
    </button>
  )
}

export function PageHeader({ title, subtitle, storeName, storeAddress }) {
  return (
    <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
      <div>
        <p className="text-xs font-semibold text-green-700">Supervisor</p>
        <h1 className="font-serif text-3xl text-slate-900">{title}</h1>
        {subtitle ? <p className="mt-1 max-w-2xl text-sm text-slate-500">{subtitle}</p> : null}
      </div>
      <StorePicker storeName={storeName} storeAddress={storeAddress} />
    </div>
  )
}

export function StatCard({ icon: Icon, label, value, hint, hintTone = 'green' }) {
  const hintColor = {
    green: 'text-green-700',
    blue: 'text-sky-600',
    orange: 'text-amber-600',
    red: 'text-red-600',
    gray: 'text-slate-400',
  }[hintTone]

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between">
        <span className="text-sm text-slate-500">{label}</span>
        {Icon ? (
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-green-50 text-green-700">
            <Icon size={18} />
          </span>
        ) : null}
      </div>
      <p className="mt-2 text-2xl font-semibold text-slate-900">{value}</p>
      {hint ? <p className={`mt-1 text-xs ${hintColor}`}>{hint}</p> : null}
    </div>
  )
}

export function Badge({ tone = 'gray', children }) {
  const styles = {
    green: 'bg-green-50 text-green-700',
    blue: 'bg-sky-50 text-sky-700',
    amber: 'bg-amber-50 text-amber-700',
    red: 'bg-red-50 text-red-700',
    purple: 'bg-violet-50 text-violet-700',
    gray: 'bg-slate-100 text-slate-600',
  }
  return (
    <span className={`inline-block rounded-full px-2.5 py-1 text-xs font-medium ${styles[tone] || styles.gray}`}>
      {children}
    </span>
  )
}

export function ProgressBar({ value, tone = 'green' }) {
  const colors = { green: 'bg-green-600', amber: 'bg-amber-500', red: 'bg-red-500' }
  return (
    <div className="h-1.5 w-full rounded-full bg-slate-100">
      <div
        className={`h-1.5 rounded-full ${colors[tone] || colors.green}`}
        style={{ width: `${Math.min(100, Math.max(0, value))}%` }}
      />
    </div>
  )
}

// ---------- charts (plain CSS, no chart library) ----------

export function DonutChart({ totalLabel = 'Total', totalValue, segments }) {
  const sum = segments.reduce((acc, seg) => acc + seg.value, 0) || 1
  const stops = segments.map((seg, index) => {
    const previousTotal = segments
      .slice(0, index)
      .reduce((total, previousSegment) => total + previousSegment.value, 0)
    const start = (previousTotal / sum) * 360
    const end = ((previousTotal + seg.value) / sum) * 360
    return `${seg.color} ${start}deg ${end}deg`
  })

  return (
    <div className="flex items-center gap-4">
      <div
        className="relative flex h-28 w-28 shrink-0 items-center justify-center rounded-full"
        style={{ background: `conic-gradient(${stops.join(', ')})` }}
      >
        <div className="flex h-20 w-20 flex-col items-center justify-center rounded-full bg-white text-center">
          <span className="text-lg font-semibold text-slate-900">{totalValue}</span>
          <span className="text-[10px] text-slate-400">{totalLabel}</span>
        </div>
      </div>
      <ul className="space-y-1.5 text-sm">
        {segments.map((seg) => (
          <li key={seg.label} className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: seg.color }} />
            <span className="text-slate-600">{seg.label}</span>
            <span className="text-slate-400">{seg.percent}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

export function BarChart({ items, maxValue }) {
  const max = maxValue || Math.max(...items.map((item) => item.value), 1)
  return (
    <div className="flex h-40 items-end gap-4">
      {items.map((item) => (
        <div key={item.label} className="flex flex-1 flex-col items-center gap-2">
          <div className="flex h-32 w-full items-end justify-center">
            <div
              className="w-6 rounded-t-md bg-green-600"
              style={{ height: `${Math.max(4, (item.value / max) * 100)}%` }}
            />
          </div>
          <span className="text-xs text-slate-400">{item.label}</span>
        </div>
      ))}
    </div>
  )
}

// ---------- table controls ----------

export function DataTable({ columns, rows }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="text-slate-500">
            {columns.map((col) => (
              <th key={col.key} className="whitespace-nowrap py-2 pr-4 font-medium">
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id} className="border-t border-slate-100">
              {columns.map((col) => (
                <td key={col.key} className="whitespace-nowrap py-3 pr-4">
                  {col.render ? col.render(row) : row[col.key]}
                </td>
              ))}
            </tr>
          ))}
          {rows.length === 0 ? (
            <tr>
              <td colSpan={columns.length} className="py-6 text-center text-slate-400">
                Nothing to show yet.
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>
    </div>
  )
}

export function Pagination({ page, pageCount, total, label, onPageChange }) {
  return (
    <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm">
      <span className="text-slate-500">
        Showing {total === 0 ? 0 : (page - 1) * 5 + 1} to {Math.min(page * 5, total)} {label}
      </span>
      <div className="flex items-center gap-1">
        <button
          type="button"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
          className="rounded-lg border border-slate-200 px-2 py-1 disabled:opacity-40"
        >
          ‹
        </button>
        {Array.from({ length: pageCount }, (_, i) => i + 1).map((num) => (
          <button
            key={num}
            type="button"
            onClick={() => onPageChange(num)}
            className={`h-7 w-7 rounded-lg text-xs ${
              num === page ? 'bg-green-700 text-white' : 'border border-slate-200 text-slate-600'
            }`}
          >
            {num}
          </button>
        ))}
        <button
          type="button"
          disabled={page >= pageCount}
          onClick={() => onPageChange(page + 1)}
          className="rounded-lg border border-slate-200 px-2 py-1 disabled:opacity-40"
        >
          ›
        </button>
      </div>
    </div>
  )
}

export function SearchInput({ value, onChange, placeholder }) {
  return (
    <div className="flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm">
      <Search size={14} className="text-slate-400" />
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="w-48 outline-none placeholder:text-slate-400"
      />
    </div>
  )
}

export function Tabs({ options, value, onChange }) {
  return (
    <div className="flex flex-wrap gap-5 border-b border-slate-200 text-sm">
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          onClick={() => onChange(opt.value)}
          className={`-mb-px border-b-2 pb-2 ${
            opt.value === value ? 'border-green-700 font-medium text-green-700' : 'border-transparent text-slate-500'
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  )
}

export function FilterPills({ options, value, onChange }) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          onClick={() => onChange(opt.value)}
          className={`rounded-full px-3 py-1.5 text-xs font-medium ${
            opt.value === value ? 'bg-green-700 text-white' : 'bg-slate-100 text-slate-600'
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  )
}

export function SideCard({ title, action, children }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="font-semibold text-slate-800">{title}</h3>
        {action}
      </div>
      {children}
    </div>
  )
}

export function TipBanner({ text, linkText = 'Learn more' }) {
  return (
    <div className="mt-5 flex items-center justify-between gap-4 rounded-xl bg-green-50 px-4 py-3 text-sm text-green-800">
      <span>{text}</span>
      <a href="#" className="shrink-0 font-medium text-green-700">
        {linkText} ›
      </a>
    </div>
  )
}
