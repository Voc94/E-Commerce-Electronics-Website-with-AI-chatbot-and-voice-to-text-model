// src/utils/auth.js
const TOKEN_KEY = "jwt_token";

export function setToken(token) {
  localStorage.setItem(TOKEN_KEY, token);
  window.dispatchEvent(new Event("authChange"));
}
export function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}
export function logout() {
  localStorage.removeItem(TOKEN_KEY);

  // clear cart (works with your array-based cart)
  localStorage.setItem("cart", "[]");
  window.dispatchEvent(new CustomEvent("cartChange"));

  window.dispatchEvent(new Event("authChange"));
}


function parseJwt(token) {
  try {
    const payload = token.split(".")[1];
    const padded = payload + "=".repeat((4 - (payload.length % 4)) % 4);
    return JSON.parse(atob(padded.replace(/-/g, "+").replace(/_/g, "/")));
  } catch {
    return null;
  }
}

export function isAuthenticated() {
  const token = getToken();
  if (!token) return false;
  const data = parseJwt(token);
  if (!data || !data.exp) return false;
  return Date.now() / 1000 < data.exp;
}

/**
 * Convenience: returns decoded JWT payload or null.
 */
export function getJwtPayload() {
  const token = getToken();
  if (!token) return null;
  return parseJwt(token);
}

export async function fetchWithAuth(url, opts = {}) {
  const token = getToken();
  const headers = {
    ...(opts.headers || {}),
    Authorization: token ? `Bearer ${token}` : "",
  };
  const res = await fetch(url, { ...opts, headers });
  if (res.status === 401) {
    logout();
    window.location.href = "/login";
    throw new Error("Unauthorized");
  }
  return res;
}
