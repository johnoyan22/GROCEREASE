// Query-builder timestamps are UTC without a suffix; Eloquent timestamps already include one.
export function databaseDate(value) {
  if (!value) return null;
  const normalized = value.replace(' ', 'T');
  return new Date(/(?:Z|[+-]\d{2}:\d{2})$/i.test(normalized) ? normalized : normalized + 'Z');
}

export function philippineDay(value) {
  const date = databaseDate(value);
  return date && !Number.isNaN(date.getTime()) ? new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila', year: 'numeric', month: '2-digit', day: '2-digit' }).format(date) : '';
}
