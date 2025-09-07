// src/config.js
export const USER_API_BASE  = process.env.REACT_APP_USER_API_BASE  || "http://localhost:8080";
export const STORE_API_BASE = process.env.REACT_APP_STORE_API_BASE || "http://localhost:8081";
export const VOICE_API_BASE = process.env.REACT_APP_VOICE_API_BASE || "http://localhost:8082"; // 👈 ASR service

// kept for backwards compatibility / existing auth/user code
export const API_BASE = USER_API_BASE;

export const AUTH = {
  LOGIN:        `${USER_API_BASE}/auth/login`,
  REGISTER:     `${USER_API_BASE}/auth/register`,
  ME:           `${USER_API_BASE}/auth/me`,
  UPLOAD_IMAGE: `${USER_API_BASE}/auth/me/image`,
  GET_IMAGE:    `${USER_API_BASE}/auth/me/image`,
};

export const OAUTH2 = {
  GOOGLE: `${USER_API_BASE}/oauth2/authorize/google`,
  GITHUB: `${USER_API_BASE}/oauth2/authorize/github`,
};

export const BRAND = {
  BASE: STORE_API_BASE,
  LIST: (q = "") =>
    q && q.trim()
      ? `${STORE_API_BASE}/brands?q=${encodeURIComponent(q.trim())}`
      : `${STORE_API_BASE}/brands`,
};

export const BRAND_REQUESTS = {
  LIST: (status = "") =>
    status && status.trim()
      ? `${STORE_API_BASE}/brands/requests?status=${encodeURIComponent(status.trim())}`
      : `${STORE_API_BASE}/brands/requests`,
  APPROVE:  (id) => `${STORE_API_BASE}/brands/requests/${id}/approve`,
  REJECT:   (id) => `${STORE_API_BASE}/brands/requests/${id}/reject`,
  MINE:     ()   => `${STORE_API_BASE}/brands/requests/mine`,
  LOGO_PUT: (id) => `${STORE_API_BASE}/brands/requests/${id}/logo`,
  LOGO_GET: (id) => `${STORE_API_BASE}/brands/requests/${id}/logo`,
};

// 🎙 Voice/ASR endpoints on :8082
export const VOICE = {
  STT: `${VOICE_API_BASE}/api/voice/stt`, // multipart "audio" = 16k mono PCM16 WAV
};

export const NLP_API_BASE = process.env.REACT_APP_NLP_API_BASE || VOICE_API_BASE;

export const NLP = {
  CLASSIFY: `${NLP_API_BASE}/nlp/classify`,
};
export const AGENTS_API_BASE = NLP_API_BASE; // alias

export const ADMIN_REQUESTS = {
  CREATE:   `${AGENTS_API_BASE}/api/admin-requests`,
  AWAITING: `${AGENTS_API_BASE}/api/admin-requests/awaiting`,
  ACCEPT:   (id) => `${AGENTS_API_BASE}/api/admin-requests/${id}/accept`,
};
// config.js (snippet)
export const WS_HTTP_FROM_AGENTS = () =>
  import.meta.env.VITE_WS_AGENTS || "http://localhost:8082/ws";
