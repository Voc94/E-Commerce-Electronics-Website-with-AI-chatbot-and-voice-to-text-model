import { useState, useEffect } from "react";
import Avatar from "./Avatar.jsx";
import { fetchWithAuth } from "../utils/auth.js";
import { AUTH } from "../config.js";

export default function ProfileImageUploader({ currentUrl, onUpdate, size = 64, name }) {
  const [localFile, setLocalFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState(null);
  const [remoteUrl, setRemoteUrl] = useState(currentUrl);

  useEffect(() => {
    if (!localFile) {
      setRemoteUrl(currentUrl);
    }
  }, [currentUrl, localFile]);

  // object URL for preview when selecting new file
  const [objectUrl, setObjectUrl] = useState(null);
  useEffect(() => {
    if (localFile) {
      const url = URL.createObjectURL(localFile);
      setObjectUrl(url);
      return () => {
        URL.revokeObjectURL(url);
        setObjectUrl(null);
      };
    } else {
      setObjectUrl(null);
    }
  }, [localFile]);

  const preview = objectUrl
    ? objectUrl
    : remoteUrl
    ? remoteUrl
    : "/default-avatar.png";

  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!["image/png", "image/jpeg"].includes(file.type)) {
      setError("Only PNG/JPEG allowed");
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setError("Max 2MB");
      return;
    }
    setError(null);
    setLocalFile(file);
    setUploading(true);
    try {
      const form = new FormData();
      form.append("image", file);
      const res = await fetchWithAuth(AUTH.UPLOAD_IMAGE, {
        method: "POST",
        body: form,
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "Upload failed");
      }
      const body = await res.json();
      onUpdate && onUpdate(body.imageUrl);
      setLocalFile(null); // clear local to reflect stored version
    } catch (err) {
      setError(err.message);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="profile-uploader" style={{ marginBottom: 8 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <Avatar imageUrl={preview} size={size} alt={name || "avatar"} />
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <label
            style={{
              cursor: "pointer",
              padding: "6px 12px",
              borderRadius: 6,
              background: "#eef2fd",
              fontSize: 14,
              display: "inline-block",
              fontWeight: 600,
            }}
          >
            Change image
            <input
              type="file"
              accept="image/png,image/jpeg"
              onChange={handleFile}
              style={{ display: "none" }}
              disabled={uploading}
            />
          </label>
          {uploading && (
            <div style={{ fontSize: 12, color: "#555" }}>Uploading...</div>
          )}
          {error && (
            <div style={{ color: "crimson", fontSize: 12 }}>{error}</div>
          )}
        </div>
      </div>
    </div>
  );
}
