export function initialsFor(profile) {
  const first = String(profile?.first_name ?? profile?.firstName ?? '').trim();
  const last = String(profile?.last_name ?? profile?.lastName ?? '').trim();
  return ([...first][0] || '') .concat([...last][0] || '').toLocaleUpperCase() || '?';
}
