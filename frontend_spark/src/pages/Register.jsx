// src/pages/Register.jsx
import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { setToken, isAuthenticated } from "../utils/auth.js";
import { AUTH, OAUTH2 } from "../config.js";
import "../css/pages/login.css";

const PersonIcon = ({ size = 64 }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 64 64"
    aria-hidden="true"
    focusable="false"
    style={{ display: "block" }}
  >
    <circle cx="32" cy="32" r="32" fill="#e2e8f0" />
    <path
      fill="#ffffff"
      d="M32 34c6.627 0 12-5.373 12-12S38.627 10 32 10s-12 5.373-12 12 5.373 12 12 12zm0 4c-8.837 0-16 4.463-16 9.98V54h32v-2.02C48 42.463 40.837 38 32 38z"
    />
  </svg>
);

function AvatarDisplay({ preview, name, size = 64 }) {
  const initial = name?.trim()?.[0]?.toUpperCase();
  const circleStyle = {
    width: size,
    height: size,
    borderRadius: "50%",
    background: "#6366f1",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: size * 0.5,
    color: "#fff",
    fontWeight: "700",
    userSelect: "none",
  };

  if (preview) {
    return (
      <div
        style={{
          width: size,
          height: size,
          borderRadius: "50%",
          overflow: "hidden",
          flexShrink: 0,
          background: "#f0f4f9",
          position: "relative",
        }}
      >
        <img
          src={preview}
          alt="avatar preview"
          style={{
            width: "100%",
            height: "100%",
            objectFit: "cover",
            display: "block",
          }}
          onError={(e) => {
            e.currentTarget.src = "/default-avatar.png";
          }}
        />
      </div>
    );
  } else if (initial) {
    return <div style={circleStyle}>{initial}</div>;
  } else {
    return (
      <div
        style={{
          width: size,
          height: size,
          borderRadius: "50%",
          background: "#f0f4f9",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
        }}
      >
        <PersonIcon size={size * 0.9} />
      </div>
    );
  }
}

const validateName = (name) => {
  if (!name.trim()) return "Name is required";
  if (name.trim().length < 2) return "Name must be at least 2 characters";
  return "";
};

const validateEmail = (email) => {
  if (!email.trim()) return "Email is required";
  const re = /^\S+@\S+\.\S+$/;
  if (!re.test(email.trim())) return "Invalid email format";
  return "";
};

const validatePassword = (pw) => {
  if (!pw) return "Password is required";
  if (pw.length < 8) return "Password must be at least 8 characters";
  return "";
};

export default function Register() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [imageFile, setImageFile] = useState(null);
  const [tempPreview, setTempPreview] = useState(null);
  const [fieldErrors, setFieldErrors] = useState({
    name: "",
    email: "",
    password: "",
  });
  const [serverError, setServerError] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [triedSubmit, setTriedSubmit] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    if (isAuthenticated()) {
      navigate("/dashboard", { replace: true });
    }
  }, [navigate]);

  const handleImageSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!["image/png", "image/jpeg"].includes(file.type)) {
      setServerError("Only PNG/JPEG allowed for profile image");
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setServerError("Image too large (max 2MB)");
      return;
    }
    setServerError(null);
    setImageFile(file);
    setTempPreview(URL.createObjectURL(file));
  };

  const clearImage = () => {
    setImageFile(null);
    setTempPreview(null);
  };

  const submit = async (e) => {
    e.preventDefault();
    if (submitting) return;
    setTriedSubmit(true);
    setServerError(null);

    const errors = {
      name: validateName(name),
      email: validateEmail(email),
      password: validatePassword(password),
    };
    setFieldErrors(errors);

    const hasErrors = Object.values(errors).some(Boolean);
    if (hasErrors) {
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        name: name.trim(),
        email: email.trim().toLowerCase(),
        password,
      };
      const res = await fetch(AUTH.REGISTER, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (
          body.error?.toLowerCase().includes("email already in use") ||
          body.error?.toLowerCase().includes("email already")
        ) {
          setFieldErrors((f) => ({ ...f, email: "Email already in use" }));
        } else {
          setServerError(body.error || "Registration failed");
        }
        return;
      }

      setToken(body.token);

      if (imageFile) {
        const form = new FormData();
        form.append("image", imageFile);
        const uploadRes = await fetch(AUTH.UPLOAD_IMAGE, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${body.token}`,
          },
          body: form,
        });
        if (!uploadRes.ok) {
          console.warn("Profile image upload failed during registration");
        }
      }

      navigate("/dashboard");
    } catch (err) {
      setServerError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="page login">
      <h2>Register</h2>
      {serverError && (
        <div className="error" role="alert" aria-live="assertive">
          {serverError}
        </div>
      )}
      <form
        onSubmit={submit}
        className="login-form"
        style={{ gap: 8 }}
        noValidate
        aria-describedby="form-error"
      >
        <div>
          <label htmlFor="name">Name</label>
          <input
            id="name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            minLength={2}
            autoComplete="name"
            disabled={submitting}
            aria-invalid={!!(triedSubmit && fieldErrors.name)}
            aria-describedby="name-error"
          />
          {triedSubmit && fieldErrors.name && (
            <div
              id="name-error"
              style={{ color: "#b91c1c", fontSize: 12, marginTop: 4 }}
            >
              {fieldErrors.name}
            </div>
          )}
        </div>
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
            aria-invalid={!!(triedSubmit && fieldErrors.email)}
            aria-describedby="email-error"
          />
          {triedSubmit && fieldErrors.email && (
            <div
              id="email-error"
              style={{ color: "#b91c1c", fontSize: 12, marginTop: 4 }}
            >
              {fieldErrors.email}
            </div>
          )}
        </div>
        <div>
          <label htmlFor="password">Password (min 8 chars)</label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={8}
            autoComplete="new-password"
            disabled={submitting}
            aria-invalid={!!(triedSubmit && fieldErrors.password)}
            aria-describedby="password-error"
          />
          {triedSubmit && fieldErrors.password && (
            <div
              id="password-error"
              style={{ color: "#b91c1c", fontSize: 12, marginTop: 4 }}
            >
              {fieldErrors.password}
            </div>
          )}
        </div>

        <div>
          <label>Profile Image (optional)</label>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              flexWrap: "wrap",
            }}
          >
            <AvatarDisplay preview={tempPreview} name={name} size={64} />
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <label
                  htmlFor="image-upload"
                  style={{
                    cursor: "pointer",
                    padding: "8px 14px",
                    background: "#6366f1",
                    color: "#fff",
                    borderRadius: 6,
                    fontSize: "0.9rem",
                    fontWeight: 600,
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                    border: "none",
                  }}
                >
                  {imageFile ? "Change image" : "Choose image"}
                  <input
                    id="image-upload"
                    type="file"
                    accept="image/png,image/jpeg"
                    onChange={handleImageSelect}
                    disabled={submitting}
                    style={{ display: "none" }}
                  />
                </label>
                {imageFile && (
                  <button
                    type="button"
                    aria-label="Remove selected image"
                    onClick={clearImage}
                    disabled={submitting}
                    style={{
                      background: "transparent",
                      border: "none",
                      cursor: "pointer",
                      fontSize: 18,
                      lineHeight: 1,
                      padding: 4,
                    }}
                  >
                    ×
                  </button>
                )}
              </div>
              <div style={{ fontSize: 12, color: "#555" }}>
                PNG or JPEG, max 2MB
              </div>
              {tempPreview && (
                <div style={{ fontSize: 12, color: "#555" }}>
                  Selected: {imageFile?.name}
                </div>
              )}
            </div>
          </div>
        </div>

        <button type="submit" className="primary" disabled={submitting}>
          {submitting ? "Registering..." : "Register"}
        </button>
      </form>

      <div className="oauth">
        <p>Or sign up with:</p>
        <div className="oauth-buttons">
          <button
            type="button"
            aria-label="Sign up with Google"
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
            <span>Sign up with Google</span>
          </button>

          <button
            type="button"
            aria-label="Sign up with GitHub"
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
            <span>Sign up with GitHub</span>
          </button>
        </div>
      </div>

      <p>
        Already have an account? <Link to="/login">Log in</Link>.
      </p>
    </div>
  );
}
