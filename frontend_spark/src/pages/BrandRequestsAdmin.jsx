// src/pages/BrandRequestsAdmin.jsx
import { useCallback, useEffect, useMemo, useState } from "react";
import { BRAND_REQUESTS } from "../config.js";
import { fetchWithAuth } from "../utils/auth.js";
import "../css/pages/brand-request-admin.css";

const STATUS_OPTS = ["ALL", "PENDING", "APPROVED", "REJECTED"];

export default function BrandRequestsAdmin() {
  const [status, setStatus] = useState("PENDING");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [items, setItems] = useState([]);
  const [actionNote, setActionNote] = useState("");

  const [fileMap, setFileMap] = useState({});
  const [previewMap, setPreviewMap] = useState({});
  const [logoFailed, setLogoFailed] = useState({}); // <-- track per-id image failure

  const listUrl = useMemo(
    () => (status === "ALL" ? BRAND_REQUESTS.LIST() : BRAND_REQUESTS.LIST(status)),
    [status]
  );

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetchWithAuth(listUrl);
      if (!res.ok) throw new Error(`Failed to load requests (${res.status})`);
      const data = await res.json();
      setItems(Array.isArray(data) ? data : []);
      // reset image-failure map whenever list changes
      setLogoFailed({});
    } catch (e) {
      setError(e.message || "Failed to load requests");
    } finally {
      setLoading(false);
    }
  }, [listUrl]);

  useEffect(() => {
    load();
  }, [load]);

  const doApprove = async (id) => {
    setActionNote("");
    try {
      const res = await fetchWithAuth(BRAND_REQUESTS.APPROVE(id), { method: "PUT" });
      if (!res.ok) throw new Error(`Approve failed (${res.status})`);
      setItems((prev) => prev.map((it) => (it.id === id ? { ...it, status: "APPROVED" } : it)));
      setActionNote("Request approved.");
    } catch (e) {
      setError(e.message || "Approve failed");
    }
  };

  const doReject = async (id) => {
    const reason = window.prompt("Enter a rejection reason (optional):") || "";
    setActionNote("");
    try {
      const res = await fetchWithAuth(BRAND_REQUESTS.REJECT(id), {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason }),
      });
      if (!res.ok) throw new Error(`Reject failed (${res.status})`);
      setItems((prev) =>
        prev.map((it) => (it.id === id ? { ...it, status: "REJECTED", reason } : it))
      );
      setActionNote("Request rejected.");
    } catch (e) {
      setError(e.message || "Reject failed");
    }
  };

  const setRowFile = (id, file) => {
    setFileMap((m) => ({ ...m, [id]: file || null }));
    setPreviewMap((pm) => {
      if (pm[id]) URL.revokeObjectURL(pm[id]);
      return { ...pm, [id]: file ? URL.createObjectURL(file) : null };
    });
    // if user picked a new file, clear any previous failure flag so we try to show img again
    setLogoFailed((f) => ({ ...f, [id]: false }));
  };

  const uploadLogo = async (id) => {
    const file = fileMap[id];
    if (!file) return;
    const fd = new FormData();
    fd.append("file", file);
    const res = await fetchWithAuth(BRAND_REQUESTS.LOGO_PUT(id), { method: "POST", body: fd });
    if (!res.ok) {
      const t = await res.text().catch(() => "");
      throw new Error(`Logo upload failed (${res.status}) ${t}`);
    }
    setActionNote("Logo uploaded.");
    setFileMap((m) => ({ ...m, [id]: null }));
    setPreviewMap((pm) => {
      if (pm[id]) URL.revokeObjectURL(pm[id]);
      const { [id]: _removed, ...rest } = pm;
      return rest;
    });
    // after successful upload, force refetch (and we’ll try showing the image again)
    await load();
  };

  const getLogoSrc = (id) => {
    if (previewMap[id]) return previewMap[id];
    return `${BRAND_REQUESTS.LOGO_GET(id)}?t=${Date.now()}`;
  };

  const firstLetter = (r) => {
    const s = (r.slug || r.name || "").trim();
    return s ? s[0].toUpperCase() : "?";
  };

  return (
    <div className="brand-requests">
      <header className="br-header">
        <h1>Brand Requests</h1>

        <div className="br-controls">
          <label className="br-select">
            <span>Status</span>
            <select value={status} onChange={(e) => setStatus(e.target.value)}>
              {STATUS_OPTS.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </label>

          <button className="btn" onClick={load} disabled={loading}>
            {loading ? "Loading…" : "Refresh"}
          </button>

          {actionNote && <span className="br-note" aria-live="polite">{actionNote}</span>}
        </div>
      </header>

      {error && (
        <div className="alert error" role="alert">
          {error}
        </div>
      )}

      <div className="table-wrap">
        <table className="br-table">
          <thead>
            <tr>
              <th>Logo</th>
              <th>Brand</th>
              <th>Slug</th>
              <th>Applicant</th>
              <th>Status</th>
              <th>Requested At</th>
              <th>Actions</th>
            </tr>
          </thead>

          <tbody>
            {items.length === 0 && !loading && (
              <tr>
                <td colSpan="7" className="br-empty">No requests found.</td>
              </tr>
            )}

            {items.map((r) => (
              <tr key={r.id}>
                <td>
                  <div className="logo-cell">
                    <div className="logo-box">
                      {!logoFailed[r.id] ? (
                        <img
                          src={getLogoSrc(r.id)}
                          alt={`${r.name || r.slug} logo`}
                          onError={() => setLogoFailed((m) => ({ ...m, [r.id]: true }))}
                        />
                      ) : (
                        <div className="logo-fallback" aria-label={r.slug || r.name}>
                          {firstLetter(r)}
                        </div>
                      )}
                    </div>

                    <div className="logo-actions">
                      <label className="file-input">
                        Upload / Replace Logo
                        <input
                          type="file"
                          accept="image/*"
                          onChange={(e) => setRowFile(r.id, e.target.files?.[0] || null)}
                        />
                      </label>

                      <button
                        type="button"
                        className="btn btn-secondary"
                        onClick={() => uploadLogo(r.id)}
                        disabled={!fileMap[r.id]}
                      >
                        Upload
                      </button>
                    </div>
                  </div>
                </td>

                <td>{r.brandName ?? r.name}</td>
                <td><code className="code">{r.slug}</code></td>
                <td>{r.applicantName || r.applicantEmail || r.applicantId || "—"}</td>

                <td>
                  <span
                    className={
                      "badge " +
                      (r.status === "PENDING"
                        ? "badge-warn"
                        : r.status === "APPROVED"
                        ? "badge-ok"
                        : "badge-danger")
                    }
                  >
                    {r.status}
                  </span>
                  {r.status === "REJECTED" && r.reason && (
                    <div className="muted" style={{ marginTop: 6, fontSize: 12 }}>
                      Reason: {r.reason}
                    </div>
                  )}
                </td>

                <td>{r.createdAt ? new Date(r.createdAt).toLocaleString() : "—"}</td>

                <td className="actions">
                  {r.status === "PENDING" && (
                    <>
                      <button className="btn btn-ok" onClick={() => doApprove(r.id)} title="Approve">
                        Approve
                      </button>
                      <button className="btn btn-danger" onClick={() => doReject(r.id)} title="Reject">
                        Reject
                      </button>
                    </>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
