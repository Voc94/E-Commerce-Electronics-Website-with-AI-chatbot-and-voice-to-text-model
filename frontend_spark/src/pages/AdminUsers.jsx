import { useEffect, useState, useCallback, useMemo } from "react";
import { fetchWithAuth, logout } from "../utils/auth.js";
import { API_BASE, STORE_API_BASE } from "../config.js";
import { useNavigate } from "react-router-dom";
import UserForm from "../components/admin/UserForm.jsx";
import UserRow from "../components/admin/UserRow.jsx";
import SearchBar from "../components/admin/SearchBar.jsx";
import "../css/pages/brand-request.css";
import "../css/pages/admin-users.css";

const matchUser = (user, query) => {
  if (!query) return true;
  const q = query.trim().toLowerCase();
  return (
    user.name?.toLowerCase().includes(q) ||
    user.email?.toLowerCase().includes(q) ||
    user.role?.toLowerCase().includes(q) ||
    user.provider?.toLowerCase().includes(q)
  );
};

/**
 * Given raw users from the user management service, fetch brand summary for BRAND_SELLERs.
 * Attaches `brand` property (or null) to each user.
 */
const enrichWithBrand = async (users) => {
  return await Promise.all(
    users.map(async (u) => {
      if (u.role !== "BRAND_SELLER") return u;
      try {
        const res = await fetchWithAuth(`${STORE_API_BASE}/public/users/${u.id}/brand`);
        if (res.status === 404) {
          return { ...u, brand: null };
        }
        if (res.status === 204) {
          return { ...u, brand: null };
        }
        if (!res.ok) {
          return { ...u, brandFetchError: true };
        }
        const brand = await res.json();
        return { ...u, brand };
      } catch (e) {
        return { ...u, brandFetchError: true };
      }
    })
  );
};

export default function AdminUsers() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [globalError, setGlobalError] = useState(null);
  const [showNew, setShowNew] = useState(false);
  const [creating, setCreating] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [search, setSearch] = useState("");
  const navigate = useNavigate();

  const load = useCallback(async () => {
    setLoading(true);
    setGlobalError(null);
    try {
      const res = await fetchWithAuth(`${API_BASE}/admin/users`);
      if (res.status === 401) {
        logout();
        navigate("/login");
        return;
      }
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setGlobalError(body.error || `Failed to load users (${res.status})`);
        return;
      }
      const list = await res.json();
      const enriched = await enrichWithBrand(list);
      setUsers(enriched);
    } catch (e) {
      setGlobalError(e.message);
    } finally {
      setLoading(false);
    }
  }, [navigate]);

  useEffect(() => {
    load();
  }, [load, refreshKey]);

  const filteredUsers = useMemo(() => users.filter((u) => matchUser(u, search)), [users, search]);

  const handleCreate = async (form) => {
    setGlobalError(null);
    setCreating(true);
    try {
      const payload = {
        name: form.name.trim(),
        email: form.email.trim().toLowerCase(),
        role: form.role,
        provider: form.provider,
        emailVerified: form.emailVerified,
        providerId: form.provider === "LOCAL" ? null : form.providerId.trim(),
        password: form.provider === "LOCAL" ? form.password : null,
      };
      const res = await fetchWithAuth(`${API_BASE}/admin/users`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (body.error && body.error.toLowerCase().includes("email already in use")) {
          setGlobalError("Email already in use");
        } else {
          setGlobalError(body.error || "Failed to create user");
        }
        return;
      }
      setShowNew(false);
      setRefreshKey((k) => k + 1);
    } catch (e) {
      setGlobalError(e.message);
    } finally {
      setCreating(false);
    }
  };

  const handleDeleted = async (id) => {
    try {
      const res = await fetchWithAuth(`${API_BASE}/admin/users/${id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        alert("Delete failed: " + (body.error || res.status));
        return;
      }
      setUsers((u) => u.filter((x) => x.id !== id));
    } catch (e) {
      alert("Delete error: " + e.message);
    }
  };

  return (
    <div className="admin-page">
      <div className="admin-header">
        <div>
          <h2>Admin — User Management</h2>
          <div className="subtitle">Create, edit, delete, and search users. Only admins can access this.</div>
        </div>
        <div className="admin-actions">
          <SearchBar value={search} onChange={setSearch} />
          <button className="btn btn-secondary" onClick={() => setRefreshKey((k) => k + 1)}>
            Refresh
          </button>
          <button className="btn btn-primary" onClick={() => setShowNew((s) => !s)}>
            {showNew ? "Hide form" : "New user"}
          </button>
        </div>
      </div>

      {globalError && <div className="error-box">{globalError}</div>}

      {showNew && (
        <div className="card new-user-card">
          <UserForm isNew onSubmit={handleCreate} submitting={creating} onCancel={() => setShowNew(false)} />
        </div>
      )}

      <div className="table-wrapper">
        {loading ? (
          <div className="loading">Loading users...</div>
        ) : (
          <>
            {filteredUsers.length === 0 && <div className="no-results">No users match your search.</div>}
            <table className="users-table">
              <thead>
                <tr>
                  {[
                    "Avatar",
                    "ID",
                    "Name",
                    "Email",
                    "Provider",
                    "Role",
                    "Email Verified",
                    "Created At",
                    "Updated At",
                    "Actions",
                  ].map((h) => (
                    <th key={h}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredUsers.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="empty">
                      {users.length === 0 ? "No users." : "No users match the filter."}
                    </td>
                  </tr>
                ) : (
                  filteredUsers.map((u) => (
                    <UserRow
                      key={u.id}
                      user={u}
                      onUpdated={() => setRefreshKey((k) => k + 1)}
                      onDeleted={handleDeleted}
                    />
                  ))
                )}
              </tbody>
            </table>
          </>
        )}
      </div>
    </div>
  );
}
