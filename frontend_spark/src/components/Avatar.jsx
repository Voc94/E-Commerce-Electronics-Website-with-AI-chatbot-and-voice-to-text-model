// src/components/Avatar.jsx
import { useEffect, useState } from "react";
import { fetchWithAuth } from "../utils/auth.js";
import { AUTH } from "../config.js";

export default function Avatar({ imageUrl, size = 64, alt, name }) {
  const [src, setSrc] = useState("/default-avatar.png");
  const displayName = (name || alt || "").trim();
  const initial = displayName ? displayName[0].toUpperCase() : "";

  useEffect(() => {
    let cancelled = false;
    let objectUrl; // for blob URL

    const cleanup = () => {
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
        objectUrl = null;
      }
    };

    if (!imageUrl) {
      setSrc("/default-avatar.png");
      return () => {
        cancelled = true;
        cleanup();
      };
    }

    const isLocalSentinel =
      imageUrl.startsWith(AUTH.GET_IMAGE) ||
      imageUrl === AUTH.GET_IMAGE ||
      imageUrl.startsWith(`${window.location.origin}/auth/me/image`);

    if (isLocalSentinel) {
      (async () => {
        try {
          const res = await fetchWithAuth(imageUrl);
          if (!res.ok) throw new Error("failed to fetch local avatar");
          const blob = await res.blob();
          objectUrl = URL.createObjectURL(blob);
          if (!cancelled) setSrc(objectUrl);
        } catch (e) {
          console.warn("Avatar load error:", e);
          if (!cancelled) setSrc("/default-avatar.png");
        }
      })();
    } else {
      // remote (Google/GitHub) public URL
      setSrc(imageUrl);
    }

    return () => {
      cancelled = true;
      cleanup();
    };
  }, [imageUrl]);

  // If no real image and we have a name/alt, show initial instead of img
  const isFallbackImage = src === "/default-avatar.png" || !src;
  if (isFallbackImage && initial) {
    return (
      <div
        aria-label={displayName}
        title={displayName}
        style={{
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
          flexShrink: 0,
        }}
      >
        {initial}
      </div>
    );
  }

  // final image render (either fetched or default avatar)
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        overflow: "hidden",
        flexShrink: 0,
        background: "#f0f2f7",
        display: "inline-block",
      }}
    >
      <img
        src={src}
        alt={alt || displayName || "avatar"}
        width={size}
        height={size}
        style={{ objectFit: "cover", display: "block" }}
        onError={() => setSrc("/default-avatar.png")}
      />
    </div>
  );
}
