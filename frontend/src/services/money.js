const php = new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' });

// Format minor units without dividing large integers through floating point.
export function formatCentavos(value = 0) {
  if (typeof value === 'number' && !Number.isSafeInteger(value)) throw new Error('Money exceeds the exact display range.');
  const cents = BigInt(value ?? 0), negative = cents < 0n, absolute = negative ? -cents : cents;
  const whole = absolute / 100n, fraction = (absolute % 100n).toString().padStart(2, '0');
  const signed = negative ? (whole === 0n ? -0 : -whole) : whole;
  return php.formatToParts(signed).map(part => part.type === 'fraction' ? fraction : part.value).join('');
}
