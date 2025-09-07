// src/pages/ProductEdit.jsx
import { useEffect, useState, useMemo } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { fetchWithAuth } from "../utils/auth.js";
import { BRAND } from "../config.js";

const PRODUCT_CATEGORIES = [
  "SMARTPHONES","LAPTOPS","TABLETS","DESKTOPS","PC_COMPONENTS","MONITORS",
  "PRINTERS_SCANNERS","STORAGE","NETWORKING","PERIPHERALS_ACCESSORIES",
  "AUDIO_HEADPHONES","AUDIO_SPEAKERS","CAMERAS","GAMING_CONSOLES",
  "GAMING_ACCESSORIES","TV_HOME_THEATER","SMART_HOME","WEARABLES","DRONES",
  "SMALL_APPLIANCES","ELECTRIC_MOBILITY","SOFTWARE",
];

const MAX_FILE = 8 * 1024 * 1024; // 8MB

export default function ProductEdit() {
  const { productId } = useParams();
  const { state } = useLocation();
  const navigate = useNavigate();
  const brandId = state?.brandId;

  const [loading, setLoading] = useState(true);
  const [current, setCurrent] = useState(null);

  const [form, setForm] = useState({
    name: "",
    slug: "",
    description: "",
    price: "",
    currency: "USD",
    category: PRODUCT_CATEGORIES[0],
    status: "ACTIVE",
    deletePhotoIds: [],
  });

  const [newPhotos, setNewPhotos] = useState([]);

  const buildPhotoSrc = (photoId) =>
    `${BRAND.BASE}/brands/${brandId}/products/${current?.id}/photos/${photoId}`;

  // Load product + photos
  useEffect(() => {
    (async () => {
      try {
        if (!brandId || !productId) throw new Error("Missing brandId/productId");

        const res = await fetchWithAuth(`${BRAND.BASE}/brands/${brandId}/products`);
        if (!res.ok) throw new Error("Failed to load products");
        const items = await res.json();

        const found = items.find((p) => p.id === productId);
        if (!found) throw new Error("Product not found");

        const photos = Array.isArray(found.photos) ? found.photos : [];
        setCurrent({ ...found, photos });

        setForm((prev) => ({
          ...prev,
          name: found.name ?? "",
          slug: found.slug ?? "",
          description: found.description ?? "",
          price: found.price ?? "",
          currency: found.currency ?? "USD",
          category: found.category ?? PRODUCT_CATEGORIES[0],
          status: found.status ?? "ACTIVE",
          deletePhotoIds: [],
        }));
      } catch (e) {
        console.error(e);
        alert(e.message);
        navigate("/my-brand");
      } finally {
        setLoading(false);
      }
    })();
  }, [brandId, productId, navigate]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleNewFiles = (e) => {
    const files = Array.from(e.target.files);
    const valid = files.filter((f) => {
      if (f.size > MAX_FILE) {
        alert(`${f.name} is too large (max 8MB).`);
        return false;
      }
      return true;
    });
    setNewPhotos(valid);
  };

  const removeNewPhoto = (idx) => {
    setNewPhotos((prev) => prev.filter((_, i) => i !== idx));
  };

  const toggleDeletePhoto = (photoId) => {
    setForm((prev) => {
      const exists = prev.deletePhotoIds.includes(photoId);
      const next = exists
        ? prev.deletePhotoIds.filter((id) => id !== photoId)
        : [...prev.deletePhotoIds, photoId];
      return { ...prev, deletePhotoIds: next };
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!brandId || !productId) {
      alert("Missing brandId/productId");
      return;
    }

    try {
      const payload = {
        name: form.name || null,
        slug: form.slug || null,
        description: form.description || null,
        price: form.price === "" ? null : String(form.price),
        currency: form.currency || null,
        status: form.status || null,
        category: form.category || null,
        deletePhotoIds: form.deletePhotoIds?.length ? form.deletePhotoIds : null,
      };

      const fd = new FormData();
      fd.append("product", new Blob([JSON.stringify(payload)], { type: "application/json" }));
      newPhotos.forEach((file) => fd.append("newPhotos", file));

      const res = await fetchWithAuth(
        `${BRAND.BASE}/brands/${brandId}/products/${productId}`,
        { method: "PUT", body: fd }
      );

      if (!res.ok) {
        const txt = await res.text().catch(() => "");
        throw new Error(`Update failed: ${res.status} ${txt}`);
      }

      await res.json();
      navigate("/my-brand");
    } catch (err) {
      console.error(err);
      alert(err.message);
    }
  };

  const containerStyle = useMemo(
    () => ({
      paddingBlock: 24,
      paddingInline: "clamp(16px, 6vw, 140px)",
    }),
    []
  );

  if (loading) return <div style={{ padding: 24 }}>Loading…</div>;
  if (!current) return null;

  return (
    <div style={containerStyle}>
      <h2 style={{ margin: 0, marginBottom: 12 }}>Edit Product</h2>

      <form onSubmit={handleSubmit} style={{ display: "grid", gap: 16, maxWidth: 1000 }}>
        <div style={{ display: "grid", gap: 16, gridTemplateColumns: "1.1fr 1fr" }}>
          {/* Left: form fields */}
          <div style={{ display: "grid", gap: 10 }}>
            <input
              name="name"
              value={form.name}
              onChange={handleChange}
              placeholder="Name"
              required
              style={{ padding: 10, borderRadius: 8, border: "1px solid #e5e7eb" }}
            />
            <input
              name="slug"
              value={form.slug}
              onChange={handleChange}
              placeholder="Slug"
              required
              style={{ padding: 10, borderRadius: 8, border: "1px solid #e5e7eb" }}
            />
            <textarea
              name="description"
              value={form.description}
              onChange={handleChange}
              placeholder="Description"
              rows={6}
              style={{ padding: 10, borderRadius: 8, border: "1px solid #e5e7eb", resize: "vertical" }}
            />
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <input
                name="price"
                type="number"
                step="0.01"
                value={form.price}
                onChange={handleChange}
                placeholder="Price"
                style={{ padding: 10, borderRadius: 8, border: "1px solid #e5e7eb" }}
              />
              <input
                name="currency"
                value={form.currency}
                onChange={handleChange}
                placeholder="Currency"
                style={{ padding: 10, borderRadius: 8, border: "1px solid #e5e7eb" }}
              />
            </div>

            <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ color: "#334155" }}>Category:</span>
              <select
                name="category"
                value={form.category}
                onChange={handleChange}
                style={{ padding: "8px 10px", borderRadius: 8, border: "1px solid #e5e7eb", background: "#fff" }}
              >
                {PRODUCT_CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c.replace(/_/g, " ")}
                  </option>
                ))}
              </select>
            </label>

            <div style={{ display: "grid", gap: 8 }}>
              <span style={{ color: "#334155", fontWeight: 600 }}>Add new photos:</span>
              <label
                style={{
                  display: "inline-block",
                  padding: "10px 16px",
                  borderRadius: 8,
                  border: "1px solid #c7d2fe",
                  background: "#eef2ff",
                  color: "#4f46e5",
                  fontWeight: 600,
                  cursor: "pointer",
                  width: "fit-content",
                }}
              >
                Choose files
                <input type="file" multiple onChange={handleNewFiles} style={{ display: "none" }} />
              </label>

              {newPhotos.length > 0 && (
                <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                  {newPhotos.map((f, i) => (
                    <div
                      key={`${f.name}-${i}`}
                      style={{ width: 96, textAlign: "center", fontSize: 12, color: "#334155" }}
                    >
                      <img
                        src={URL.createObjectURL(f)}
                        alt={f.name}
                        style={{
                          width: 96,
                          height: 96,
                          objectFit: "cover",
                          borderRadius: 8,
                          border: "1px solid #e5e7eb",
                        }}
                      />
                      <div style={{ marginTop: 6 }}>
                        <button
                          type="button"
                          onClick={() => removeNewPhoto(i)}
                          style={{
                            padding: "4px 8px",
                            borderRadius: 8,
                            border: "1px solid #fecaca",
                            background: "#ffe4e6",
                            color: "#991b1b",
                            cursor: "pointer",
                          }}
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Right: photos manager */}
          <div
            style={{
              border: "1px solid #e5e7eb",
              borderRadius: 10,
              padding: 12,
              background: "#fff",
              minHeight: 200,
            }}
          >
            <div style={{ fontWeight: 700, marginBottom: 10, color: "#0f172a" }}>Existing photos</div>

            {!current.photos || current.photos.length === 0 ? (
              <div
                style={{
                  height: 160,
                  display: "grid",
                  placeItems: "center",
                  color: "#94a3b8",
                  background: "#f8fafc",
                  borderRadius: 8,
                }}
              >
                No photos
              </div>
            ) : (
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fill, minmax(130px, 1fr))",
                  gap: 12,
                }}
              >
                {current.photos.map((ph) => {
                  const isMarkedDelete = form.deletePhotoIds.includes(ph.id);

                  return (
                    <div
                      key={ph.id}
                      style={{
                        border: "1px solid #e5e7eb",
                        borderRadius: 10,
                        padding: 8,
                        background: isMarkedDelete ? "#fff1f2" : "#ffffff",
                        opacity: isMarkedDelete ? 0.7 : 1,
                        display: "grid",
                        gap: 6,
                        justifyItems: "center",
                      }}
                    >
                      <img
                        src={buildPhotoSrc(ph.id)}
                        alt={ph.filename}
                        style={{
                          width: 120,
                          height: 120,
                          objectFit: "cover",
                          borderRadius: 8,
                          border: "1px solid #e5e7eb",
                        }}
                      />

                      <label
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 6,
                          fontSize: 13,
                          color: "#334155",
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={isMarkedDelete}
                          onChange={() => toggleDeletePhoto(ph.id)}
                        />
                        Delete
                      </label>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
          <button
            type="button"
            onClick={() => navigate("/my-brand")}
            style={{
              padding: "10px 14px",
              borderRadius: 8,
              border: "1px solid #e5e7eb",
              background: "#ffffff",
              color: "#334155",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Cancel
          </button>
          <button
            type="submit"
            style={{
              padding: "10px 14px",
              borderRadius: 8,
              border: "1px solid #c7d2fe",
              background: "#6366f1",
              color: "#fff",
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            Save changes
          </button>
        </div>
      </form>
    </div>
  );
}
