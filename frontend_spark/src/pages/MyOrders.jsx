// src/pages/MyOrders.jsx
import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { fetchWithAuth, isAuthenticated, getJwtPayload } from "../utils/auth";
import { API_BASE, STORE_API_BASE } from "../config";

function isUuid(v = "") {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
}

async function resolveBuyerId() {
  const payload = getJwtPayload();
  const uid = payload?.uid;
  const sub = payload?.sub;
  if (uid && isUuid(uid)) return uid;
  if (sub && isUuid(sub)) return sub;

  // fallback to user profile
  const res = await fetchWithAuth(`${API_BASE}/auth/me`);
  if (!res.ok) throw new Error("Unable to resolve user id");
  const me = await res.json();
  if (!me?.id || !isUuid(me.id)) throw new Error("Profile missing UUID id");
  return me.id;
}

function formatMoney(v, currency = "RON") {
  const n = Number(v || 0);
  return `${n.toFixed(2)} ${currency}`;
}

function formatDate(iso) {
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso || "";
  }
}

export default function MyOrders() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [orders, setOrders] = useState([]);
  const [error, setError] = useState("");

  const load = async () => {
    try {
      setLoading(true);
      setError("");

      if (!isAuthenticated()) {
        navigate("/login");
        return;
      }

      const buyerId = await resolveBuyerId();
      const res = await fetchWithAuth(`${STORE_API_BASE}/orders/buyer/${buyerId}`);
      if (res.status === 401) {
        navigate("/login");
        return;
      }
      if (!res.ok) {
        const msg = await res.text().catch(() => "");
        throw new Error(msg || `Failed to fetch orders (${res.status})`);
      }
      const data = await res.json();
      setOrders(Array.isArray(data) ? data : []);
    } catch (e) {
      setError(e.message || "Failed to fetch orders");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div style={{ maxWidth: 1100, margin: "0 auto", padding: 24 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h1 style={{ margin: 0 }}>My orders</h1>
        <button
          onClick={load}
          style={{
            padding: "8px 12px",
            borderRadius: 8,
            border: "1px solid #e5e7eb",
            background: "#fff",
            color: "#000",
            cursor: "pointer",
            fontWeight: 700,
          }}
          aria-label="Refresh"
        >
          Refresh
        </button>
      </div>

      {loading && (
        <div
          style={{
            marginTop: 16,
            height: 3,
            background:
              "linear-gradient(90deg, rgba(99,102,241,.2), rgba(99,102,241,.6), rgba(99,102,241,.2))",
            backgroundSize: "200% 100%",
            animation: "shimmer 1s linear infinite",
            borderRadius: 2,
          }}
        />
      )}

      {!loading && error && (
        <div
          style={{
            marginTop: 16,
            padding: "10px 12px",
            borderRadius: 8,
            background: "#fff7ed",
            border: "1px solid #ffd7aa",
            color: "#9a3412",
            fontSize: 14,
          }}
        >
          {error}
        </div>
      )}

      {!loading && !error && orders.length === 0 && (
        <div
          style={{
            marginTop: 16,
            padding: "10px 12px",
            borderRadius: 8,
            background: "#f9fafb",
            border: "1px solid #e5e7eb",
            color: "#4b5563",
            fontSize: 14,
          }}
        >
          You don’t have any orders yet.
        </div>
      )}

      <div style={{ display: "grid", gap: 14, marginTop: 16 }}>
        {orders.map((o) => (
          <div
            key={o.id}
            style={{
              border: "1px solid #e5e7eb",
              borderRadius: 12,
              background: "#fff",
              padding: 14,
              display: "grid",
              gap: 10,
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "baseline",
                flexWrap: "wrap",
                gap: 8,
              }}
            >
              <div style={{ fontWeight: 800, fontSize: 16 }}>
                Order <span style={{ fontWeight: 700, color: "#6b7280" }}>{o.id}</span>
              </div>
              <div style={{ color: "#6b7280", fontSize: 13 }}>{formatDate(o.createdAt)}</div>
            </div>

            <div style={{ display: "grid", gap: 6 }}>
              {o.items?.map((it) => (
                <div
                  key={it.id}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr auto",
                    alignItems: "center",
                    border: "1px solid #f3f4f6",
                    borderRadius: 8,
                    padding: "8px 10px",
                    background: "#fff",
                  }}
                >
                  <div style={{ minWidth: 0 }}>
                    <div
                      title={it.productName}
                      style={{
                        fontWeight: 700,
                        fontSize: 14,
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                      }}
                    >
                      {it.productName || it.productId}
                    </div>
                    <div style={{ color: "#6b7280", fontSize: 12 }}>Qty: {it.qty}</div>
                  </div>
                  <div style={{ fontWeight: 800, fontSize: 14 }}>
                    {formatMoney((Number(it.unitPrice) || 0) * (it.qty || 1), it.currency || o.currency)}
                  </div>
                </div>
              ))}
            </div>

            <div style={{ display: "grid", gap: 6, marginTop: 6 }}>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span>Subtotal</span>
                <b>{formatMoney(o.subtotal, o.currency)}</b>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", color: "#6b7280" }}>
                <span>Shipping</span>
                <span>{formatMoney(o.shipping, o.currency)}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", color: "#6b7280" }}>
                <span>Tax</span>
                <span>{formatMoney(o.tax, o.currency)}</span>
              </div>
              <hr style={{ border: 0, borderTop: "1px solid #f3f4f6" }} />
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 16 }}>
                <span style={{ fontWeight: 800 }}>Total</span>
                <span style={{ fontWeight: 800 }}>{formatMoney(o.total, o.currency)}</span>
              </div>
            </div>

            <div style={{ color: "#6b7280", fontSize: 13 }}>
              Ship to: <b>{o.fullName}</b>, {o.address}, {o.city}, {o.zip}, {o.country}
            </div>
          </div>
        ))}
      </div>

      <style>{`
        @keyframes shimmer {
          0% { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
      `}</style>

      <div style={{ marginTop: 18 }}>
        <Link to="/catalog" style={{ color: "#6366f1", fontWeight: 700, textDecoration: "none" }}>
          ← Continue shopping
        </Link>
      </div>
    </div>
  );
}
