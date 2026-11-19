export function sellingUnits(product, quantity) {
  const unit = product.selling_unit;
  return unit ? unit + (Number(quantity) === 1 ? '' : 's') : 'units (legacy unit unconfigured)';
}

export function manilaToday() {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date());
  const value = (type) => parts.find((part) => part.type === type).value;
  return `${value('year')}-${value('month')}-${value('day')}`;
}
