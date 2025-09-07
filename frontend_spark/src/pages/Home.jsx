import { Link, useNavigate } from "react-router-dom";
import { useEffect } from "react";
import { isAuthenticated } from "../utils/auth.js";
import "../css/pages/home.css";

export default function Home() {
  const navigate = useNavigate();

  useEffect(() => {
    if (isAuthenticated()) {
      navigate("/dashboard", { replace: true });
    }
  }, [navigate]);

  return (
    <div className="page home">
      <div className="hero">
        <div className="hero-content">
          <h1 className="hero-title">Welcome to Spark</h1>
          <p className="hero-subtitle">
            Securely log in or register, sync your profile picture, and manage
            your dashboard. OAuth with Google or GitHub is supported out of the box.
          </p>
          <div className="cta-buttons">
            <Link to="/login" className="btn-primary">
              Log In
            </Link>
            <Link to="/register" className="btn-secondary">
              Register
            </Link>
          </div>
          <div className="cta-note">
            Or go directly to your <Link to="/dashboard">dashboard</Link>.
          </div>
        </div>
        <div className="hero-graphic">
          {/* placeholder graphic or illustration */}
          <div
            style={{
              width: 220,
              height: 220,
              borderRadius: 16,
              background:
                "linear-gradient(135deg, rgba(99,102,241,0.2), rgba(99,102,241,0))",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 48,
              fontWeight: "700",
              color: "#6366f1",
              userSelect: "none",
            }}
          >
            ✨
          </div>
        </div>
      </div>

    </div>
  );
}
