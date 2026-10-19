function minutes(time) {
  if (typeof time !== 'string' || !/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) return null;
  const parts = time.split(':');
  return Number(parts[0]) * 60 + Number(parts[1]);
}

function timeText(value) {
  return String(Math.floor(value / 60)).padStart(2, '0') + ':' + String(value % 60).padStart(2, '0');
}

export function pickupWindowBounds(hours, selectedStart = '') {
  if (!hours) return null;
  const opening = minutes(hours.earliest_start_at ?? hours.opens_at);
  const closing = minutes(hours.closes_at);
  const storeOpening = minutes(hours.store_opens_at ?? hours.opens_at);
  const storeClosing = minutes(hours.store_closes_at ?? hours.closes_at);
  if ([opening, closing, storeOpening, storeClosing].includes(null)) return null;
  const first = Math.max(opening, storeOpening);
  const last = Math.min(closing, storeClosing);
  if (first >= last) return null;
  const start = minutes(selectedStart);
  const endMinimum = start !== null && start >= first && start < last ? start + 1 : first + 1;
  return { startMin: timeText(first), startMax: timeText(last - 1), endMin: timeText(endMinimum), endMax: timeText(last) };
}

export function pickupWindowFits(hours, start, end) {
  const bounds = pickupWindowBounds(hours, start);
  if (!bounds || minutes(start) === null || minutes(end) === null) return false;
  return start >= bounds.startMin && start <= bounds.startMax && end >= bounds.endMin && end <= bounds.endMax;
}
