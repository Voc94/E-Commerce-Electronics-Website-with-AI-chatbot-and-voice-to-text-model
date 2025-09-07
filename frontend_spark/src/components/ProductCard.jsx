// src/components/ProductCard.jsx
import { Link } from "react-router-dom";
import { getCoverPhotoUrl } from "../utils/products";

export default function ProductCard({ product }) {
  const cover = getCoverPhotoUrl(product);

  return (
    <Link
      to={`/p/${product.id}`}        // ✅ click-through to details page
      style={{ textDecoration: "none", color: "inherit" }}
    >
      <div
        style={{
          border: "1px solid #e5e7eb",
          borderRadius: 10,
          overflow: "hidden",
          background: "#fff",
          display: "flex",
          flexDirection: "column",
          height: "100%",
          boxShadow: "0 2px 6px rgba(0,0,0,0.05)",
          transition: "transform .15s ease",
        }}
        onMouseEnter={(e) => (e.currentTarget.style.transform = "scale(1.02)")}
        onMouseLeave={(e) => (e.currentTarget.style.transform = "scale(1)")}
      >
        <div style={{ width: "100%", aspectRatio: "4 / 3", background: "#f3f4f6", position: "relative" }}>
          {cover ? (
            <img
              src={cover}
              alt={product.name}
              loading="lazy"
              style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }}
            />
          ) : (
            <div
              style={{
                position: "absolute",
                inset: 0,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#6b7280",
                fontSize: 12,
              }}
            >
              No image
            </div>
          )}
        </div>

        <div style={{ padding: 12, display: "grid", gap: 8, flex: 1 }}>
          <div
            title={product.name}
            style={{
              fontWeight: 700,
              fontSize: 14,
              lineHeight: 1.3,
              display: "-webkit-box",
              WebkitLineClamp: 2,
              WebkitBoxOrient: "vertical",
              overflow: "hidden",
              minHeight: "2.6em",
            }}
          >
            {product.name}
          </div>
          <div style={{ color: "#374151", fontWeight: 700, marginTop: "auto" }}>
            {product.price} RON
          </div>
        </div>
      </div>
    </Link>
  );
}
