// A cart stores only inventory IDs and quantities. Prices always come from the current store response.
export function emptyCart() {
  return { store_id: null, items: [] };
}

export function readSavedCart(storage, userId) {
  try {
    const cart = JSON.parse(storage.getItem('grocerease-cart-' + userId));
    if (!cart || !Number.isSafeInteger(cart.store_id) || cart.store_id < 1 || !Array.isArray(cart.items)) return emptyCart();
    const seen = new Set();
    const items = [];
    for (const item of cart.items) {
      if (!Number.isSafeInteger(item.store_inventory_id) || item.store_inventory_id < 1
        || !Number.isSafeInteger(item.quantity) || item.quantity < 1 || seen.has(item.store_inventory_id)) return emptyCart();
      seen.add(item.store_inventory_id);
      items.push({ store_inventory_id: item.store_inventory_id, quantity: item.quantity });
    }
    return { store_id: cart.store_id, items };
  } catch {
    return emptyCart();
  }
}

export function maximumQuantity(product) {
  if (product.max_per_order === null) return product.available_stock;
  return Math.min(product.available_stock, product.max_per_order);
}

export function changeCartQuantity(cart, storeId, product, quantity) {
  if (cart.store_id !== storeId || product.store_id !== storeId) throw new Error('Select one store per cart.');
  if (!Number.isSafeInteger(quantity) || quantity < 0) throw new Error('Enter a whole quantity.');
  if (quantity > maximumQuantity(product)) throw new Error('Quantity exceeds available stock or this product’s per-order limit.');
  const items = [];
  let found = false;
  for (const item of cart.items) {
    if (item.store_inventory_id === product.store_inventory_id) {
      found = true;
      if (quantity > 0) items.push({ store_inventory_id: item.store_inventory_id, quantity });
    } else {
      items.push(item);
    }
  }
  if (!found && quantity > 0) items.push({ store_inventory_id: product.store_inventory_id, quantity });
  return { store_id: storeId, items };
}

export function cartSummary(cart, products) {
  const rows = [];
  let subtotalCentavos = 0;
  let valid = cart.items.length > 0;
  for (const item of cart.items) {
    const product = products.find(function (row) { return row.store_inventory_id === item.store_inventory_id && row.store_id === cart.store_id; });
    let error = '';
    let lineCentavos = 0;
    if (!product) {
      error = 'This product is unavailable. Remove it from your cart.';
    } else if (item.quantity > maximumQuantity(product)) {
      error = 'Reduce the quantity to match current stock and the per-order limit.';
    }
    if (product) {
      const priceParts = product.selling_price.split('.');
      const unitCentavos = Number(priceParts[0]) * 100 + Number(priceParts[1]);
      lineCentavos = unitCentavos * item.quantity;
      if (!Number.isSafeInteger(lineCentavos) || !Number.isSafeInteger(subtotalCentavos + lineCentavos)) {
        error = 'This cart amount is too large. Reduce the quantity.';
        lineCentavos = 0;
      }
      subtotalCentavos = subtotalCentavos + lineCentavos;
    }
    if (error) valid = false;
    rows.push({ ...item, product, lineCentavos, error });
  }
  return { rows, subtotalCentavos, valid };
}
