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

// Checkout accepts only the server's options. The bounds helpers above remain
// available to the Supervisor's authorized legacy-window review workflow.
export function checkoutPickupWindows(hours) {
  if (!Array.isArray(hours?.windows)) return [];
  const seen = new Set();
  return hours.windows.filter((window) => {
    if (!window || !pickupWindowFits(hours, window.pickup_start, window.pickup_end)) return false;
    const key = pickupWindowValue(window);
    if (seen.has(key)) return false;
    seen.add(key); return true;
  });
}

export function pickupWindowValue(window) { return window.pickup_start + '/' + window.pickup_end; }
export function checkoutWindowFits(hours, start, end) {
  return checkoutPickupWindows(hours).some((window) => window.pickup_start === start && window.pickup_end === end);
}
export function pickupWindowLabel(window) {
  return pickupTimeLabel(window.pickup_start) + ' – ' + pickupTimeLabel(window.pickup_end);
}

export function pickupTimeLabel(time) {
  if (minutes(time) === null) return '';
  const hour = Number(time.slice(0, 2));
  return `${hour % 12 || 12}:${time.slice(3)} ${hour < 12 ? 'AM' : 'PM'}`;
}

export function pickupServicePeriodFits(operating, pickup) {
  const open = minutes(operating?.opens_at), close = minutes(operating?.closes_at);
  const start = minutes(pickup?.opens_at), end = minutes(pickup?.closes_at);
  return ![open, close, start, end].includes(null) && open < close && start >= open && start < end && end <= close;
}

export function suggestedPickupPeriod(operating) {
  const open = minutes(operating?.opens_at), close = minutes(operating?.closes_at);
  if (open === null || close === null || open >= close) return null;
  // Short days need an explicit Supervisor choice; never create an inverted range.
  return close - open > 120 ? { opens_at: timeText(open + 60), closes_at: timeText(close - 60) }
    : { opens_at: operating.opens_at, closes_at: operating.closes_at };
}

export function pickupServiceTimeOptions(operating, pickup, field) {
  const open = minutes(operating?.opens_at), close = minutes(operating?.closes_at);
  if (open === null || close === null || open >= close) return [];
  const suggested = suggestedPickupPeriod(operating);
  const options = new Set([open, close]);
  for (let time = open; time <= close; time += 30) options.add(time);
  // Keep exact store boundaries, suggestions and previously saved minute values.
  // Existing settings must remain selectable without silently rounding them.
  for (const time of [pickup?.opens_at, pickup?.closes_at, suggested?.opens_at, suggested?.closes_at]) {
    const value = minutes(time);
    if (value !== null && value >= open && value <= close) options.add(value);
  }
  const other = minutes(field === 'opens_at' ? pickup?.closes_at : pickup?.opens_at);
  return [...options].sort((a, b) => a - b).filter((time) => field === 'opens_at'
    ? time < close && (other === null || time < other)
    : time > open && (other === null || time > other)).map(timeText);
}
