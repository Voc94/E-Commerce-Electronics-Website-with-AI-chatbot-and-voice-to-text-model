// src/pages/Dashboard.jsx
import { useEffect, useState } from "react";
import { fetchWithAuth, logout, setToken } from "../utils/auth.js";
import { API_BASE } from "../config.js";
import "../css/pages/dashboard.css";
import { useNavigate } from "react-router-dom";
import ProfileImageUploader from "../components/ProfileImageUploader.jsx";
import Avatar from "../components/Avatar.jsx";

export default function MyProfile() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [pwdState, setPwdState] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });
  const [pwdError, setPwdError] = useState(null);
  const [pwdSuccess, setPwdSuccess] = useState(null);
  const [changing, setChanging] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    (async () => {
      try {
        const res = await fetchWithAuth(`${API_BASE}/auth/me`);
        if (!res.ok) {
          logout();
          navigate("/login");
          return;
        }
        const data = await res.json();
        setUser(data);
      } catch (e) {
        console.error("Failed to load user:", e);
        logout();
        navigate("/login");
      } finally {
        setLoading(false);
      }
    })();
  }, [navigate]);

  const doLogout = () => {
    logout();
    navigate("/login");
  };

  const handleImageUpdate = (newUrl) => {
    setUser((u) => (u ? { ...u, imageUrl: newUrl } : u));
  };

  const handlePasswordChange = async (e) => {
    e.preventDefault();
    setPwdError(null);
    setPwdSuccess(null);
    if (changing) return;

    const { currentPassword, newPassword, confirmPassword } = pwdState;
    if (!currentPassword || !newPassword || !confirmPassword) {
      setPwdError("All fields are required.");
      return;
    }
    if (newPassword.length < 8) {
      setPwdError("New password must be at least 8 characters.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setPwdError("New password and confirmation do not match.");
      return;
    }
    if (currentPassword === newPassword) {
      setPwdError("New password must be different from current password.");
      return;
    }

    setChanging(true);
    try {
      const res = await fetchWithAuth(`${API_BASE}/auth/me/change-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          currentPassword,
          newPassword,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "Failed to change password");
      }
      const data = await res.json();
      if (data.token) {
        setToken(data.token);
      }
      setPwdSuccess("Password changed successfully.");
      setPwdState({
        currentPassword: "",
        newPassword: "",
        confirmPassword: "",
      });
    } catch (err) {
      setPwdError(err.message);
    } finally {
      setChanging(false);
    }
  };

  if (loading) {
    return <div className="page dashboard">Loading...</div>;
  }

  if (!user) {
    return <div className="page dashboard">User info not available.</div>;
  }

  return (
    <div className="page dashboard">
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <h2>My Profile</h2>
        <button onClick={doLogout}>Logout</button>
      </div>

      <div
        className="profile-wrapper"
        style={{ display: "flex", gap: 24, alignItems: "flex-start" }}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 12,
          }}
        >
          <Avatar imageUrl={user.imageUrl} size={96} alt={user.name} />
          <ProfileImageUploader
            currentUrl={user.imageUrl}
            onUpdate={handleImageUpdate}
          />
        </div>

        <div className="profile">
          <p>
            <strong>Name:</strong> {user.name}
          </p>
          <p>
            <strong>Email:</strong> {user.email}
          </p>
          <p>
            <strong>Provider:</strong> {user.provider}
          </p>
          <p>
            <strong>Role:</strong> {user.role}
          </p>
        </div>
      </div>

      <div
        className="password-card"
        style={{
          marginTop: 24,
          maxWidth: 560,
          background: "#fff",
          borderRadius: 12,
          padding: 24,
          boxShadow: "0 24px 60px -10px rgba(0,0,0,0.08)",
          display: "flex",
          flexDirection: "column",
          gap: 14,
        }}
      >
        <h3 style={{ margin: 0, fontSize: "1.5rem" }}>Change Password</h3>
        {user.provider !== "LOCAL" ? (
          <p style={{ margin: 0 }}>
            Your account is authenticated via <strong>{user.provider}</strong>.
            Password is managed through that provider.
          </p>
        ) : (
          <form onSubmit={handlePasswordChange} style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 4 }} noValidate>
            {pwdError && (
              <div
                style={{
                  background: "#ffecec",
                  color: "#a94442",
                  padding: "8px 12px",
                  borderRadius: 6,
                  fontSize: 14,
                }}
              >
                {pwdError}
              </div>
            )}
            {pwdSuccess && (
              <div
                style={{
                  background: "#e6ffed",
                  color: "#1f7a3a",
                  padding: "8px 12px",
                  borderRadius: 6,
                  fontSize: 14,
                }}
              >
                {pwdSuccess}
              </div>
            )}
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <label htmlFor="current-password" style={{ fontWeight: 600, fontSize: 12, textTransform: "uppercase", letterSpacing: 1 }}>
                Current password
              </label>
              <input
                id="current-password"
                type="password"
                value={pwdState.currentPassword}
                onChange={(e) =>
                  setPwdState((s) => ({ ...s, currentPassword: e.target.value }))
                }
                required
                disabled={changing}
                autoComplete="current-password"
                style={{
                  padding: "10px 14px",
                  borderRadius: 8,
                  border: "1px solid #d1d9e6",
                  fontSize: 14,
                  outline: "none",
                }}
              />
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <label htmlFor="new-password" style={{ fontWeight: 600, fontSize: 12, textTransform: "uppercase", letterSpacing: 1 }}>
                New password
              </label>
              <input
                id="new-password"
                type="password"
                value={pwdState.newPassword}
                onChange={(e) =>
                  setPwdState((s) => ({ ...s, newPassword: e.target.value }))
                }
                required
                disabled={changing}
                autoComplete="new-password"
                minLength={8}
                style={{
                  padding: "10px 14px",
                  borderRadius: 8,
                  border: "1px solid #d1d9e6",
                  fontSize: 14,
                  outline: "none",
                }}
              />
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <label htmlFor="confirm-password" style={{ fontWeight: 600, fontSize: 12, textTransform: "uppercase", letterSpacing: 1 }}>
                Confirm new password
              </label>
              <input
                id="confirm-password"
                type="password"
                value={pwdState.confirmPassword}
                onChange={(e) =>
                  setPwdState((s) => ({ ...s, confirmPassword: e.target.value }))
                }
                required
                disabled={changing}
                autoComplete="new-password"
                minLength={8}
                style={{
                  padding: "10px 14px",
                  borderRadius: 8,
                  border: "1px solid #d1d9e6",
                  fontSize: 14,
                  outline: "none",
                }}
              />
            </div>
            <div>
              <button
                type="submit"
                disabled={changing}
                style={{
                  cursor: "pointer",
                  padding: "10px 18px",
                  border: "none",
                  borderRadius: 8,
                  background: "#6366f1",
                  color: "#fff",
                  fontWeight: 600,
                  fontSize: "0.95rem",
                  transition: "filter .2s ease",
                  marginTop: 4,
                }}
              >
                {changing ? "Changing..." : "Change Password"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
