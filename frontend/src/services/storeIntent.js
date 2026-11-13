export function storeIntent(value) {
  if (!/^[1-9]\d{0,14}$/.test(String(value ?? ''))) return null;
  const id = Number(value);
  return Number.isSafeInteger(id) ? id : null;
}
export function storeDestination(path, value) {
  const id = storeIntent(value);
  return path + (id ? (path.includes('?') ? '&' : '?') + 'store=' + id : '');
}
