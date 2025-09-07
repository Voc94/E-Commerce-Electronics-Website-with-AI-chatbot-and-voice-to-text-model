// src/pages/Catalog.jsx
import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import ProductCard from "../components/ProductCard";
import { STORE_API_BASE } from "../config";

const CATEGORIES = [
  "SMARTPHONES","LAPTOPS","TABLETS","DESKTOPS","PC_COMPONENTS","MONITORS",
  "PRINTERS_SCANNERS","STORAGE","NETWORKING","PERIPHERALS_ACCESSORIES",
  "AUDIO_HEADPHONES","AUDIO_SPEAKERS","CAMERAS","GAMING_CONSOLES","GAMING_ACCESSORIES",
  "TV_HOME_THEATER","SMART_HOME","WEARABLES","DRONES","SMALL_APPLIANCES",
  "ELECTRIC_MOBILITY","SOFTWARE"
];

const PAGE_SIZE = 24;
const RON_MIN = 0;
const RON_MAX = 5000;

/* === tiny inline chevron icons (inherit currentColor) === */
const ChevronLeft = ({ size = 16, style }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    aria-hidden="true"
    focusable="false"
    style={{ display: "block", ...style }}
  >
    <path d="M15.41 7.41 14 6l-6 6 6 6 1.41-1.41L10.83 12z" fill="currentColor" />
  </svg>
);

const ChevronRight = ({ size = 16, style }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    aria-hidden="true"
    focusable="false"
    style={{ display: "block", ...style }}
  >
    <path d="m8.59 16.59 1.41 1.41 6-6-6-6-1.41 1.41L13.17 12z" fill="currentColor" />
  </svg>
);

export default function Catalog() {
  const location = useLocation();
  const navigate = useNavigate();

  const params = useMemo(() => new URLSearchParams(location.search), [location.search]);
  const initialQuery = params.get("query") || "";
  const initialCategory = params.get("category") || "";
  const initialMin = params.get("minPrice") || String(RON_MIN);
  const initialMax = params.get("maxPrice") || String(RON_MAX);
  const initialPage = parseInt(params.get("page") || "0", 10) || 0;

  const [q, setQ] = useState(initialQuery);
  const [category, setCategory] = useState(initialCategory);
  const [minPrice, setMinPrice] = useState(initialMin);
  const [maxPrice, setMaxPrice] = useState(initialMax);
  const [page, setPage] = useState(initialPage);

  const [items, setItems] = useState([]);
  const [hasNext, setHasNext] = useState(false);
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState("");

  const buildParams = (pageArg, opts = {}) => {
    const p = new URLSearchParams();
    const nextQ = "q" in opts ? opts.q : q;
    const nextC = "category" in opts ? opts.category : category;
    const nextMin = "minPrice" in opts ? opts.minPrice : minPrice;
    const nextMax = "maxPrice" in opts ? opts.maxPrice : maxPrice;

    if (nextQ.trim()) p.set("query", nextQ.trim());
    if (nextC) p.set("category", nextC);
    if (nextMin !== "") p.set("minPrice", nextMin);
    if (nextMax !== "") p.set("maxPrice", nextMax);
    p.set("page", String(Math.max(0, pageArg)));
    p.set("size", String(PAGE_SIZE));
    return p;
  };

  const fetchList = async (paramsObj) => {
    const url = `${STORE_API_BASE}/products/search?${paramsObj.toString()}`;
    const res = await fetch(url);
    return res.ok ? await res.json() : [];
  };

  const fetchData = async (pageArg = 0, opts = {}, { pushUrl = true } = {}) => {
    const p = buildParams(pageArg, opts);
    setLoading(true);
    const data = await fetchList(p);
    setLoading(false);

    if (pushUrl) navigate(`/catalog?${p.toString()}`, { replace: true });

    setItems(data);
    setHasNext(Array.isArray(data) && data.length === PAGE_SIZE);
    setNotice(!loading && data.length === 0 ? "No products found with the current filters." : "");
    return { data, params: p };
  };

  // Sync with URL (navbar search etc.)
  useEffect(() => {
    const qp = new URLSearchParams(location.search);
    const nq = qp.get("query") || "";
    const nc = qp.get("category") || "";
    const nmin = qp.get("minPrice") || String(RON_MIN);
    const nmax = qp.get("maxPrice") || String(RON_MAX);
    const np = parseInt(qp.get("page") || "0", 10) || 0;

    setQ(nq);
    setCategory(nc);
    setMinPrice(nmin);
    setMaxPrice(nmax);
    setPage(np);

    (async () => {
      const p = new URLSearchParams(qp);
      if (!p.get("size")) p.set("size", String(PAGE_SIZE));
      setLoading(true);
      const data = await fetchList(p);
      setLoading(false);
      setItems(data);
      setHasNext(Array.isArray(data) && data.length === PAGE_SIZE);
      setNotice(data.length === 0 ? "No products found with the current filters." : "");
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.search]);

  // Category applies immediately
  const handleCategoryChange = (newCategory) => {
    setCategory(newCategory);
    fetchData(0, { category: newCategory });
  };

  // Price sliders apply immediately; keep min <= max
  const handlePriceChange = (type, raw) => {
    let val = String(Math.max(RON_MIN, Math.min(RON_MAX, Number(raw))));
    if (type === "min") {
      const nextMin = val;
      const nextMax = String(Math.max(Number(nextMin), Number(maxPrice)));
      setMinPrice(nextMin);
      setMaxPrice(nextMax);
      fetchData(0, { minPrice: nextMin, maxPrice: nextMax });
    } else {
      const nextMax = val;
      const nextMin = String(Math.min(Number(minPrice), Number(nextMax)));
      setMaxPrice(nextMax);
      setMinPrice(nextMin);
      fetchData(0, { minPrice: nextMin, maxPrice: nextMax });
    }
  };

  const onNext = async () => {
    const candidatePage = page + 1;
    const p = buildParams(candidatePage);
    setLoading(true);
    const data = await fetchList(p);
    setLoading(false);

    if (data.length === 0) {
      setHasNext(false);
      setNotice("You’ve reached the end.");
      return;
    }
    navigate(`/catalog?${p.toString()}`, { replace: true });
    setItems(data);
    setPage(candidatePage);
    setHasNext(data.length === PAGE_SIZE);
    setNotice("");
  };

  const onPrev = async () => {
    if (page <= 0) return;
    const candidatePage = Math.max(0, page - 1);
    const p = buildParams(candidatePage);
    setLoading(true);
    const data = await fetchList(p);
    setLoading(false);

    navigate(`/catalog?${p.toString()}`, { replace: true });
    setItems(data);
    setPage(candidatePage);
    setHasNext(data.length === PAGE_SIZE);
    setNotice("");
  };

  return (
    <div style={{ display: "flex", gap: 24, maxWidth: 1400, margin: "0 auto", padding: 24 }}>
      {/* SIDEBAR FILTERS */}
      <div
        style={{
          width: 280,
          background: "#fff",
          border: "1px solid #e5e7eb",
          borderRadius: 10,
          padding: 16,
          display: "flex",
          flexDirection: "column",
          gap: 24,
          boxShadow: "0 2px 8px rgba(0,0,0,0.05)",
          height: "fit-content",
          position: "sticky",
          top: 24,
        }}
      >
        <h3 style={{ fontSize: 18, marginBottom: 4, color: "#111827" }}>Filters</h3>

        {/* Category */}
        <div>
          <h4 style={{ fontSize: 14, fontWeight: 700, marginBottom: 10, color: "#111827" }}>
            Category
          </h4>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(2, 1fr)",
              gap: 8,
            }}
          >
            {CATEGORIES.map((c) => {
              const isActive = category === c;
              return (
                <button
                  key={c}
                  onClick={() => handleCategoryChange(c)}
                  style={{
                    padding: "10px 12px",
                    borderRadius: 8,
                    border: isActive ? "2px solid #6366f1" : "1px solid #e5e7eb",
                    background: isActive ? "#eef2ff" : "#fff",
                    cursor: "pointer",
                    textAlign: "left",
                    fontWeight: 600,
                    fontSize: 13,
                    color: isActive ? "#3730a3" : "#111827",
                    transition: "all 0.15s ease-in-out",
                  }}
                  onMouseEnter={(e) => {
                    if (!isActive) {
                      e.currentTarget.style.background = "#f9fafb";
                      e.currentTarget.style.borderColor = "#c7d2fe";
                    }
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = isActive ? "#eef2ff" : "#fff";
                    e.currentTarget.style.borderColor = isActive ? "#6366f1" : "#e5e7eb";
                  }}
                  title={c.replace(/_/g, " ")}
                >
                  {c.replace(/_/g, " ")}
                </button>
              );
            })}
          </div>
        </div>

        {/* Price Range Sliders (RON) */}
        <div style={{ marginTop: 4, width: "100%" }}>
          <h4
            style={{
              fontSize: 14,
              fontWeight: 700,
              marginBottom: 10,
              color: "#111827",
            }}
          >
            Price Range (RON)
          </h4>

          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 12,
              width: "100%",
              boxSizing: "border-box",
            }}
          >
            {/* Min price */}
            <label style={{ fontSize: 12, color: "#374151", fontWeight: 600 }}>
              Min: {minPrice} RON
            </label>
            <input
              type="range"
              min={RON_MIN}
              max={RON_MAX}
              value={minPrice}
              onChange={(e) => handlePriceChange("min", e.target.value)}
              style={{
                width: "100%",
                maxWidth: "100%",
                height: "4px",
                accentColor: "#6366f1",
                cursor: "pointer",
                boxSizing: "border-box",
              }}
            />

            {/* Max price */}
            <label style={{ fontSize: 12, color: "#374151", fontWeight: 600 }}>
              Max: {maxPrice} RON
            </label>
            <input
              type="range"
              min={RON_MIN}
              max={RON_MAX}
              value={maxPrice}
              onChange={(e) => handlePriceChange("max", e.target.value)}
              style={{
                width: "100%",
                maxWidth: "100%",
                height: "4px",
                accentColor: "#6366f1",
                cursor: "pointer",
                boxSizing: "border-box",
              }}
            />
          </div>
        </div>
      </div>

      {/* MAIN PRODUCT GRID */}
      <div style={{ flex: 1 }}>
        <h2 style={{ marginBottom: 16 }}>Catalog</h2>

        {loading && (
          <div
            style={{
              height: 3,
              background:
                "linear-gradient(90deg, rgba(99,102,241,.2), rgba(99,102,241,.6), rgba(99,102,241,.2))",
              backgroundSize: "200% 100%",
              animation: "shimmer 1s linear infinite",
              borderRadius: 2,
              marginBottom: 12,
            }}
          />
        )}

        {!loading && notice && (
          <div
            style={{
              marginBottom: 12,
              padding: "10px 12px",
              borderRadius: 8,
              background: "#f9fafb",
              border: "1px solid #e5e7eb",
              color: "#4b5563",
              fontSize: 14,
            }}
          >
            {notice}
          </div>
        )}

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
            gap: 16,
            alignItems: "stretch",
          }}
        >
          {items.map((p) => (
            <ProductCard key={p.id} product={p} />
          ))}
        </div>

        {/* Pager */}
{(page > 0 || hasNext) && (
  <div
    style={{
      display: "flex",
      gap: 12,
      marginTop: 16,
      alignItems: "center",
    }}
  >
    {page > 0 && (
      <button
        aria-label="Previous page"
        title="Previous page"
        onClick={onPrev}
        style={{
          padding: "10px 14px",
          borderRadius: 8,
          border: "1px solid #e5e7eb",
          background: "#fff",
          color: "#111827",              // ← force dark text
          fontWeight: 700,
          display: "inline-flex",        // ← keeps arrow + text visible
          alignItems: "center",
          gap: 8,
          cursor: "pointer",
        }}
      >
        <span aria-hidden="true">←</span>
        <span>Previous</span>
      </button>
    )}

    <div style={{ color: "#6b7280", fontSize: 14, minWidth: 80, textAlign: "center" }}>
      Page {page + 1}
    </div>

    {hasNext && (
      <button
        aria-label="Next page"
        title="Next page"
        onClick={onNext}
        style={{
          padding: "10px 14px",
          borderRadius: 8,
          border: "1px solid #e5e7eb",
          background: "#fff",
          color: "#111827",              // ← force dark text
          fontWeight: 700,
          display: "inline-flex",
          alignItems: "center",
          gap: 8,
          cursor: "pointer",
        }}
      >
        <span>Next</span>
        <span aria-hidden="true">→</span>
      </button>
    )}
  </div>
)}

        {/* tiny keyframes for the loading shimmer */}
        <style>{`
          @keyframes shimmer {
            0% { background-position: 200% 0; }
            100% { background-position: -200% 0; }
          }
        `}</style>
      </div>
    </div>
  );
}
