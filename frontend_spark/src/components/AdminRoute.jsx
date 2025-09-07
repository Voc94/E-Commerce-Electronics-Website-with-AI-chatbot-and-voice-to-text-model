// src/components/AdminRoute.jsx
import { useState, useEffect } from "react";
import { Navigate } from "react-router-dom";
import { isAuthenticated, fetchWithAuth, logout } from "../utils/auth.js";
import { API_BASE } from "../config.js";

export default function AdminRoute({ children }) {
  const [status, setStatus] = useState({ loading: true, isAdmin: false });

  useEffect(() => {
    (async () => {
      if (!isAuthenticated()) {
        setStatus({ loading: false, isAdmin: false });
        return;
      }
      try {
        const res = await fetchWithAuth(`${API_BASE}/auth/me`);
        if (!res.ok) {
          logout();
          setStatus({ loading: false, isAdmin: false });
          return;
        }
        const user = await res.json();
        setStatus({ loading: false, isAdmin: user.role === "ADMIN" });
      } catch (e) {
        console.warn("AdminRoute fetch failed", e);
        setStatus({ loading: false, isAdmin: false });
      }
    })();
  }, []);

  if (status.loading) return <div>Loading...</div>;
  if (!isAuthenticated() || !status.isAdmin) {
    return <Navigate to="/dashboard" replace />;
  }
  return children;
}
