// src/components/CartMenu.jsx
import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getCart, removeItem, setQty, clearCart } from "../utils/cart";

export default function CartMenu() {
  const [open, setOpen] = useState(false);
  const [cart, setCart] = useState(getCart());
  const btnRef = useRef(null);
  const panelRef = useRef(null);
  const navigate = useNavigate();

  const count = cart.items.reduce((n, i) => n + i.qty, 0);
  const total = cart.items.reduce((s, i) => s + Number(i.price || 0) * i.qty, 0);

  // keep in sync with localStorage
  useEffect(() => {
    const sync = () => setCart(getCart());
    window.addEventListener("cartChange", sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener("cartChange", sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  // click outside to close
  useEffect(() => {
    const onDocClick = (e) => {
      if (!open) return;
      if (
        panelRef.current &&
        !panelRef.current.contains(e.target) &&
        btnRef.current &&
        !btnRef.current.contains(e.target)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [open]);

  return (
    <div style={{ position: "relative" }}>
      <button
        ref={btnRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="Cart"
        title="Cart"
        style={{
          position: "relative",
          padding: "8px 12px",
          borderRadius: 8,
          border: "1px solid #e5e7eb",
          background: "#fff",
          cursor: "pointer",
          fontWeight: 700,
        }}
      >
        🛒 Cart
        {count > 0 && (
          <span
            style={{
              position: "absolute",
              top: -6,
              right: -6,
              background: "#ef4444",
              color: "#fff",
              borderRadius: 999,
              fontSize: 12,
              lineHeight: "18px",
              minWidth: 18,
              height: 18,
              textAlign: "center",
              padding: "0 4px",
              boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
            }}
          >
            {count}
          </span>
        )}
      </button>

      {open && (
        <div
          ref={panelRef}
          style={{
            position: "absolute",
            right: 0,
            top: "110%",
            width: 360,
            background: "#fff",
            border: "1px solid #e5e7eb",
            borderRadius: 12,
            boxShadow: "0 10px 30px rgba(0,0,0,0.1)",
            padding: 12,
            zIndex: 80,
            display: "grid",
            gridTemplateRows: "auto 1fr auto", // header | list | footer
            maxHeight: 520,
          }}
        >
          <div style={{ fontWeight: 800, marginBottom: 8 }}>Your Cart</div>

          {/* Scrollable items area */}
          <div style={{ overflowY: "auto", paddingRight: 4 }}>
            {cart.items.length === 0 ? (
              <div style={{ color: "#6b7280", padding: "8px 0" }}>Cart is empty</div>
            ) : (
              <div style={{ display: "grid", gap: 10 }}>
                {cart.items.map((it) => (
                  <div
                    key={it.id}
                    style={{
                      display: "grid",
                      gridTemplateColumns: "64px 1fr auto",
                      gap: 8,
                      alignItems: "center",
                      border: "1px solid #f3f4f6",
                      borderRadius: 8,
                      padding: 8,
                      background: "#fff",
                    }}
                  >
                    <div
                      style={{
                        width: 64,
                        height: 64,
                        borderRadius: 8,
                        overflow: "hidden",
                        background: "#f3f4f6",
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
                        <div
                          style={{
                            width: "100%",
                            height: "100%",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            color: "#9ca3af",
                            fontSize: 12,
                          }}
                        >
                          —
                        </div>
                      )}
                    </div>

                    <div style={{ minWidth: 0 }}>
                      <div
                        title={it.name}
                        style={{
                          fontWeight: 700,
                          fontSize: 14,
                          whiteSpace: "nowrap",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                        }}
                      >
                        {it.name}
                      </div>
                      <div style={{ color: "#374151", fontWeight: 700 }}>
                        {it.price} {it.currency || "RON"}
                      </div>
                      <div style={{ marginTop: 6, display: "flex", alignItems: "center", gap: 6 }}>
                        <button
                          onClick={() => setQty(it.id, Math.max(1, (it.qty || 1) - 1))}
                          style={btnMini}
                          aria-label="decrease"
                        >
                          −
                        </button>
                        <span style={{ minWidth: 24, textAlign: "center" }}>{it.qty}</span>
                        <button
                          onClick={() => setQty(it.id, (it.qty || 1) + 1)}
                          style={btnMini}
                          aria-label="increase"
                        >
                          +
                        </button>
                      </div>
                    </div>

                    <button
                      onClick={() => removeItem(it.id)}
                      style={{
                        ...btnMini,
                        borderColor: "#ef4444",
                        color: "#ef4444",
                      }}
                      aria-label="remove"
                      title="Remove"
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Footer (pinned) */}
          <div
            style={{
              marginTop: 8,
              paddingTop: 8,
              borderTop: "1px dashed #e5e7eb",
              display: "grid",
              gap: 8,
              background: "#fff",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <div style={{ fontWeight: 700 }}>Total</div>
              <div style={{ fontWeight: 800 }}>{total.toFixed(2)} RON</div>
            </div>

            <div style={{ display: "flex", gap: 8 }}>
              <button
                onClick={() => {
                  setOpen(false);
                  navigate("/checkout");
                }}
                style={primaryBtn}
              >
                Checkout
              </button>

              {/* 🔴 HIGH-CONTRAST CLEAR BUTTON */}
              <button
                onClick={() => clearCart()}
                style={dangerBtn}
                title="Clear cart"
                onMouseEnter={(e) => (e.currentTarget.style.filter = "brightness(0.95)")}
                onMouseLeave={(e) => (e.currentTarget.style.filter = "none")}
              >
                🗑 Clear
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const btnMini = {
  padding: "2px 8px",
  borderRadius: 8,
  border: "1px solid #e5e7eb",
  background: "#fff",
  cursor: "pointer",
  fontWeight: 700,
};

const primaryBtn = {
  flex: 1,
  padding: "10px 14px",
  borderRadius: 10,
  border: "1px solid #6366f1",
  background: "#6366f1",
  color: "#fff",
  fontWeight: 800,
  cursor: "pointer",
};

const dangerBtn = {
  padding: "10px 14px",
  borderRadius: 10,
  border: "1px solid #dc2626",
  background: "#ef4444", // solid red
  color: "#fff",         // white text
  fontWeight: 800,
  cursor: "pointer",
};
