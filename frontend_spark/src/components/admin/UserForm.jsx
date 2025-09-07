import { useState, useEffect, useCallback, useRef } from "react";
import { fetchWithAuth } from "../../utils/auth.js";
import { BRAND } from "../../config.js";

const emailRegex = /^\S+@\S+\.\S+$/;
const roles = ["USER", "ADMIN", "BRAND_SELLER"];
const providers = ["LOCAL", "GOOGLE", "GITHUB"];

const DEFAULT_INITIAL = {
  name: "",
  email: "",
  password: "",
  provider: "LOCAL",
  providerId: "",
  role: "USER",
  emailVerified: false,
  brandId: "",
  brand: null,
};

function validate({ name, email, password, provider, providerId, role }, isNew) {
  const errors = {};
  if (!name || !name.trim()) errors.name = "Name is required";
  else if (name.trim().length < 2) errors.name = "Name must be at least 2 characters";

  if (!email || !email.trim()) errors.email = "Email is required";
  else if (!emailRegex.test(email.trim())) errors.email = "Invalid email";

  if (provider === "LOCAL") {
    if (isNew) {
      if (!password) errors.password = "Password is required";
      else if (password.length < 8) errors.password = "Password must be >=8 chars";
    } else if (password && password.length < 8) {
      errors.password = "Password must be >=8 chars";
    }
  } else {
    if (!providerId || !providerId.trim()) {
      errors.providerId = "Provider ID required for OAuth user";
    }
  }

  return errors;
}

export default function UserForm({
  initial,
  isNew = true,
  onCancel,
  onSubmit,
  submitting,
}) {
  const effectiveInitial = initial ?? DEFAULT_INITIAL;
  const [form, setForm] = useState(() => ({
    ...DEFAULT_INITIAL,
    ...effectiveInitial,
    brandId: effectiveInitial.brand?.id ?? effectiveInitial.brandId ?? "",
    brand: effectiveInitial.brand ?? null,
  }));
  const [errors, setErrors] = useState({});

  // brand search state
  const [brandQuery, setBrandQuery] = useState("");
  const [brandSuggestions, setBrandSuggestions] = useState([]);
  const [brandLoading, setBrandLoading] = useState(false);
  const debounceRef = useRef(null);

  // reset when initial changes
  useEffect(() => {
    setForm({
      ...DEFAULT_INITIAL,
      ...effectiveInitial,
      brandId: effectiveInitial.brand?.id ?? effectiveInitial.brandId ?? "",
      brand: effectiveInitial.brand ?? null,
    });
    setErrors({});
    setBrandQuery("");
    setBrandSuggestions([]);
  }, [
    effectiveInitial.name,
    effectiveInitial.email,
    effectiveInitial.provider,
    effectiveInitial.providerId,
    effectiveInitial.role,
    effectiveInitial.emailVerified,
    effectiveInitial.brandId,
    effectiveInitial.brand,
  ]);

  // brand search effect (only when role is BRAND_SELLER)
  useEffect(() => {
    if (form.role !== "BRAND_SELLER") return;
    if (!brandQuery || brandQuery.trim() === "") {
      setBrandSuggestions([]);
      return;
    }
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      setBrandLoading(true);
      try {
        const res = await fetchWithAuth(`${BRAND.LIST}?q=${encodeURIComponent(brandQuery)}`);
        if (res.ok) {
          const list = await res.json();
          setBrandSuggestions(list.slice(0, 10));
        } else {
          setBrandSuggestions([]);
        }
      } catch (e) {
        setBrandSuggestions([]);
      } finally {
        setBrandLoading(false);
      }
    }, 300);
  }, [brandQuery, form.role]);

  const selectBrand = (b) => {
    setForm((f) => ({ ...f, brandId: b.id, brand: b }));
    setBrandSuggestions([]);
    setBrandQuery("");
  };

  const clearBrand = () => {
    setForm((f) => ({ ...f, brandId: "", brand: null }));
    setBrandQuery("");
    setBrandSuggestions([]);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const validation = validate(form, isNew);
    if (Object.keys(validation).length) {
      setErrors(validation);
      return;
    }
    // normalize payload: include brandId when appropriate
    await onSubmit({
      name: form.name.trim(),
      email: form.email.trim().toLowerCase(),
      provider: form.provider,
      providerId: form.provider === "LOCAL" ? null : form.providerId,
      password: form.provider === "LOCAL" ? form.password : null,
      role: form.role,
      emailVerified: form.emailVerified,
      brandId: form.role === "BRAND_SELLER" ? form.brandId || null : undefined,
    });
  };

  return (
    <form className="user-form" onSubmit={handleSubmit} noValidate>
      <div className="form-grid">
        <div className="field">
          <label>Name</label>
          <input
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            disabled={submitting}
          />
          {errors.name && <div className="field-error">{errors.name}</div>}
        </div>

        <div className="field">
          <label>Email</label>
          <input
            value={form.email}
            onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
            disabled={submitting}
          />
          {errors.email && <div className="field-error">{errors.email}</div>}
        </div>

        <div className="field">
          <label>Provider</label>
          <select
            value={form.provider}
            onChange={(e) =>
              setForm((f) => ({
                ...f,
                provider: e.target.value,
                password: "",
                providerId: "",
              }))
            }
            disabled={submitting}
          >
            {providers.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </div>

        {form.provider === "LOCAL" && (
          <div className="field">
            <label>{isNew ? "Password" : "New Password (optional)"}</label>
            <input
              type="password"
              value={form.password}
              onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
              disabled={submitting}
            />
            {errors.password && <div className="field-error">{errors.password}</div>}
          </div>
        )}

        {form.provider !== "LOCAL" && (
          <div className="field">
            <label>Provider ID</label>
            <input
              value={form.providerId}
              onChange={(e) => setForm((f) => ({ ...f, providerId: e.target.value }))}
              disabled={submitting}
            />
            {errors.providerId && <div className="field-error">{errors.providerId}</div>}
          </div>
        )}

        <div className="field">
          <label>Role</label>
          <select
            value={form.role}
            onChange={(e) => setForm((f) => ({ ...f, role: e.target.value }))}
            disabled={submitting}
          >
            {roles.map((r) => (
              <option key={r} value={r}>
                {r.replace("_", " ")}
              </option>
            ))}
          </select>
        </div>

        {form.role === "BRAND_SELLER" && (
          <div className="field">
            <label>Brand (optional)</label>
            <div className="brand-autocomplete">
              {form.brand ? (
                <div className="selected-brand">
                  <span>{form.brand.name}</span>
                  <button
                    type="button"
                    onClick={clearBrand}
                    disabled={submitting}
                    aria-label="Clear"
                  >
                    ×
                  </button>
                </div>
              ) : (
                <>
                  <input
                    placeholder="Search brands..."
                    value={brandQuery}
                    onChange={(e) => setBrandQuery(e.target.value)}
                    disabled={submitting}
                    autoComplete="off"
                  />
                  {brandLoading && <div className="loader-inline">…</div>}
                  {brandSuggestions.length > 0 && (
                    <ul className="suggestions">
                      {brandSuggestions.map((b) => (
                        <li
                          key={b.id}
                          onClick={() => selectBrand(b)}
                          style={{ cursor: "pointer" }}
                        >
                          {b.name} ({b.slug})
                        </li>
                      ))}
                    </ul>
                  )}
                  <div className="note" style={{ fontSize: "0.75rem", marginTop: 4 }}>
                    You can also paste a brand ID manually.
                  </div>
                  <input
                    type="hidden"
                    value={form.brandId || ""}
                    readOnly
                  />
                </>
              )}
            </div>
            {!form.brand && (
              <div className="manual-brand-input" style={{ marginTop: 4 }}>
                <input
                  placeholder="Or paste brand ID"
                  value={form.brandId}
                  onChange={(e) => setForm((f) => ({ ...f, brandId: e.target.value }))}
                  disabled={submitting}
                />
              </div>
            )}
          </div>
        )}

        <div className="field email-verified">
          <label>Email Verified</label>
          <div className="checkbox-wrap">
            <input
              type="checkbox"
              checked={form.emailVerified}
              onChange={(e) => setForm((f) => ({ ...f, emailVerified: e.target.checked }))}
              disabled={submitting}
            />
            <span>{form.emailVerified ? "Yes" : "No"}</span>
          </div>
        </div>
      </div>

      <div className="form-actions">
        <button type="submit" className="btn btn-primary" disabled={submitting}>
          {isNew ? (submitting ? "Creating..." : "Create user") : submitting ? "Saving..." : "Save"}
        </button>
        {onCancel && (
          <button type="button" className="btn btn-secondary" onClick={onCancel} disabled={submitting}>
            Cancel
          </button>
        )}
      </div>
    </form>
  );
}
