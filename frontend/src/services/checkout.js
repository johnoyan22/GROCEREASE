import { cartFingerprint } from './cart.js';

export function readCheckoutAttempt(storage, userId, cart) {
  try {
    const attempt = JSON.parse(storage.getItem('grocerease-checkout-' + userId));
    if (attempt?.fingerprint === cartFingerprint(cart)
      && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(attempt.key)) {
      const schedule = attempt.schedule;
      if (schedule && /^\d{4}-\d{2}-\d{2}$/.test(schedule.pickup_date) && /^\d{2}:\d{2}$/.test(schedule.pickup_start) && /^\d{2}:\d{2}$/.test(schedule.pickup_end)) {
        return { key: attempt.key, schedule, ...(attempt.payment ? { payment: attempt.payment } : {}) };
      }
    }
  } catch {
    // A missing or corrupt attempt is not a successful order.
  }
  return null;
}

export function saveCheckoutAttempt(storage, userId, cart, key) {
  // Save before sending the order, so a refresh can recover its original key.
  storage.setItem('grocerease-checkout-' + userId, JSON.stringify({ fingerprint: cartFingerprint(cart), key,
    schedule: { pickup_date: cart.pickup_date, pickup_start: cart.pickup_start, pickup_end: cart.pickup_end },
    ...(cart.payment_method ? { payment: { payment_method: cart.payment_method, payment_channel: cart.payment_channel } } : {}) }));
}

export function clearCheckoutAttempt(storage, userId, key) {
  const saved = JSON.parse(storage.getItem('grocerease-checkout-' + userId));
  if (saved?.key === key) storage.removeItem('grocerease-checkout-' + userId);
}
