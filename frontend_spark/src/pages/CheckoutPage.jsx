import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { fetchWithAuth, isAuthenticated } from "../utils/auth";
import { API_BASE, STORE_API_BASE } from "../config";

function readCart() {
  try {
    const arr = JSON.parse(localStorage.getItem("cart") || "[]");
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}
function writeCart(items) {
  localStorage.setItem("cart", JSON.stringify(items));
  window.dispatchEvent(new CustomEvent("cartChange"));
}
function clearCart() {
  writeCart([]);
}

export default function CheckoutPage() {
  const navigate = useNavigate();
  const [items, setItems] = useState([]);
  const [placed, setPlaced] = useState(false);
  const [orderId, setOrderId] = useState("");

  // Shipping-only form
  const [form, setForm] = useState({
    name: "",
    email: "",
    address: "",
    city: "",
    zip: "",
    country: "",
  });
  const update = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  useEffect(() => {
    setItems(readCart());
    const onChange = () => setItems(readCart());
    window.addEventListener("cartChange", onChange);
    window.addEventListener("storage", onChange);
    return () => {
      window.removeEventListener("cartChange", onChange);
      window.removeEventListener("storage", onChange);
    };
  }, []);

  const currency = items[0]?.currency || "RON";
  const subtotal = useMemo(
    () => items.reduce((s, it) => s + (Number(it.price) || 0) * (it.qty || 1), 0),
    [items]
  );
  const shipping = 0;
  const tax = 0;
  const total = subtotal + shipping + tax;

  const placeOrder = async (e) => {
    e.preventDefault();

    if (!isAuthenticated()) {
      navigate("/login");
      return;
    }

    for (const k of ["name", "email", "address", "city", "zip", "country"]) {
      if (!form[k]) {
        alert("Please fill out all shipping fields.");
        return;
      }
    }
    if (items.length === 0) {
      alert("Your cart is empty.");
      return;
    }

    try {
      // Let the server infer buyerId from JWT; we do NOT send buyerId.
      const payload = {
        items: items.map((it) => ({
          productId: it.id,
          quantity: it.qty || 1,
          priceAtPurchase: Number(it.price) || 0,
        })),
        currency,
        subtotal: Number(subtotal.toFixed(2)),
        total: Number(total.toFixed(2)),

        shippingName: form.name,
        shippingEmail: form.email,
        shippingAddress: form.address,
        shippingCity: form.city,
        shippingZip: form.zip,
        shippingCountry: form.country,
      };

      const res = await fetchWithAuth(`${STORE_API_BASE}/orders`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (res.status === 401) {
        alert("Session expired. Please log in again.");
        navigate("/login");
        return;
      }
      if (!res.ok) {
        const msg = await res.text().catch(() => "");
        alert(`Failed to place order. ${msg || "Bad request"}`);
        return;
      }

      const created = await res.json();
      setOrderId(created.id || "");
      clearCart();
      setPlaced(true);
    } catch (err) {
      alert(err.message || "Failed to place order.");
    }
  };

  if (placed) {
    return (
      <div style={{ maxWidth: 800, margin: "0 auto", padding: 24 }}>
        <h1 style={{ margin: 0, marginBottom: 8 }}>Thank you! 🎉</h1>
        <p style={{ color: "#374151" }}>
          Your order {orderId ? <b>{orderId}</b> : <b>(created)</b>} has been placed.
        </p>
        <div style={{ display: "flex", gap: 12, marginTop: 16 }}>
          <Link
            to="/catalog"
            style={{
              textDecoration: "none",
              padding: "10px 14px",
              borderRadius: 10,
              border: "1px solid #6366f1",
              background: "#6366f1",
              color: "#fff",
              fontWeight: 800,
            }}
          >
            Continue shopping
          </Link>
          <button
            onClick={() => navigate("/")}
            style={{
              padding: "10px 14px",
              borderRadius: 10,
              border: "1px solid #e5e7eb",
              background: "#fff",
              color: "#111827",
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            Go home
          </button>
        </div>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div style={{ maxWidth: 960, margin: "0 auto", padding: 24 }}>
        <h1 style={{ margin: 0, marginBottom: 8 }}>Checkout</h1>
        <p style={{ color: "#6b7280" }}>Your cart is empty.</p>
        <Link
          to="/catalog"
          style={{
            display: "inline-block",
            marginTop: 12,
            padding: "10px 14px",
            borderRadius: 10,
            border: "1px solid #6366f1",
            background: "#6366f1",
            color: "#fff",
            fontWeight: 700,
            textDecoration: "none",
          }}
        >
          Go to catalog
        </Link>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 1100, margin: "0 auto", padding: 24 }}>
      <h1 style={{ margin: 0, marginBottom: 8 }}>Checkout</h1>
      <p style={{ color: "#6b7280", marginTop: 4 }}>
        {items.reduce((s, it) => s + (it.qty || 0), 0)} item(s)
      </p>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 360px",
          gap: 24,
          alignItems: "start",
        }}
      >
        {/* Shipping form */}
        <form
          onSubmit={placeOrder}
          style={{
            border: "1px solid #e5e7eb",
            borderRadius: 12,
            background: "#fff",
            padding: 16,
            display: "grid",
            gap: 12,
          }}
        >
          <div style={{ fontWeight: 800, fontSize: 16 }}>Shipping details</div>

          <label style={{ display: "grid", gap: 6, fontSize: 14 }}>
            Full name
            <input
              value={form.name}
              onChange={(e) => update("name", e.target.value)}
              placeholder="John Doe"
              required
              style={{ padding: "10px 12px", borderRadius: 10, border: "1px solid #e5e7eb" }}
            />
          </label>

          <label style={{ display: "grid", gap: 6, fontSize: 14 }}>
            Email
            <input
              type="email"
              value={form.email}
              onChange={(e) => update("email", e.target.value)}
              placeholder="john@example.com"
              required
              style={{ padding: "10px 12px", borderRadius: 10, border: "1px solid #e5e7eb" }}
            />
          </label>

          <label style={{ display: "grid", gap: 6, fontSize: 14 }}>
            Address
            <input
              value={form.address}
              onChange={(e) => update("address", e.target.value)}
              placeholder="123 Main St"
              required
              style={{ padding: "10px 12px", borderRadius: 10, border: "1px solid #e5e7eb" }}
            />
          </label>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <label style={{ display: "grid", gap: 6, fontSize: 14 }}>
              City
              <input
                value={form.city}
                onChange={(e) => update("city", e.target.value)}
                placeholder="City"
                required
                style={{ padding: "10px 12px", borderRadius: 10, border: "1px solid #e5e7eb" }}
              />
            </label>
            <label style={{ display: "grid", gap: 6, fontSize: 14 }}>
              ZIP
              <input
                value={form.zip}
                onChange={(e) => update("zip", e.target.value)}
                placeholder="123456"
                required
                style={{ padding: "10px 12px", borderRadius: 10, border: "1px solid #e5e7eb" }}
              />
            </label>
          </div>

          <label style={{ display: "grid", gap: 6, fontSize: 14 }}>
            Country
            <input
              value={form.country}
              onChange={(e) => update("country", e.target.value)}
              placeholder="Romania"
              required
              style={{ padding: "10px 12px", borderRadius: 10, border: "1px solid #e5e7eb" }}
            />
          </label>

          <button
            type="submit"
            style={{
              marginTop: 8,
              padding: "12px 14px",
              borderRadius: 10,
              border: "1px solid #10b981",
              background: "#10b981",
              color: "#fff",
              fontWeight: 800,
              cursor: "pointer",
              width: 240,
            }}
          >
            Place order
          </button>
        </form>

        {/* Order summary */}
        <div
          style={{
            border: "1px solid #e5e7eb",
            borderRadius: 12,
            background: "#fff",
            padding: 16,
            display: "grid",
            gap: 12,
          }}
        >
          <div style={{ fontWeight: 800, fontSize: 16 }}>Order summary</div>

          <div
            style={{
              maxHeight: 260,
              overflow: "auto",
              border: "1px solid #f3f4f6",
              borderRadius: 10,
            }}
          >
            {items.map((it) => (
              <div
                key={it.id}
                style={{
                  display: "grid",
                  gridTemplateColumns: "64px 1fr auto",
                  gap: 10,
                  padding: 10,
                  borderBottom: "1px solid #f3f4f6",
                  alignItems: "center",
                }}
              >
                <div
                  style={{
                    width: 64,
                    height: 64,
                    background: "#f3f4f6",
                    borderRadius: 8,
                    overflow: "hidden",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  {it.cover ? (
                    <img
                      src={it.cover}
                      alt={it.name}
                      style={{ width: "100%", height: "100%", objectFit: "cover" }}
                      loading="lazy"
                    />
                  ) : (
                    <span style={{ color: "#9ca3af", fontSize: 11 }}>No image</span>
                  )}
                </div>
                <div style={{ minWidth: 0 }}>
                  <div
                    style={{
                      fontWeight: 700,
                      fontSize: 14,
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    }}
                    title={it.name}
                  >
                    {it.name}
                  </div>
                  <div style={{ color: "#6b7280", fontSize: 12 }}>Qty: {it.qty || 1}</div>
                </div>
                <div style={{ textAlign: "right", fontWeight: 800, fontSize: 14 }}>
                  {(Number(it.price) * (it.qty || 1)).toFixed(2)} {it.currency || currency}
                </div>
              </div>
            ))}
          </div>

          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span>Subtotal</span>
            <b>
              {subtotal.toFixed(2)} {currency}
            </b>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", color: "#6b7280" }}>
            <span>Shipping</span>
            <span>Included</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", color: "#6b7280" }}>
            <span>Tax</span>
            <span>—</span>
          </div>
          <hr style={{ border: 0, borderTop: "1px solid #f3f4f6" }} />
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 18 }}>
            <span style={{ fontWeight: 800 }}>Total</span>
            <span style={{ fontWeight: 800 }}>
              {total.toFixed(2)} {currency}
            </span>
          </div>

          <Link
            to="/cart"
            style={{
              textAlign: "center",
              textDecoration: "none",
              color: "#6366f1",
              fontWeight: 700,
              paddingTop: 4,
            }}
          >
            Back to cart
          </Link>
        </div>
      </div>
    </div>
  );
}
