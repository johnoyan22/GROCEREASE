import { useMemo, useState } from 'react'

const toneMap = {
  Prepaid: 'blue',
  Online: 'blue',
  'Debit Card': 'purple',
  COP: 'amber',
  Preparing: 'blue',
  'Pending Assignment': 'amber',
  'Ready for Pickup': 'blue',
  Completed: 'green',
  Successful: 'green',
  Pending: 'amber',
  Failed: 'red',
  Refunded: 'gray',
  High: 'red',
  Medium: 'amber',
  Low: 'gray',
  Approved: 'green',
  Rejected: 'red',
  'In Review': 'blue',
  Return: 'blue',
  Refund: 'purple',
  Resolved: 'green',
  Packer: 'blue',
  Picker: 'purple',
  Available: 'green',
  Busy: 'amber',
  Offline: 'red',
}

export function statusTone(value) {
  return toneMap[value] || 'gray'
}

export function stockTone(percent) {
  if (percent <= 30) return 'red'
  if (percent <= 60) return 'amber'
  return 'green'
}

export function useTableQuery(data, searchKeys) {
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('all')
  const [page, setPage] = useState(1)

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase()
    if (!query) return data

    return data.filter((row) =>
      searchKeys.some((key) => String(row[key] ?? '').toLowerCase().includes(query)),
    )
  }, [data, search, searchKeys])

  const pageCount = Math.max(1, Math.ceil(filtered.length / 5))
  const rows = filtered.slice((page - 1) * 5, page * 5)

  return {
    search,
    setSearch,
    filter,
    setFilter,
    page,
    setPage,
    filtered,
    rows,
    pageCount,
    total: filtered.length,
  }
}
