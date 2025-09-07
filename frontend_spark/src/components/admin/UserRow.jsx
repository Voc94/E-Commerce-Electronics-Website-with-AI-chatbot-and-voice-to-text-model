import { useState, useEffect, useRef, useCallback } from "react";
import Avatar from "../Avatar.jsx";
import ProviderIcon from "./ProviderIcon.jsx";
import { fetchWithAuth } from "../../utils/auth.js";
import { BRAND } from "../../config.js";

/**
 * Modal used for assigning / searching brands.
 */
function BrandAssignModal({ open, initialBrand, onClose, onAssign, onClear }) {
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState([]);
  const [loading, setLoading] = useState(false);
  const debounceRef = useRef(null);
  const containerRef = useRef(null);

  const fetchBrands = useCallback(
    async (q) => {
      setLoading(true);
      try {
        const url = BRAND.LIST(q);
        const res = await fetchWithAuth(url);
        if (res.ok) {
          const list = await res.json();
          setSuggestions(list.slice(0, 10));
        } else {
          setSuggestions([]);
        }
      } catch {
        setSuggestions([]);
      } finally {
        setLoading(false);
      }
    },
    []
  );

  useEffect(() => {
    if (!open) return;
    clearTimeout(debounceRef.current);
    const delay = query.trim() ? 250 : 0;
    debounceRef.current = setTimeout(() => {
      fetchBrands(query);
    }, delay);
    return () => clearTimeout(debounceRef.current);
  }, [query, open, fetchBrands]);

  useEffect(() => {
    if (open) {
      setQuery("");
      setSuggestions([]);
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  useEffect(() => {
    if (!open) return;
    const handleClickOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        onClose();
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="modal-backdrop" style={backdropStyle}>
      <div className="brand-modal" style={modalStyle} ref={containerRef}>
        <div className="header" style={headerStyle}>
          <div>
            <h3 style={{ margin: 0 }}>Assign Brand</h3>
            <div style={{ fontSize: 12, color: "#666" }}>
              {initialBrand ? `Current: ${initialBrand.name}` : "No brand assigned"}
            </div>
          </div>
          <button onClick={onClose} aria-label="Close" className="btn btn-outline" style={closeButtonStyle}>
            ×
          </button>
        </div>
        <div className="body" style={bodyStyle}>
          <div style={{ marginBottom: 12 }}>
            <label style={{ display: "block", marginBottom: 6 }}>Search brands</label>
            <input
              placeholder="Type to search..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="small-input"
              autoFocus
              style={{ width: "100%", padding: "8px", boxSizing: "border-box" }}
            />
          </div>

          {loading && <div className="mini">Searching...</div>}
          {!loading && suggestions.length === 0 && query.trim() && <div className="mini">No results</div>}

          {!loading && suggestions.length > 0 && (
            <ul
              className="suggestion-list"
              style={{
                listStyle: "none",
                padding: 0,
                margin: 0,
                maxHeight: 280,
                overflowY: "auto",
                border: "1px solid #e1e4e8",
                borderRadius: 6,
              }}
            >
              {suggestions.map((b) => (
                <li
                  key={b.id}
                  onClick={() => onAssign(b)}
                  style={{
                    padding: "8px 12px",
                    cursor: "pointer",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    borderBottom: "1px solid #f0f0f0",
                  }}
                >
                  <div style={{ overflow: "hidden" }}>
                    <div
                      style={{
                        fontWeight: 600,
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                      }}
                    >
                      {b.name}
                    </div>
                    <div style={{ fontSize: 12, color: "#555" }}>{b.slug}</div>
                  </div>
                  <div>
                    <button className="btn btn-sm btn-secondary" style={{ fontSize: 12 }} type="button">
                      Select
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="footer" style={footerStyle}>
          <div style={{ display: "flex", gap: 8, flex: 1 }}>
            {initialBrand && (
              <button type="button" className="btn btn-outline" onClick={onClear}>
                Clear assignment
              </button>
            )}
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button type="button" className="btn btn-primary" onClick={onClose}>
              Done
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// inline styles
const backdropStyle = {
  position: "fixed",
  inset: 0,
  background: "rgba(0,0,0,0.35)",
  zIndex: 1000,
  display: "flex",
  justifyContent: "center",
  alignItems: "center",
  padding: "16px",
};
const modalStyle = {
  background: "#fff",
  borderRadius: 12,
  width: 560,
  maxWidth: "100%",
  boxShadow: "0 25px 60px -10px rgba(0,0,0,0.25)",
  display: "flex",
  flexDirection: "column",
  overflow: "hidden",
};
const headerStyle = {
  padding: "16px 20px",
  borderBottom: "1px solid #eee",
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
};
const closeButtonStyle = {
  padding: "6px 12px",
  fontSize: 20,
  background: "none",
  border: "none",
  cursor: "pointer",
  lineHeight: 1,
};
const bodyStyle = {
  padding: "16px 20px",
  flex: 1,
  overflowY: "auto",
};
const footerStyle = {
  padding: "12px 20px",
  borderTop: "1px solid #eee",
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
};

export default function UserRow({ user, isSelf = false, onUpdated, onDeleted, onChangePassword }) {
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({
    name: user.name,
    email: user.email,
    role: user.role,
    emailVerified: user.emailVerified,
    password: "",
  });
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [assignModalOpen, setAssignModalOpen] = useState(false);
  const [selectedBrand, setSelectedBrand] = useState(user.brand || null);
  const [assigningBrand, setAssigningBrand] = useState(false);
  const [clearingBrand, setClearingBrand] = useState(false);

  const isLocal = user.provider === "LOCAL";
  const isBrandSeller = user.role === "BRAND_SELLER";

  useEffect(() => {
    setForm({
      name: user.name,
      email: user.email,
      role: user.role,
      emailVerified: user.emailVerified,
      password: "",
    });
    setSelectedBrand(user.brand || null);
    setEditing(false);
    setErrors({});
  }, [user]);

  const handleSave = async () => {
    setErrors({});
    const payload = {};
    if (form.name.trim() !== user.name) payload.name = form.name.trim();
    if (form.email.trim().toLowerCase() !== user.email) payload.email = form.email.trim().toLowerCase();
    if (!isSelf && form.role && form.role !== user.role) payload.role = form.role;
    if (typeof form.emailVerified === "boolean" && form.emailVerified !== user.emailVerified)
      payload.emailVerified = form.emailVerified;
    if (isLocal && form.password && !isSelf) payload.password = form.password;

    if (Object.keys(payload).length === 0) {
      setEditing(false);
      return;
    }

    setSaving(true);
    try {
      const res = await fetchWithAuth(`/admin/users/${user.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (body.error && body.error.toLowerCase().includes("email already in use")) {
          setErrors({ email: "Email already in use" });
        } else {
          alert("Update failed: " + (body.error || res.status));
        }
        return;
      }
      onUpdated();
      setEditing(false);
      setForm((f) => ({ ...f, password: "" }));
    } catch (e) {
      alert("Update error: " + e.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = () => {
    if (window.confirm("Delete this user?")) {
      onDeleted(user.id);
    }
  };

  const assignBrand = async (brand) => {
    if (!brand || !brand.id) return;
    setAssigningBrand(true);
    try {
      const res = await fetchWithAuth(
        `${BRAND.BASE}/brands/${brand.id}/assign-seller/${user.id}`,
        { method: "POST" }
      );
      if (!res.ok) {
        if (res.status === 404) {
          alert("Failed to assign brand: user not yet synced or brand not found. Try again in a few seconds.");
        } else {
          const body = await res.json().catch(() => ({}));
          alert("Failed to assign brand: " + (body.error || res.status));
        }
        return;
      }
      setSelectedBrand(brand);
      setAssignModalOpen(false);
      onUpdated();
    } catch (e) {
      alert("Assign brand error: " + e.message);
    } finally {
      setAssigningBrand(false);
    }
  };

  const clearBrand = async () => {
    if (!selectedBrand) return;
    setClearingBrand(true);
    try {
      const res = await fetchWithAuth(
        `${BRAND.BASE}/brands/${selectedBrand.id}/assign-seller/${user.id}`,
        { method: "DELETE" }
      );
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        alert("Failed to clear brand: " + (body.error || res.status));
        return;
      }
      setSelectedBrand(null);
      setAssignModalOpen(false);
      onUpdated();
    } catch (e) {
      alert("Clear brand error: " + e.message);
    } finally {
      setClearingBrand(false);
    }
  };

  return (
    <>
      {isBrandSeller && (
        <BrandAssignModal
          open={assignModalOpen}
          initialBrand={selectedBrand}
          onClose={() => setAssignModalOpen(false)}
          onAssign={assignBrand}
          onClear={clearBrand}
        />
      )}

      <tr className="user-row">
        <td>
          <Avatar imageUrl={user.imageUrl} size={32} alt={user.name} />
        </td>
        <td>{user.id}</td>
        <td>
          {editing ? (
            <div className="inline-field">
              <input
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                disabled={saving}
              />
              {errors.name && <div className="field-error">{errors.name}</div>}
            </div>
          ) : (
            user.name
          )}
        </td>
        <td>
          {editing ? (
            <div className="inline-field">
              <input
                value={form.email}
                onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                disabled={saving || isSelf}
              />
              {errors.email && <div className="field-error">{errors.email}</div>}
            </div>
          ) : (
            user.email
          )}
        </td>
        <td className="provider-cell">
          <ProviderIcon provider={user.provider} />
          <span>{user.provider}</span>
        </td>
        <td>
          {editing ? (
            <select
              value={form.role}
              onChange={(e) => setForm((f) => ({ ...f, role: e.target.value }))}
              disabled={saving || isSelf}
              className="small-input"
            >
              <option value="USER">USER</option>
              <option value="ADMIN">ADMIN</option>
              <option value="BRAND_SELLER">BRAND_SELLER</option>
            </select>
          ) : (
            user.role
          )}
        </td>
        <td>
          {editing ? (
            <label className="checkbox-wrap">
              <input
                type="checkbox"
                checked={form.emailVerified}
                onChange={(e) => setForm((f) => ({ ...f, emailVerified: e.target.checked }))}
                disabled={saving}
              />
              <span>{form.emailVerified ? "Yes" : "No"}</span>
            </label>
          ) : user.emailVerified ? (
            "Yes"
          ) : (
            "No"
          )}
        </td>
        <td>{user.createdAt ? new Date(user.createdAt).toLocaleString() : "-"}</td>
        <td>{user.updatedAt ? new Date(user.updatedAt).toLocaleString() : "-"}</td>
        <td className="actions-cell">
          {/* Brand label up top (only for brand sellers), then single row of action buttons below */}
          <div style={{ display: "flex", flexDirection: "column", gap: 4, minWidth: 180 }}>
            {isBrandSeller && (
              <div style={{ fontSize: 12 }}>
                <strong>Brand:</strong>{" "}
                {selectedBrand ? (
                  <span
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      padding: "3px 10px",
                      background: "#eef7fd",
                      borderRadius: 999,
                      gap: 6,
                      fontSize: 12,
                      maxWidth: 180,
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    }}
                    title={selectedBrand.name}
                  >
                    <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>
                      {selectedBrand.name}
                    </span>
                    <button
                      onClick={clearBrand}
                      aria-label="Clear brand"
                      disabled={clearingBrand}
                      style={{
                        background: "none",
                        border: "none",
                        cursor: "pointer",
                        fontSize: 14,
                        lineHeight: 1,
                        padding: 0,
                      }}
                    >
                      ×
                    </button>
                  </span>
                ) : (
                  <span style={{ fontStyle: "italic", color: "#666" }}>None assigned</span>
                )}
              </div>
            )}

            <div
              style={{
                display: "flex",
                gap: 6,
                flexWrap: "nowrap",
                alignItems: "center",
                marginTop: 2,
                overflowX: "auto",
              }}
            >
              {editing ? (
                <>
                  {isLocal && !isSelf && (
                    <input
                      type="password"
                      placeholder="New password"
                      value={form.password}
                      onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                      disabled={saving}
                      className="small-input"
                      style={{ width: 100, flex: "0 0 auto" }}
                    />
                  )}
                  {isSelf && isLocal && onChangePassword && (
                    <button
                      type="button"
                      className="btn btn-outline"
                      onClick={() => onChangePassword(user)}
                      disabled={saving}
                      style={{ flex: "0 0 auto" }}
                    >
                      Change Password
                    </button>
                  )}
                  {isBrandSeller && (
                    <button
                      type="button"
                      className="btn btn-secondary"
                      onClick={() => setAssignModalOpen(true)}
                      disabled={assigningBrand}
                      style={{ flex: "0 0 auto" }}
                    >
                      {selectedBrand ? "Change Brand" : "Assign Brand"}
                    </button>
                  )}
                  <button
                    onClick={handleSave}
                    className="btn btn-primary"
                    disabled={saving}
                    style={{ flex: "0 0 auto" }}
                  >
                    {saving ? "Saving..." : "Save"}
                  </button>
                  <button
                    onClick={() => {
                      setEditing(false);
                      setErrors({});
                      setForm({
                        name: user.name,
                        email: user.email,
                        role: user.role,
                        emailVerified: user.emailVerified,
                        password: "",
                      });
                    }}
                    className="btn btn-outline"
                    disabled={saving}
                    style={{ flex: "0 0 auto" }}
                  >
                    Cancel
                  </button>
                </>
              ) : (
                <>
                  <button
                    onClick={() => setEditing(true)}
                    className="btn btn-primary"
                    disabled={saving}
                    style={{ flex: "0 0 auto" }}
                  >
                    Edit
                  </button>
                  {isBrandSeller && (
                    <button
                      type="button"
                      className="btn btn-secondary"
                      onClick={() => setAssignModalOpen(true)}
                      disabled={assigningBrand}
                      style={{ flex: "0 0 auto" }}
                    >
                      {selectedBrand ? "Change Brand" : "Assign Brand"}
                    </button>
                  )}
                  {!isSelf && (
                    <button
                      onClick={handleDelete}
                      className="btn btn-danger"
                      disabled={saving}
                      style={{ flex: "0 0 auto" }}
                    >
                      Delete
                    </button>
                  )}
                </>
              )}
            </div>
          </div>
        </td>
      </tr>
    </>
  );
}
