function cartFingerprint(cart) {
  const items = cart.items.map(function (item) {
    return { store_inventory_id: item.store_inventory_id, quantity: item.quantity };
  }).sort(function (first, second) { return first.store_inventory_id - second.store_inventory_id; });
  return JSON.stringify({ store_id: cart.store_id, items });
}

export function readCheckoutAttempt(storage, userId, cart) {
  try {
    const attempt = JSON.parse(storage.getItem('grocerease-checkout-' + userId));
    if (attempt?.fingerprint === cartFingerprint(cart)
      && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(attempt.key)) {
      const schedule = attempt.schedule;
      if (schedule && /^\d{4}-\d{2}-\d{2}$/.test(schedule.pickup_date) && /^\d{2}:\d{2}$/.test(schedule.pickup_start) && /^\d{2}:\d{2}$/.test(schedule.pickup_end)) {
        return { key: attempt.key, schedule };
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
    schedule: { pickup_date: cart.pickup_date, pickup_start: cart.pickup_start, pickup_end: cart.pickup_end } }));
}

export function clearCheckoutAttempt(storage, userId, key) {
  const saved = JSON.parse(storage.getItem('grocerease-checkout-' + userId));
  if (saved?.key === key) storage.removeItem('grocerease-checkout-' + userId);
}
