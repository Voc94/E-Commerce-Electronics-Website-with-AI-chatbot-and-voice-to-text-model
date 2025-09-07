// src/pages/BrandRequestPage.jsx
import { useEffect, useMemo, useState, useCallback } from "react";
import { fetchWithAuth } from "../utils/auth.js";
import { BRAND_REQUESTS } from "../config.js";
import "../css/pages/brand-request.css"; // <— styles

export default function BrandRequestPage() {
  const [form, setForm] = useState({ name: "", slug: "" });
  const [file, setFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [mine, setMine] = useState(null);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [note, setNote] = useState("");
  const [cacheBust, setCacheBust] = useState(Date.now());
  const [imgOk, setImgOk] = useState(true);

  const canCreateNew = useMemo(() => !mine || mine.status === "REJECTED", [mine]);

  const loadMine = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetchWithAuth(BRAND_REQUESTS.MINE());
      if (res.status === 404) {
        setMine(null);
      } else if (!res.ok) {
        throw new Error(`Failed to load: ${res.status}`);
      } else {
        const data = await res.json();
        setMine(data);
      }
    } catch (e) {
      setError(e.message || "Failed to load your brand request");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadMine();
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [loadMine]);

  const handleChange = (e) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleFile = (e) => {
    const f = e.target.files?.[0] || null;
    setFile(f);
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(f ? URL.createObjectURL(f) : null);
    setImgOk(true);
  };

  const uploadLogo = async (requestId) => {
    if (!file) return;
    const fd = new FormData();
    fd.append("file", file);
    const res = await fetchWithAuth(BRAND_REQUESTS.LOGO_PUT(requestId), {
      method: "POST",
      body: fd,
    });
    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      throw new Error(`Logo upload failed (${res.status}) ${errText}`);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError("");
    setNote("");
    try {
      if (mine && mine.status !== "REJECTED") {
        throw new Error("You already have a request. You cannot submit another.");
      }
      const res = await fetchWithAuth(BRAND_REQUESTS.LIST(), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || data.error || "Request failed");

      if (file) await uploadLogo(data.id);

      setNote("Request submitted!");
      setForm({ name: "", slug: "" });
      setFile(null);
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      setPreviewUrl(null);
      setCacheBust(Date.now());
      await loadMine();
    } catch (err) {
      setError(err.message || "Network error");
    } finally {
      setSubmitting(false);
    }
  };

  const handleSaveLogo = async () => {
    if (!mine || !file) return;
    setError("");
    setNote("");
    try {
      await uploadLogo(mine.id);
      setNote("Logo uploaded.");
      setCacheBust(Date.now());
      await loadMine();
    } catch (e) {
      setError(e.message || "Failed to upload logo");
    } finally {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      setPreviewUrl(null);
      setFile(null);
    }
  };

  const logoSrc = mine
    ? (previewUrl || `${BRAND_REQUESTS.LOGO_GET(mine.id)}?t=${cacheBust}`)
    : null;

  const badgeClass =
    mine?.status === "APPROVED" ? "badge badge-ok" :
    mine?.status === "REJECTED" ? "badge badge-danger" :
    "badge badge-warn";

  // fallback letter
  const fallbackLetter = mine?.slug?.[0]?.toUpperCase() ?? "?";

  return (
    <div className="brp">
      <h2 className="brp-title">Request a New Brand</h2>

      {loading ? (
        <p className="muted">Loading your request...</p>
      ) : (
        <>
          {mine && (
            <div className="brp-card" style={{ marginBottom: 16 }}>
              <div className="brp-row">
                <strong>Your request</strong>
                <span className={badgeClass}>{mine.status}</span>
              </div>

              <div className="brp-meta">
                <div><b>Name:</b> {mine.brandName ?? mine.name}</div>
                <div><b>Slug:</b> <span className="code">{mine.slug}</span></div>
                {mine.reason && <div><b>Reason:</b> {mine.reason}</div>}
              </div>

              <div className="brp-section-label">LOGO</div>
              <div className="brp-logo-row">
                <div className="logo-box">
                  {imgOk && logoSrc ? (
                    <img
                      src={logoSrc}
                      alt="Brand logo"
                      onError={() => setImgOk(false)}
                    />
                  ) : (
                    <div className="logo-fallback">
                      {fallbackLetter}
                    </div>
                  )}
                </div>

                <div className="brp-actions">
                  <label className="file-input">
                    Upload / Replace Logo
                    <input type="file" accept="image/*" onChange={handleFile} />
                  </label>
                  <button
                    type="button"
                    className="btn btn-ok"
                    onClick={handleSaveLogo}
                    disabled={!file}
                  >
                    Save Logo
                  </button>
                </div>
              </div>
            </div>
          )}

          {!canCreateNew && (
            <p className="muted">
              You can’t submit another request while your current one is {mine?.status?.toLowerCase()}.
            </p>
          )}

          {canCreateNew && (
            <form className="brp-card brp-form" onSubmit={handleSubmit}>
              <div className="field">
                <label htmlFor="name">Name</label>
                <input
                  id="name"
                  className="input"
                  name="name"
                  value={form.name}
                  onChange={handleChange}
                  required
                />
              </div>

              <div className="field">
                <label htmlFor="slug">Slug</label>
                <input
                  id="slug"
                  className="input"
                  name="slug"
                  value={form.slug}
                  onChange={handleChange}
                  required
                />
              </div>

              <div className="field">
                <label>Logo (optional)</label>
                <label className="file-input">
                  Choose file
                  <input type="file" accept="image/*" onChange={handleFile} />
                </label>
              </div>

              <div className="brp-actions">
                <button type="submit" className="btn btn-primary" disabled={submitting}>
                  {submitting ? "Submitting..." : "Submit Request"}
                </button>
              </div>
            </form>
          )}
        </>
      )}

      {note && <div className="alert ok">{note}</div>}
      {error && <div className="alert err">{error}</div>}
    </div>
  );
}
