// src/pages/BrandOrders.jsx
import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { fetchWithAuth, isAuthenticated, getJwtPayload } from "../utils/auth";
import { API_BASE, STORE_API_BASE } from "../config";

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
function isUuid(v = "") {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
}

/**
 * Resolve the seller's brand using:
 * 1) JWT (brandId|brand_id|bid or brand.id)
 * 2) /auth/me (brandId|brand.id|brand_id)
 * 3) PUBLIC fallback: GET /public/users/{userId}/brand
 */
async function resolveBrandIdAndMeta() {
  // 1) JWT
  const payload = getJwtPayload();
  const jwtBrand =
    payload?.brandId || payload?.brand_id || payload?.bid || payload?.brand?.id;
  if (jwtBrand && isUuid(jwtBrand)) {
    return { brandId: jwtBrand, brandMeta: null };
  }

  // also try to collect a userId for the public fallback
  const jwtUserId = payload?.uid || payload?.id || payload?.sub;

  // 2) /auth/me
  let me = null;
  try {
    const meRes = await fetchWithAuth(`${API_BASE}/auth/me`);
    if (meRes.ok) me = await meRes.json();
  } catch {
    // ignore; we might still succeed via public fallback
  }

  const meBrand =
    me?.brandId || me?.brand_id || me?.brand?.id || me?.brandId?.id;
  if (meBrand && isUuid(meBrand)) {
    const meta =
      me?.brand && me.brand.id && isUuid(me.brand.id) ? me.brand : null;
    return { brandId: meBrand, brandMeta: meta };
  }

  // 3) PUBLIC fallback
  const userId =
    (jwtUserId && isUuid(jwtUserId) ? jwtUserId : null) ||
    (me?.id && isUuid(me.id) ? me.id : null);

  if (!userId) {
    throw new Error("Unable to resolve your user id for brand lookup.");
  }

  const pubRes = await fetchWithAuth(`${STORE_API_BASE}/public/users/${userId}/brand`);
  if (pubRes.status === 200) {
    const b = await pubRes.json(); // { id, name, slug, logoUrl }
    if (b?.id && isUuid(b.id)) {
      return { brandId: b.id, brandMeta: b };
    }
  }
  if (pubRes.status === 204) {
    throw new Error("No brand assigned to your account.");
  }
  if (pubRes.status === 404) {
    throw new Error("User is not a brand seller or not found.");
  }

  const msg = await pubRes.text().catch(() => "");
  throw new Error(msg || `Failed to resolve brand (HTTP ${pubRes.status})`);
}

export default function BrandOrders() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [orders, setOrders] = useState([]);
  const [error, setError] = useState("");
  const [brand, setBrand] = useState(null);

  const load = async () => {
    try {
      setLoading(true);
      setError("");

      // must be logged in
      if (!isAuthenticated()) {
        navigate("/login");
        return;
      }

      // Verify role via /auth/me (don't rely on brand presence here)
      const meRes = await fetchWithAuth(`${API_BASE}/auth/me`);
      if (!meRes.ok) throw new Error("Unable to load profile");
      const me = await meRes.json();

      if (me?.role !== "BRAND_SELLER") {
        // only brand sellers can view brand orders
        navigate("/");
        return;
      }

      // Resolve brand id + meta using JWT → /auth/me → public fallback
      const { brandId, brandMeta } = await resolveBrandIdAndMeta();
      setBrand(brandMeta || { id: brandId });

      // Fetch brand orders (backend endpoint must exist)
      const res = await fetchWithAuth(`${STORE_API_BASE}/orders/brand/${brandId}`);
      if (res.status === 401) {
        navigate("/login");
        return;
      }
      if (!res.ok) {
        const msg = await res.text().catch(() => "");
        throw new Error(msg || `Failed to fetch brand orders (${res.status})`);
      }
      const data = await res.json();
      setOrders(Array.isArray(data) ? data : []);
    } catch (e) {
      setError(e.message || "Failed to fetch brand orders");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    document.title = "Brand Orders - Spark";
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div style={{ maxWidth: 1100, margin: "0 auto", padding: 24 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h1 style={{ margin: 0 }}>
          Brand Orders{brand?.name ? ` — ${brand.name}` : ""}
        </h1>
        <button
          onClick={load}
          style={{
            padding: "8px 12px",
            borderRadius: 8,
            border: "1px solid #e5e7eb",
            background: "#fff",
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
          No orders for your brand yet.
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
            {/* Header */}
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
              <div style={{ color: "#6b7280", fontSize: 13 }}>
                {formatDate(o.createdAt)}
              </div>
            </div>

            {/* Buyer + shipping */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 10,
                fontSize: 14,
                color: "#374151",
              }}
            >
              <div>
                <div style={{ fontWeight: 700 }}>Buyer</div>
                <div>{o.fullName || "(no name)"}{o.email ? ` — ${o.email}` : ""}</div>
              </div>
              <div>
                <div style={{ fontWeight: 700 }}>Ship to</div>
                <div>
                  {o.address}, {o.city}, {o.zip}, {o.country}
                </div>
              </div>
            </div>

            {/* Items */}
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

            {/* Totals */}
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
        <Link to="/my-brand" style={{ color: "#6366f1", fontWeight: 700, textDecoration: "none" }}>
          ← Back to brand dashboard
        </Link>
      </div>
    </div>
  );
}
