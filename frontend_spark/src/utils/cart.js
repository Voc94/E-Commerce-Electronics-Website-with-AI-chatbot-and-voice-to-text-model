const KEY = "spark_cart_v1";

export function getCart() {
  try {
    return JSON.parse(localStorage.getItem(KEY)) || { items: [] };
  } catch {
    return { items: [] };
  }
}

export function saveCart(cart) {
  localStorage.setItem(KEY, JSON.stringify(cart));
  window.dispatchEvent(new CustomEvent("cartChange"));
}

export function addItem(item) {
  const cart = getCart();
  const idx = cart.items.findIndex((i) => i.id === item.id);
  if (idx >= 0) {
    cart.items[idx].qty += item.qty || 1;
  } else {
    cart.items.push({ ...item, qty: item.qty || 1 });
  }
  saveCart(cart);
  return cart;
}

export function removeItem(id) {
  const cart = getCart();
  cart.items = cart.items.filter((i) => i.id !== id);
  saveCart(cart);
  return cart;
}

export function setQty(id, qty) {
  const cart = getCart();
  const it = cart.items.find((i) => i.id === id);
  if (it) {
    it.qty = Math.max(1, qty | 0);
    saveCart(cart);
  }
  return cart;
}

export function clearCart() {
  saveCart({ items: [] });
}

export function getCount() {
  return getCart().items.reduce((n, i) => n + i.qty, 0);
}

export function getTotal() {
  return getCart().items.reduce((sum, i) => sum + Number(i.price || 0) * i.qty, 0);
}
