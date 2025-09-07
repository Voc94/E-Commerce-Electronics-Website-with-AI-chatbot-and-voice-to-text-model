// src/pages/BrandSeller.jsx
import { useEffect, useMemo, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { fetchWithAuth, isAuthenticated } from "../utils/auth.js";
import { BRAND_REQUESTS, BRAND } from "../config.js";

const clamp = (n, min, max) => Math.max(min, Math.min(max, n));

function BrandAvatar({ slug, requestId }) {
  const [broken, setBroken] = useState(false);
  const letter = (slug || "?").charAt(0).toUpperCase();

  const src = useMemo(() => {
    if (!requestId) return null;
    const t = Date.now();
    return `${BRAND_REQUESTS.LOGO_GET(requestId)}?t=${t}`;
  }, [requestId]);

  if (src && !broken) {
    return (
      <img
        src={src}
        alt={`${slug} logo`}
        onError={() => setBroken(true)}
        style={{
          width: 48,
          height: 48,
          objectFit: "contain",
          borderRadius: 12,
          background: "#f8fafc",
          border: "1px solid #e5e7eb",
        }}
      />
    );
  }

  return (
    <div
      style={{
        width: 48,
        height: 48,
        borderRadius: "50%",
        display: "grid",
        placeItems: "center",
        fontWeight: 700,
        fontSize: 18,
        color: "#4f46e5",
        background: "#eef2ff",
        border: "1px solid #c7d2fe",
      }}
    >
      {letter}
    </div>
  );
}

function BrandHeader({ brand, requestId, onCreate }) {
  if (!brand) return null;

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        marginBottom: 20,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <BrandAvatar slug={brand.slug} requestId={requestId} />
        <div>
          <div style={{ fontSize: 18, fontWeight: 700 }}>{brand.name}</div>
          <div style={{ color: "#64748b", fontSize: 13 }}>slug: {brand.slug}</div>
        </div>
      </div>

      <button
        type="button"
        onClick={onCreate}
        style={{
          padding: "8px 14px",
          borderRadius: 8,
          border: "1px solid #c7d2fe",
          background: "#6366f1",
          color: "#fff",
          fontWeight: 600,
          cursor: "pointer",
        }}
      >
        + Create Product
      </button>
    </div>
  );
}

function Carousel({ photos = [], buildSrc, alt }) {
  const [idx, setIdx] = useState(0);

  const total = photos.length;
  const safeIdx = total > 0 ? clamp(idx, 0, total - 1) : 0;

  useEffect(() => {
    if (idx !== safeIdx) setIdx(safeIdx);
  }, [total, idx, safeIdx]);

  const prev = useCallback(() => {
    if (total === 0) return;
    setIdx((i) => (i - 1 + total) % total);
  }, [total]);

  const next = useCallback(() => {
    if (total === 0) return;
    setIdx((i) => (i + 1) % total);
  }, [total]);

  if (total === 0) {
    return (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "grid",
          placeItems: "center",
          color: "#94a3b8",
          fontSize: 12,
          background: "#f8fafc",
        }}
      >
        No image
      </div>
    );
  }

  const current = photos[safeIdx];
  const src = buildSrc(current);

  const navBtnStyle = {
    position: "absolute",
    top: "50%",
    transform: "translateY(-50%)",
    width: 50,
    height: 35,
    borderRadius: "9999px",
    border: "1px solid #e5e7eb",
    background: "rgba(255,255,255,0.9)",
    display: "grid",
    placeItems: "center",
    cursor: "pointer",
    color: "#334155", // ensure arrow visible
  };

  return (
    <div style={{ position: "relative", width: "100%", height: "100%" }}>
      <img
        src={src}
        alt={alt}
        style={{ width: "100%", height: "100%", objectFit: "cover" }}
        draggable={false}
      />

      {/* Prev */}
      <button
        type="button"
        aria-label="Previous image"
        onClick={prev}
        style={{ ...navBtnStyle, left: 6 }}
      >
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
          <path
            d="M10 12L6 8l4-4"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>

      {/* Next */}
      <button
        type="button"
        aria-label="Next image"
        onClick={next}
        style={{ ...navBtnStyle, right: 6 }}
      >
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
          <path
            d="M6 4l4 4-4 4"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>

      {/* Counter */}
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          bottom: 6,
          display: "flex",
          justifyContent: "center",
          fontSize: 11,
          fontWeight: 600,
          color: "#0f172a",
        }}
      >
        {safeIdx + 1} / {total}
      </div>
    </div>
  );
}

function ProductCard({ brandId, product, onEdit, onDelete }) {
  const buildSrc = (photo) =>
    `${BRAND.BASE}/brands/${brandId}/products/${product.id}/photos/${photo.id}`;

  return (
    <div
      style={{
        border: "1px solid #e5e7eb",
        borderRadius: 10,
        overflow: "hidden",
        background: "#fff",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <div style={{ aspectRatio: "1 / 1", background: "#f8fafc" }}>
        <Carousel photos={product.photos || []} buildSrc={buildSrc} alt={product.name} />
      </div>

      <div style={{ padding: 10, display: "grid", gap: 4 }}>
        <div style={{ fontWeight: 600, fontSize: 14 }}>{product.name}</div>
        {product.price != null && (
          <div style={{ color: "#334155", fontSize: 13 }}>
            {Intl.NumberFormat().format(product.price)} / {product.currency || "USD"}
          </div>
        )}

        <div style={{ display: "flex", gap: 6, marginTop: 6 }}>
          <button
            type="button"
            onClick={onEdit}
            style={{
              flex: 1,
              padding: "6px 8px",
              borderRadius: 6,
              border: "1px solid #c7d2fe",
              background: "#eef2ff",
              color: "#4f46e5",
              fontSize: 13,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Edit
          </button>

          <button
            type="button"
            onClick={onDelete}
            style={{
              flex: 1,
              padding: "6px 8px",
              borderRadius: 6,
              border: "1px solid #fecaca",
              background: "#ffe4e6",
              color: "#991b1b",
              fontSize: 13,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}

export default function BrandSeller() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [myReq, setMyReq] = useState(null);
  const [brand, setBrand] = useState(null);
  const [products, setProducts] = useState([]);

  useEffect(() => {
    if (!isAuthenticated()) {
      navigate("/login");
      return;
    }

    (async () => {
      try {
        const r1 = await fetchWithAuth(BRAND_REQUESTS.MINE());
        if (!r1.ok) throw new Error("Failed to load your brand request");
        const reqJson = await r1.json();
        setMyReq(reqJson);

        if (reqJson.status !== "APPROVED" || !reqJson.slug) {
          setLoading(false);
          return;
        }

        const r2 = await fetchWithAuth(
          `${BRAND.BASE}/brands/slug/${encodeURIComponent(reqJson.slug)}`
        );
        if (!r2.ok) throw new Error("Failed to load brand by slug");
        const brandJson = await r2.json();
        setBrand(brandJson);

        const r3 = await fetchWithAuth(`${BRAND.BASE}/brands/${brandJson.id}/products`);
        if (!r3.ok) throw new Error("Failed to load products");
        const prods = await r3.json();
        setProducts(prods);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    })();
  }, [navigate]);

  const handleDelete = async (productId) => {
    if (!brand?.id) return;
    if (!window.confirm("Delete this product? This cannot be undone.")) return;

    try {
      const res = await fetchWithAuth(
        `${BRAND.BASE}/brands/${brand.id}/products/${productId}`,
        { method: "DELETE" }
      );
      if (!res.ok) throw new Error("Delete failed");
      setProducts((prev) => prev.filter((p) => p.id !== productId));
    } catch (e) {
      alert("Failed to delete product.");
      console.error(e);
    }
  };

  const gotoEdit = (productId) => {
    navigate(`/my-brand/products/${productId}/edit`, { state: { brandId: brand?.id } });
  };

  const gotoCreate = () => {
    navigate(`/my-brand/products/create`, { state: { brandId: brand?.id } });
  };

  if (loading) return <div style={{ padding: 20 }}>Loading…</div>;

  if (!myReq || myReq.status !== "APPROVED") {
    return (
      <div style={{ padding: 20 }}>
        <h2 style={{ margin: 0, marginBottom: 10 }}>My Brand</h2>
        <p>Your brand request is not approved yet.</p>
      </div>
    );
  }

  return (
    <div style={{ paddingBlock: 20, paddingInline: "clamp(12px, 6vw, 200px)" }}>
      <BrandHeader brand={brand} requestId={myReq.id} onCreate={gotoCreate} />

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
          gap: 14,
        }}
      >
        {products.map((p) => (
          <ProductCard
            key={p.id}
            brandId={brand.id}
            product={p}
            onEdit={() => gotoEdit(p.id)}
            onDelete={() => handleDelete(p.id)}
          />
        ))}
      </div>
    </div>
  );
}
