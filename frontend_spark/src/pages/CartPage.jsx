// src/pages/CartPage.jsx
import { useEffect, useState, useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";

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

export default function CartPage() {
  const [items, setItems] = useState([]);
  const navigate = useNavigate();

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

  const setQty = (id, qty) => {
    qty = Math.max(1, Number(qty) || 1);
    const next = items.map((it) => (it.id === id ? { ...it, qty } : it));
    setItems(next);
    writeCart(next);
  };

  const removeItem = (id) => {
    const next = items.filter((it) => it.id !== id);
    setItems(next);
    writeCart(next);
  };

  const clearCart = () => {
    setItems([]);
    writeCart([]);
  };

  if (items.length === 0) {
    return (
      <div style={{ maxWidth: 960, margin: "0 auto", padding: 24 }}>
        <h1 style={{ margin: 0, marginBottom: 8 }}>Your cart</h1>
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
          Continue shopping
        </Link>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 1100, margin: "0 auto", padding: 24 }}>
      <h1 style={{ margin: 0, marginBottom: 8 }}>Your cart</h1>
      <p style={{ color: "#6b7280", marginTop: 4 }}>
        {items.reduce((s, it) => s + (it.qty || 0), 0)} item(s)
      </p>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 320px",
          gap: 24,
          alignItems: "start",
        }}
      >
        {/* Items list */}
        <div
          style={{
            border: "1px solid #e5e7eb",
            borderRadius: 12,
            overflow: "hidden",
            background: "#fff",
          }}
        >
          {items.map((it) => (
            <div
              key={it.id}
              style={{
                display: "grid",
                gridTemplateColumns: "96px 1fr auto",
                gap: 12,
                padding: 12,
                borderBottom: "1px solid #f3f4f6",
                alignItems: "center",
              }}
            >
              <div
                style={{
                  width: 96,
                  height: 96,
                  background: "#f3f4f6",
                  borderRadius: 10,
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
                  <span style={{ color: "#9ca3af", fontSize: 12 }}>No image</span>
                )}
              </div>

              <div style={{ minWidth: 0 }}>
                <div
                  style={{
                    fontWeight: 700,
                    fontSize: 15,
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}
                  title={it.name}
                >
                  {it.name}
                </div>

                <div style={{ marginTop: 8, display: "flex", gap: 12, alignItems: "center" }}>
                  <label style={{ fontSize: 13, color: "#6b7280" }}>
                    Qty:
                    <input
                      type="number"
                      min={1}
                      value={it.qty || 1}
                      onChange={(e) => setQty(it.id, e.target.value)}
                      style={{
                        width: 64,
                        marginLeft: 6,
                        padding: "6px 8px",
                        borderRadius: 8,
                        border: "1px solid #e5e7eb",
                        outline: "none",
                      }}
                    />
                  </label>

                  <button
                    onClick={() => removeItem(it.id)}
                    style={{
                      padding: "6px 10px",
                      borderRadius: 8,
                      border: "1px solid #ef4444",
                      background: "#fff",
                      color: "#ef4444",
                      fontWeight: 700,
                      cursor: "pointer",
                    }}
                  >
                    Remove
                  </button>
                </div>
              </div>

              <div style={{ textAlign: "right", fontWeight: 800 }}>
                {it.price} {it.currency || "RON"}
              </div>
            </div>
          ))}

          <div style={{ padding: 12 }}>
            <button
              onClick={clearCart}
              style={{
                padding: "8px 12px",
                borderRadius: 8,
                border: "1px solid #e5e7eb",
                background: "#fff",
                color: "#1f2937",
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              Clear cart
            </button>
          </div>
        </div>

        {/* Summary */}
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

          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span>Subtotal</span>
            <b>
              {subtotal.toFixed(2)} {currency}
            </b>
          </div>

          <div style={{ color: "#6b7280", fontSize: 13 }}>
            Taxes and shipping are calculated at checkout.
          </div>

          <button
            onClick={() => navigate("/checkout")}
            style={{
              padding: "12px 14px",
              borderRadius: 10,
              border: "1px solid #6366f1",
              background: "#6366f1",
              color: "#fff",
              fontWeight: 800,
              cursor: "pointer",
              width: "100%",
            }}
          >
            Proceed to checkout
          </button>

          <Link
            to="/catalog"
            style={{
              textAlign: "center",
              textDecoration: "none",
              color: "#6366f1",
              fontWeight: 700,
              paddingTop: 4,
            }}
          >
            Continue shopping
          </Link>
        </div>
      </div>
    </div>
  );
}
