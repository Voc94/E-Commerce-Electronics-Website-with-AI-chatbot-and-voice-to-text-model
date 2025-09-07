import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { setToken, isAuthenticated } from "../utils/auth.js";
import { AUTH, OAUTH2 } from "../config.js";
import "../css/pages/login.css";

const validateEmail = (email) => {
  if (!email.trim()) return "Email is required";
  const re = /^\S+@\S+\.\S+$/;
  if (!re.test(email.trim())) return "Invalid email format";
  return "";
};

const validatePassword = (pw) => {
  if (!pw) return "Password is required";
  return "";
};

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fieldErrors, setFieldErrors] = useState({
    email: "",
    password: "",
  });
  const [serverError, setServerError] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    if (isAuthenticated()) {
      navigate("/dashboard", { replace: true });
    }
  }, [navigate]);

  useEffect(() => {
    setFieldErrors({
      email: validateEmail(email),
      password: validatePassword(password),
    });
  }, [email, password]);

  const isFormValid = !validateEmail(email) && !validatePassword(password);

  const submit = async (e) => {
    e.preventDefault();
    if (submitting) return;
    if (!isFormValid) return;
    setServerError(null);
    setSubmitting(true);
    try {
      const res = await fetch(AUTH.LOGIN, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.trim().toLowerCase(),
          password,
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (
          body.error?.toLowerCase().includes("invalid credentials") ||
          res.status === 401
        ) {
          setServerError("Invalid email or password");
        } else {
          setServerError(body.error || "Login failed");
        }
        return;
      }
      setToken(body.token);
      navigate("/dashboard");
    } catch (err) {
      setServerError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="page login">
      <h2>Login</h2>
      {serverError && (
        <div className="error" role="alert" aria-live="assertive">
          {serverError}
        </div>
      )}
      <form onSubmit={submit} className="login-form" noValidate>
        <div>
          <label htmlFor="email">Email</label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="username"
            disabled={submitting}
            aria-invalid={!!fieldErrors.email}
            aria-describedby="email-error"
          />
          {fieldErrors.email && (
            <div
              id="email-error"
              style={{ color: "#b91c1c", fontSize: 12, marginTop: 4 }}
            >
              {fieldErrors.email}
            </div>
          )}
        </div>
        <div>
          <label htmlFor="password">Password</label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete="current-password"
            disabled={submitting}
            aria-invalid={!!fieldErrors.password}
            aria-describedby="password-error"
          />
          {fieldErrors.password && (
            <div
              id="password-error"
              style={{ color: "#b91c1c", fontSize: 12, marginTop: 4 }}
            >
              {fieldErrors.password}
            </div>
          )}
        </div>
        <button
          type="submit"
          className="primary"
          disabled={submitting || !isFormValid}
        >
          {submitting ? "Logging in..." : "Login"}
        </button>
      </form>
      <div className="oauth">
        <p>Or login with:</p>
        <div className="oauth-buttons">
          <button
            type="button"
            aria-label="Sign in with Google"
            className="oauth-btn google"
            onClick={() => (window.location.href = OAUTH2.GOOGLE)}
          >
            <span className="icon" aria-hidden="true">
              <img
                alt=""
                src="data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 46 46'><path fill='%234285F4' d='M23 20.5h11.3c-.5 2.5-2.2 4.6-4.5 5.7v4.7h7.3c4.3-4 6.8-10 6.8-16.9 0-1.1-.1-2.1-.3-3.1H23v6.3z'/><path fill='%2334A853' d='M23 26.5c1.9 0 3.6-.6 5-1.6l-5-4.1-5 4.1c1.4 1 3.1 1.6 5 1.6z'/><path fill='%23FBBC05' d='M17.9 22.9l-5-4.1c-1.1 2.2-1.1 4.8 0 7l5-4.1z'/><path fill='%23EA4335' d='M23 16.5c1.3 0 2.5.5 3.4 1.4l4.9-4.9C29.1 11 26.4 9.5 23 9.5c-3.4 0-6.1 1.5-8.3 3.9l4.9 4.9c.9-1 2.1-1.9 3.4-1.9z'/></svg>"
                style={{ width: 18, height: 18 }}
              />
            </span>
            <span>Google</span>
          </button>
          <button
            type="button"
            aria-label="Sign in with GitHub"
            className="oauth-btn github"
            onClick={() => (window.location.href = OAUTH2.GITHUB)}
          >
            <span className="icon" aria-hidden="true">
              <img
                alt=""
                src="data:image/svg+xml;utf8,<svg aria-hidden='true' height='16' viewBox='0 0 16 16' version='1.1' width='16' xmlns='http://www.w3.org/2000/svg'><path fill='%23ffffff' fill-rule='evenodd' d='M8 0C3.58 0 0 3.58 0 8a8 8 0 005.47 7.59c.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2 .37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82a7.7 7.7 0 012-.27c.68.003 1.36.092 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8 8 0 0016 8c0-4.42-3.58-8-8-8z'/></svg>"
                style={{ width: 18, height: 18 }}
              />
            </span>
            <span>GitHub</span>
          </button>
        </div>
      </div>

      <p>
        Don't have an account? <Link to="/register">Register</Link>.
      </p>
    </div>
  );
}
