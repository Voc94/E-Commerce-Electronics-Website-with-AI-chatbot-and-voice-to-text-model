// src/pages/OAuth2RedirectHandler.jsx
import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { setToken } from "../utils/auth.js";

export default function OAuth2RedirectHandler() {
  const navigate = useNavigate();

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get("token");
    if (token) {
      setToken(token);

      // remove token from the address bar to avoid leaking it in history
      window.history.replaceState({}, "", "/dashboard");

      navigate("/dashboard", { replace: true });
    } else {
      navigate("/login", { replace: true });
    }
  }, [navigate]);

  return <div>Processing login...</div>;
}
