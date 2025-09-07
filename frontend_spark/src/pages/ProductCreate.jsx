// src/pages/ProductCreate.jsx
import { useState, useMemo } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { fetchWithAuth } from "../utils/auth.js";
import { BRAND } from "../config.js";

// keep in sync with backend ProductCategory.java
const PRODUCT_CATEGORIES = [
  "SMARTPHONES","LAPTOPS","TABLETS","DESKTOPS","PC_COMPONENTS","MONITORS",
  "PRINTERS_SCANNERS","STORAGE","NETWORKING","PERIPHERALS_ACCESSORIES",
  "AUDIO_HEADPHONES","AUDIO_SPEAKERS","CAMERAS","GAMING_CONSOLES",
  "GAMING_ACCESSORIES","TV_HOME_THEATER","SMART_HOME","WEARABLES","DRONES",
  "SMALL_APPLIANCES","ELECTRIC_MOBILITY","SOFTWARE",
];

const MAX_FILE = 8 * 1024 * 1024; // 8MB

export default function ProductCreate() {
  const navigate = useNavigate();
  const location = useLocation();
  const brandId = location.state?.brandId;

  const [form, setForm] = useState({
    name: "",
    slug: "",
    description: "",
    price: "",
    currency: "USD",
    category: PRODUCT_CATEGORIES[0],
    status: "ACTIVE",
  });
  const [photos, setPhotos] = useState([]);

  const handleChange = (e) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleFiles = (e) => {
    const files = Array.from(e.target.files);
    const valid = files.filter((f) => {
      if (f.size > MAX_FILE) {
        alert(`${f.name} is too large (max 8MB).`);
        return false;
      }
      return true;
    });
    setPhotos((prev) => [...prev, ...valid]);
  };

  const removePhoto = (idx) => {
    setPhotos((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!brandId) {
      alert("Brand ID missing");
      return;
    }

    try {
      const fd = new FormData();
      fd.append("product", new Blob([JSON.stringify(form)], { type: "application/json" }));
      photos.forEach((file) => fd.append("photos", file));

      const res = await fetchWithAuth(`${BRAND.BASE}/brands/${brandId}/products`, {
        method: "POST",
        body: fd,
      });

      if (!res.ok) {
        const txt = await res.text().catch(() => "");
        throw new Error(`Failed to create product: ${res.status} ${txt}`);
      }

      await res.json();
      navigate("/my-brand");
    } catch (err) {
      console.error(err);
      alert("Error creating product: " + err.message);
    }
  };

  const containerStyle = useMemo(
    () => ({
      paddingBlock: 24,
      paddingInline: "clamp(16px, 6vw, 140px)",
    }),
    []
  );

  return (
    <div style={containerStyle}>
      <h2 style={{ margin: 0, marginBottom: 12 }}>Create Product</h2>

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
              style={{
                padding: 10,
                borderRadius: 8,
                border: "1px solid #e5e7eb",
                resize: "vertical",
              }}
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
                style={{
                  padding: "8px 10px",
                  borderRadius: 8,
                  border: "1px solid #e5e7eb",
                  background: "#fff",
                }}
              >
                {PRODUCT_CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c.replace(/_/g, " ")}
                  </option>
                ))}
              </select>
            </label>

            {/* Add photos */}
            <div style={{ display: "grid", gap: 8 }}>
              <span style={{ color: "#334155", fontWeight: 600 }}>Photos:</span>
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
                <input type="file" multiple onChange={handleFiles} style={{ display: "none" }} />
              </label>

              {photos.length > 0 && (
                <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                  {photos.map((f, i) => (
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
                          onClick={() => removePhoto(i)}
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

          {/* Right side filler for symmetry */}
          <div />
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
            Create
          </button>
        </div>
      </form>
    </div>
  );
}
