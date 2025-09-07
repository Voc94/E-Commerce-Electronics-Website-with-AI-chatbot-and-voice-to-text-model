// src/pages/Dashboard.jsx
import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { STORE_API_BASE } from "../config";

function abs(url) {
  if (!url) return null;
  return url.startsWith("http") ? url : `${STORE_API_BASE}${url}`;
}

function pickCover(photos = []) {
  if (!Array.isArray(photos) || photos.length === 0) return null;
  const primary = photos.find((p) => p.primary);
  const chosen = primary || photos[0];
  return abs(chosen?.url);
}

function productLink(p) {
  return `/p/${p.slug || p.id}`;
}

export default function Dashboard() {
  const [hero, setHero] = useState(null);
  const [recs, setRecs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  const load = useCallback(async (signal) => {
    try {
      setLoading(true);
      setErr("");

      const [r1, r5] = await Promise.all([
        fetch(`${STORE_API_BASE}/products/random`, { signal }),
        fetch(`${STORE_API_BASE}/products/random5`, { signal }),
      ]);

      if (!r1.ok) throw new Error("Failed to load a recommendation");
      if (!r5.ok) throw new Error("Failed to load more recommendations");

      const [heroItem, list] = await Promise.all([r1.json(), r5.json()]);

      const filtered = Array.isArray(list)
        ? list.filter((p) => p?.id !== heroItem?.id).slice(0, 5)
        : [];

      setHero(heroItem ?? null);
      setRecs(filtered);
    } catch (e) {
      if (e?.name === "AbortError") return; // ignore StrictMode aborts
      setErr(e?.message || "Failed to load recommendations");
      setHero(null);
      setRecs([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    document.title = "Dashboard - Spark";
    const ac = new AbortController();
    load(ac.signal);
    return () => ac.abort(); // dev StrictMode: abort first mount’s fetch
  }, [load]);

  const heroImg = useMemo(() => pickCover(hero?.photos), [hero]);
  const tiles = useMemo(
    () => (Array.isArray(recs) ? recs.map((p) => ({ ...p, cover: pickCover(p.photos) })) : []),
    [recs]
  );

  return (
    <div style={{ width: "80%", maxWidth: 1200, margin: "0 auto", padding: 24 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h2 style={{ margin: 0 }}>Welcome back 👋</h2>
        <button
          onClick={() => {
            const ac = new AbortController();
            load(ac.signal);
            // no need to keep a ref; this is a one-off action
          }}
          style={{
            padding: "8px 12px",
            borderRadius: 8,
            border: "1px solid #e5e7eb",
            background: "#fff",
            color: "#000",
            cursor: "pointer",
            fontWeight: 700,
          }}
          aria-label="Refresh recommendations"
        >
          Refresh
        </button>
      </div>

      {loading && (
        <div style={{ marginTop: 16, display: "grid", gap: 16 }}>
          <div
            style={{
              height: 220,
              borderRadius: 16,
              background:
                "linear-gradient(90deg, rgba(99,102,241,.2), rgba(99,102,241,.6), rgba(99,102,241,.2))",
              backgroundSize: "200% 100%",
              animation: "shimmer 1s linear infinite",
            }}
          />
          <div
            style={{
              height: 140,
              borderRadius: 12,
              background:
                "linear-gradient(90deg, rgba(99,102,241,.2), rgba(99,102,241,.6), rgba(99,102,241,.2))",
              backgroundSize: "200% 100%",
              animation: "shimmer 1s linear infinite",
            }}
          />
        </div>
      )}

      {!loading && err && (
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
          {err}
        </div>
      )}

      {/* BIG recommendation (smaller) */}
      {!loading && hero && (
        <Link
          to={productLink(hero)}
          style={{
            display: "grid",
            gridTemplateColumns: "0.3fr 0.8fr",
            gap: 16,
            marginTop: 16,
            textDecoration: "none",
            color: "inherit",
            border: "1px solid #e5e7eb",
            background: "#fff",
            borderRadius: 16,
            overflow: "hidden",
            boxShadow: "0 8px 26px rgba(0,0,0,0.06)",
          }}
        >
          <div
            style={{
              position: "relative",
              minHeight: 200,
              background: "#f3f4f6",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            {heroImg ? (
              <img
                src={heroImg}
                alt={hero.name}
                style={{ width: "100%", height: "100%", objectFit: "cover" }}
                loading="eager"
              />
            ) : (
              <span style={{ color: "#9ca3af" }}>No image</span>
            )}
            <div
              style={{
                position: "absolute",
                inset: 0,
                background: "linear-gradient(0deg, rgba(0,0,0,0.35), rgba(0,0,0,0.0))",
              }}
            />
            <div style={{ position: "absolute", bottom: 12, left: 12, right: 12, color: "#fff" }}>
              <div style={{ fontSize: 12, opacity: 0.9, marginBottom: 2 }}>Today’s pick</div>
              <div style={{ fontSize: 20, fontWeight: 800, lineHeight: 1.25 }}>{hero.name}</div>
            </div>
          </div>

          <div style={{ padding: 14, display: "grid", alignContent: "space-between" }}>
            <div>
              <div
                style={{
                  color: "#6b7280",
                  fontSize: 12,
                  marginBottom: 6,
                  textTransform: "capitalize",
                }}
              >
                {String(hero.category || "").replace(/_/g, " ").toLowerCase()}
              </div>
              <div style={{ fontWeight: 900, fontSize: 24, marginBottom: 8, color: "#111827" }}>
                {hero.price} {hero.currency || "RON"}
              </div>
              <p
                style={{
                  color: "#374151",
                  fontSize: 14,
                  lineHeight: 1.6,
                  margin: 0,
                  display: "-webkit-box",
                  WebkitLineClamp: 4,
                  WebkitBoxOrient: "vertical",
                  overflow: "hidden",
                }}
                title={hero.description || ""}
              >
                {hero.description || "No description provided."}
              </p>
            </div>

            <div style={{ display: "flex", gap: 10, marginTop: 10 }}>
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  padding: "10px 12px",
                  borderRadius: 10,
                  border: "1px solid #6366f1",
                  background: "#6366f1",
                  color: "#fff",
                  fontWeight: 800,
                  fontSize: 14,
                }}
              >
                View product →
              </span>
            </div>
          </div>
        </Link>
      )}

      {/* 5 small recommendations */}
      {!loading && tiles.length > 0 && (
        <div style={{ marginTop: 18 }}>
          <div style={{ fontWeight: 800, marginBottom: 10 }}>You might also like</div>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
              gap: 14,
            }}
          >
            {tiles.map((p) => (
              <Link
                key={p.id}
                to={productLink(p)}
                style={{
                  display: "grid",
                  gridTemplateRows: "140px auto",
                  textDecoration: "none",
                  border: "1px solid #e5e7eb",
                  background: "#fff",
                  borderRadius: 12,
                  overflow: "hidden",
                  boxShadow: "0 4px 14px rgba(0,0,0,0.05)",
                }}
                title={p.name}
              >
                <div
                  style={{
                    background: "#f3f4f6",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  {p.cover ? (
                    <img
                      src={p.cover}
                      alt={p.name}
                      style={{ width: "100%", height: "100%", objectFit: "cover" }}
                      loading="lazy"
                    />
                  ) : (
                    <span style={{ color: "#9ca3af", fontSize: 12 }}>No image</span>
                  )}
                </div>
                <div style={{ padding: 10, display: "grid", gap: 6 }}>
                  <div
                    style={{
                      fontWeight: 700,
                      fontSize: 14,
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      color: "#111827",
                    }}
                  >
                    {p.name}
                  </div>
                  <div style={{ color: "#6b7280", fontSize: 12 }}>
                    {String(p.category || "").replace(/_/g, " ").toLowerCase()}
                  </div>
                  <div style={{ fontWeight: 800, fontSize: 14 }}>
                    {p.price} {p.currency || "RON"}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      <style>{`
        @keyframes shimmer {
          0% { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
      `}</style>
    </div>
  );
}
