// src/pages/ProductDetails.jsx
import { useEffect, useMemo, useState, useCallback } from "react";
import { useParams } from "react-router-dom";
import { STORE_API_BASE } from "../config";

function isUuid(v = "") {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
}
const abs = (url) => (url?.startsWith("http") ? url : url ? `${STORE_API_BASE}${url}` : null);

export default function ProductDetails() {
  // ✅ Route is /p/:id, not :productId
  const { id: idOrSlug } = useParams();

  const [p, setP] = useState(null);
  const [err, setErr] = useState("");
  const [activeIdx, setActiveIdx] = useState(0);
  const photos = useMemo(() => p?.photos ?? [], [p]);

  const fetchProduct = useCallback(async () => {
    setErr("");
    setP(null);

    try {
      let res;
      if (isUuid(idOrSlug)) {
        res = await fetch(`${STORE_API_BASE}/products/${idOrSlug}`);
        if (res.ok) {
          setP(await res.json());
          setActiveIdx(0);
          return;
        }
      }
      // fallback by slug
      res = await fetch(`${STORE_API_BASE}/products/slug/${encodeURIComponent(idOrSlug)}`);
      if (!res.ok) throw new Error("Not found");
      setP(await res.json());
      setActiveIdx(0);
    } catch {
      setErr("Product not found");
    }
  }, [idOrSlug]);

  useEffect(() => {
    fetchProduct();
  }, [fetchProduct]);

  const addToCart = () => {
    if (!p) return;
    const key = "cart";
    const cart = JSON.parse(localStorage.getItem(key) || "[]");
    const idx = cart.findIndex((it) => it.id === p.id);
    if (idx >= 0) cart[idx].qty += 1;
    else
      cart.push({
        id: p.id,
        name: p.name,
        price: p.price,
        currency: p.currency || "RON",
        cover: photos[0]?.url ? abs(photos[0].url) : null,
        qty: 1,
      });
    localStorage.setItem(key, JSON.stringify(cart));
    window.dispatchEvent(new CustomEvent("cartChange"));
  };

  if (err) return <div style={{ padding: 24 }}>{err}</div>;
  if (!p) return <div style={{ padding: 24 }}>Loading…</div>;

  const mainImg = photos[activeIdx]?.url ? abs(photos[activeIdx].url) : null;

  return (
    <div
      style={{
        maxWidth: 1200,
        margin: "0 auto",
        padding: 24,
        display: "grid",
        gridTemplateColumns: "minmax(360px, 1.1fr) 1fr",
        gap: 24,
      }}
    >
      {/* Gallery */}
      <div>
        <div
          style={{
            border: "1px solid #e5e7eb",
            borderRadius: 14,
            overflow: "hidden",
            background: "#fff",
            height: 560,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            position: "relative",
          }}
        >
          {mainImg ? (
            <img
              key={mainImg}
              src={mainImg}
              alt={p.name}
              style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain", display: "block" }}
            />
          ) : (
            <div style={{ color: "#6b7280" }}>No image</div>
          )}
        </div>

        {photos.length > 1 && (
          <div
            style={{
              marginTop: 10,
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(72px, 1fr))",
              gap: 8,
            }}
          >
            {photos.map((ph, i) => {
              const url = abs(ph.url);
              const active = i === activeIdx;
              return (
                <button
                  key={ph.id || i}
                  onClick={() => setActiveIdx(i)}
                  style={{
                    height: 72,
                    borderRadius: 10,
                    overflow: "hidden",
                    border: active ? "2px solid #6366f1" : "1px solid #e5e7eb",
                    padding: 0,
                    cursor: "pointer",
                    background: "#fff",
                  }}
                >
                  {url ? (
                    <img
                      src={url}
                      alt={ph.filename || `photo-${i + 1}`}
                      loading="lazy"
                      style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
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
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Info panel */}
      <div style={{ display: "grid", gap: 16 }}>
        <h1 style={{ margin: 0, fontSize: 28, lineHeight: 1.2 }}>{p.name}</h1>
        {p.slug && (
          <div style={{ color: "#6b7280", fontSize: 13, userSelect: "text" }}>
            slug: <code>{p.slug}</code>
          </div>
        )}
        <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
          <div style={{ fontSize: 28, fontWeight: 800, color: "#111827" }}>
            {p.price} {p.currency || "RON"}
          </div>
        </div>
        {p.description && (
          <div style={{ marginTop: 8, color: "#374151", lineHeight: 1.6, whiteSpace: "pre-wrap" }}>
            {p.description}
          </div>
        )}
        <div style={{ display: "flex", gap: 12, marginTop: 8 }}>
          <button
            onClick={addToCart}
            style={{
              padding: "12px 18px",
              borderRadius: 10,
              border: "1px solid #6366f1",
              background: "#6366f1",
              color: "#fff",
              fontWeight: 800,
              cursor: "pointer",
            }}
          >
            Add to cart
          </button>
        </div>

        <div
          style={{
            marginTop: 12,
            padding: 12,
            border: "1px solid #e5e7eb",
            borderRadius: 10,
            background: "#fafafa",
            color: "#4b5563",
            fontSize: 14,
            display: "grid",
            gap: 6,
          }}
        >
          <div>
            Category: <b>{String(p.category || "").replace(/_/g, " ")}</b>
          </div>
          {p.brandName && (
            <div>
              Brand: <b>{p.brandName}</b>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
