import { useEffect, useState } from "react";
import { getCart, setQty, removeItem, getTotal, clearCart } from "../utils/cart";
import { Link, useNavigate } from "react-router-dom";

export default function Checkout() {
  const [cart, setCart] = useState(getCart());
  const navigate = useNavigate();

  useEffect(() => {
    const sync = () => setCart(getCart());
    window.addEventListener("cartChange", sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener("cartChange", sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  const total = getTotal();

  const placeOrder = async () => {
    // Stub: place order via API if/when you have one
    alert("Order placed! 🎉 (stub)");
    clearCart();
    navigate("/");
  };

  return (
    <div style={{ maxWidth: 960, margin: "0 auto", padding: 24 }}>
      <h1 style={{ marginTop: 0 }}>Checkout</h1>

      {cart.items.length === 0 ? (
        <div>
          Cart is empty. <Link to="/catalog">Explore products</Link>
        </div>
      ) : (
        <>
          <div style={{ display: "grid", gap: 10 }}>
            {cart.items.map((it) => (
              <div
                key={it.id}
                style={{
                  display: "grid",
                  gridTemplateColumns: "80px 1fr auto auto",
                  gap: 12,
                  alignItems: "center",
                  border: "1px solid #f3f4f6",
                  borderRadius: 10,
                  padding: 10,
                }}
              >
                <div
                  style={{
                    width: 80,
                    height: 80,
                    borderRadius: 10,
                    overflow: "hidden",
                    background: "#f3f4f6",
                  }}
                >
                  {it.cover ? (
                    <img src={it.cover} alt={it.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                  ) : null}
                </div>
                <div>
                  <div style={{ fontWeight: 700 }}>{it.name}</div>
                  <div style={{ color: "#374151", fontWeight: 700 }}>
                    {it.price} {it.currency || "RON"}
                  </div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <button onClick={() => setQty(it.id, Math.max(1, it.qty - 1))} style={btnMini}>−</button>
                  <span>{it.qty}</span>
                  <button onClick={() => setQty(it.id, it.qty + 1)} style={btnMini}>+</button>
                </div>
                <button onClick={() => removeItem(it.id)} style={{ ...btnMini, borderColor: "#ef4444", color: "#ef4444" }}>
                  Remove
                </button>
              </div>
            ))}
          </div>

          <div
            style={{
              marginTop: 16,
              paddingTop: 12,
              borderTop: "1px dashed #e5e7eb",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              fontSize: 18,
            }}
          >
            <div style={{ fontWeight: 700 }}>Total</div>
            <div style={{ fontWeight: 800 }}>{total.toFixed(2)} RON</div>
          </div>

          <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
            <button
              onClick={placeOrder}
              style={{
                padding: "12px 18px",
                borderRadius: 10,
                border: "1px solid #10b981",
                background: "#10b981",
                color: "#fff",
                fontWeight: 800,
                cursor: "pointer",
              }}
            >
              Place order
            </button>
            <Link
              to="/catalog"
              style={{
                padding: "12px 18px",
                borderRadius: 10,
                border: "1px solid #e5e7eb",
                background: "#fff",
                color: "#111827",
                fontWeight: 700,
                textDecoration: "none",
              }}
            >
              Continue shopping
            </Link>
          </div>
        </>
      )}
    </div>
  );
}

const btnMini = {
  padding: "4px 10px",
  borderRadius: 8,
  border: "1px solid #e5e7eb",
  background: "#fff",
  cursor: "pointer",
  fontWeight: 700,
};
