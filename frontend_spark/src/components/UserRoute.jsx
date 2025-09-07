// src/components/UserRoute.jsx
import { useState, useEffect } from "react";
import { Navigate } from "react-router-dom";
import { isAuthenticated, fetchWithAuth, logout } from "../utils/auth";
import { API_BASE } from "../config";

export default function UserRoute({ children }) {
  const [status, setStatus] = useState({ loading: true, isUser: false });

  useEffect(() => {
    (async () => {
      if (!isAuthenticated()) {
        setStatus({ loading: false, isUser: false });
        return;
      }
      try {
        const res = await fetchWithAuth(`${API_BASE}/auth/me`);
        const user = await res.json();
        setStatus({ loading: false, isUser: user.role === "USER" });
      } catch {
        logout();
        setStatus({ loading: false, isUser: false });
      }
    })();
  }, []);

  if (status.loading) return <div>Loading...</div>;
  if (!status.isUser) return <Navigate to="/dashboard" replace />;
  return children;
}
