// src/components/ChatSupport.jsx
// NOTE: requires in UI:  npm i @stomp/stompjs sockjs-client

import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { NLP, API_BASE, ADMIN_REQUESTS, WS_HTTP_FROM_AGENTS } from "../config.js";
import {
  fetchWithAuth,
  isAuthenticated,
  getToken as getAuthToken,
  getJwtPayload, // 👈 uses JWT to know myId ASAP
} from "../utils/auth.js";
import { Client as StompClient } from "@stomp/stompjs";
import SockJS from "sockjs-client";

// ------- utils -------
function uuid() {
  const g = typeof window !== "undefined" ? window : {};
  if (g.crypto?.randomUUID) return g.crypto.randomUUID();
  if (g.crypto?.getRandomValues) {
    const b = new Uint8Array(16);
    g.crypto.getRandomValues(b);
    b[6] = (b[6] & 0x0f) | 0x40;
    b[8] = (b[8] & 0x3f) | 0x80;
    const hex = Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("");
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

// CRA-safe base for SPA link absolutizing
const BASE =
  (typeof window !== "undefined" &&
    (process.env.REACT_APP_LINK_BASE || window.location.origin)) ||
  "";

// use SPA navigation for internal links
function absolutize(link) {
  try {
    if (!link) return null;
    return new URL(link, BASE).toString();
  } catch {
    return link;
  }
}
function isExternal(link) {
  try {
    const abs = new URL(link, BASE);
    const cur = new URL(window.location.href);
    return abs.origin !== cur.origin;
  } catch {
    return false;
  }
}

function ChatIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M4 4h16v10a2 2 0 0 1-2 2H9l-5 5v-5H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Z"
        fill="currentColor"
      />
    </svg>
  );
}

// ---- token from your auth util (jwt_token) with small fallbacks
function getAccessToken() {
  try {
    return (
      getAuthToken() || // TOKEN_KEY = "jwt_token"
      localStorage.getItem("jwt_token") ||
      sessionStorage.getItem("jwt_token") ||
      ""
    );
  } catch {
    return "";
  }
}

// Ensure SockJS URL ends with /ws, tolerant of WS_HTTP_FROM_AGENTS in CRA
function wsUrl() {
  try {
    const raw =
      typeof WS_HTTP_FROM_AGENTS === "function" ? WS_HTTP_FROM_AGENTS() : WS_HTTP_FROM_AGENTS;
    if (raw) return raw.endsWith("/ws") ? raw : raw.replace(/\/+$/, "") + "/ws";
  } catch {}
  try {
    const u = new URL(ADMIN_REQUESTS.CREATE, window.location.href);
    return `${u.protocol}//${u.host}/ws`;
  } catch {}
  return "http://localhost:8082/ws";
}

export default function ChatSupport() {
  // mode: "bot" (NLP), "waiting" (escalated, awaiting admin accept), "admin" (live chat)
  const [mode, setMode] = useState("bot");
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState(() => {
    try {
      const raw = sessionStorage.getItem("chatSupport_history");
      const arr = JSON.parse(raw || "[]");
      return Array.isArray(arr) ? arr : [];
    } catch {
      return [];
    }
  });
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [unread, setUnread] = useState(0);
  const [error, setError] = useState("");
  const [requestId, setRequestId] = useState(null);
  const [adminReady, setAdminReady] = useState(false);
  const [myId, setMyId] = useState(null); // who am I (for dedupe)

  const authed = isAuthenticated();
  const listRef = useRef(null);
  const navigate = useNavigate();

  // STOMP client & subscriptions
  const stompRef = useRef(null);
  const subsRef = useRef({}); // { key: unsubscribeFn }
  const seenIdsRef = useRef(new Set()); // dedupe by server message id
  const lastLocalRef = useRef(null); // { clientId, text, ts } to match server echo quickly

  // persist history
  useEffect(() => {
    try {
      sessionStorage.setItem("chatSupport_history", JSON.stringify(messages));
    } catch {}
  }, [messages]);

  // unread badge
  useEffect(() => {
    if (open) setUnread(0);
  }, [open]);
  useEffect(() => {
    if (!open && messages.at(-1)?.role !== "user") setUnread((u) => u + 1);
  }, [messages, open]);

  // autoscroll
  useEffect(() => {
    if (!open) return;
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [open, messages, sending, mode, adminReady]);

  // Set myId ASAP from JWT so we can dedupe/replace echoes immediately
  useEffect(() => {
    const p = getJwtPayload?.();
    if (p?.id) setMyId(p.id);
  }, []);

  // who am I (optional: confirm via API)
  useEffect(() => {
    if (!authed) return;
    (async () => {
      try {
        const res = await fetchWithAuth(`${API_BASE}/auth/me`);
        if (res.ok) {
          const me = await res.json();
          setMyId(me.id);
        }
      } catch {}
    })();
  }, [authed]);

  // teardown WS on unmount
  useEffect(() => {
    return () => {
      disconnectStomp();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ------------- WS helpers -------------
  function disconnectStomp() {
    try {
      Object.values(subsRef.current).forEach((unsub) => {
        try {
          unsub?.();
        } catch {}
      });
      subsRef.current = {};
      stompRef.current?.deactivate();
    } catch {}
    stompRef.current = null;
  }

  function ensureStompConnected(onConnected) {
    const token = getAccessToken();
    if (!token) {
      setError("No token found (jwt_token). Please log in.");
      return;
    }

    if (stompRef.current?.connected) {
      onConnected?.(stompRef.current);
      return;
    }

    const sockUrl = wsUrl(); // http(s)://host:8082/ws
    const client = new StompClient({
      webSocketFactory: () => new SockJS(sockUrl),
      connectHeaders: {
        Authorization: `Bearer ${token}`,
        access_token: token,
        token,
      },
      onConnect: () => onConnected?.(client),
      onStompError: (frame) => {
        console.error("STOMP error", frame?.headers, frame?.body);
        setError(frame?.headers?.message || "Live chat connection error");
      },
      debug: () => {},
      reconnectDelay: 3000,
    });

    stompRef.current = client;
    client.activate();
  }

  function subscribeOnce(key, dest, handler) {
    if (!stompRef.current?.connected || subsRef.current[key]) return;
    const sub = stompRef.current.subscribe(dest, (msg) => {
      try {
        const payload = JSON.parse(msg.body || "{}");
        handler(payload);
      } catch {
        handler({ raw: msg.body });
      }
    });
    subsRef.current[key] = () => sub.unsubscribe();
  }

  // ------------- server calls -------------
  const topN = (scores = {}, n = 3) => {
    const entries = Object.entries(scores);
    entries.sort((a, b) => b[1] - a[1]);
    return entries
      .slice(0, n)
      .map(([k, v]) => `${k} ${(v * 100).toFixed(1)}%`)
      .join(", ");
  };

  async function ensureAdminRequest(initialMessage) {
    // Who am I (:8080)
    const meRes = await fetchWithAuth(`${API_BASE}/auth/me`);
    if (!meRes.ok) throw new Error("Not authenticated");
    const me = await meRes.json();
    setMyId(me.id); // store for dedupe

    // Create/reuse request (:8082)
    const res = await fetchWithAuth(ADMIN_REQUESTS.CREATE, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: me.id, initialMessage }),
    });
    if (!res.ok) throw new Error(await res.text());
    return await res.json(); // { id, status, ... }
  }

  // ------------- send flow -------------
  const send = async () => {
    const text = input.trim();
    if (!text || sending) return;
    setError("");
    setInput("");
    setSending(true);

    try {
      // If we’re already in admin mode → send over WS with optimistic bubble
      if (mode === "admin") {
        if (!stompRef.current?.connected || !requestId) {
          throw new Error("Live chat not connected");
        }

        const clientId = uuid();
        lastLocalRef.current = { clientId, text, ts: Date.now() };

        // Optimistic bubble; will be replaced when echo arrives
        setMessages((m) => [
          ...m,
          { id: clientId, role: "user", text, t: Date.now(), pending: true },
        ]);

        stompRef.current.publish({
          destination: `/app/chat/${requestId}`,
          // server may or may not echo clientId; client handles both cases
          body: JSON.stringify({ body: text, clientId }),
        });
        setSending(false);
        return;
      }

      // If escalation pending → block sends but keep UI tidy
      if (mode === "waiting") {
        setMessages((m) => [
          ...m,
          {
            id: uuid(),
            role: "bot",
            t: Date.now(),
            text: "Waiting for an admin to accept your request…",
          },
        ]);
        setSending(false);
        return;
      }

      // BOT/NLP mode
      // Optimistic user bubble (no WS duplicates in this mode)
      setMessages((m) => [...m, { id: uuid(), role: "user", text, t: Date.now() }]);

      const res = await fetchWithAuth(NLP.CLASSIFY, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: null, message: text }),
      });

      if (res.status === 401) {
        setError("Please log in to use chat support.");
        setMessages((m) => [
          ...m,
          {
            id: uuid(),
            role: "bot",
            text: "You’re not logged in. Please sign in and try again.",
            t: Date.now(),
          },
        ]);
        return;
      }

      if (!res.ok) {
        const txt = await res.text();
        throw new Error(txt || `HTTP ${res.status}`);
      }

      const data = await res.json();

      // NEW SHAPE: { message, link?, adminIssued? }
      if (typeof data.message === "string" && ("adminIssued" in data || "link" in data)) {
        const linkForMsg = data.adminIssued ? null : data.link || null;
        const absolute = linkForMsg ? absolutize(linkForMsg) : null;

        setMessages((m) => [
          ...m,
          {
            id: uuid(),
            role: "bot",
            t: Date.now(),
            text: data.message || "",
            link: linkForMsg,
            linkAbs: absolute,
            admin: !!data.adminIssued,
            raw: data,
          },
        ]);

        if (data.adminIssued) {
          try {
            // Create admin request
            const req = await ensureAdminRequest(text);
            setRequestId(req.id);
            setMode("waiting");

            // Connect WS, wait for "accepted", then start piping chat messages
            ensureStompConnected(() => {
              // 1) status / events of this request
              subscribeOnce(`req.${req.id}.events`, `/topic/support/requests/${req.id}`, (ev) => {
                const type = (ev?.type || "").toString().toLowerCase();
                const status = (ev?.status || "").toString().toLowerCase();

                if (type.includes("accept") || status.includes("accept")) {
                  setAdminReady(true);
                  setMode("admin");
                  setMessages((m) => [
                    ...m,
                    {
                      id: uuid(),
                      role: "bot",
                      t: Date.now(),
                      text: "An admin joined the chat. You can continue here.",
                      admin: true,
                    },
                  ]);
                }

                // Proper close event from server
                if (type.includes("close") || status.includes("close")) {
                  setMessages((m) => [
                    ...m,
                    {
                      id: uuid(),
                      role: "bot",
                      t: Date.now(),
                      text: "The admin closed this chat.",
                      admin: true,
                    },
                  ]);
                  setAdminReady(false);
                  setMode("bot");
                  setRequestId(null);
                  disconnectStomp();
                }

                // 👇 NEW: presence signal — admin disconnected (not a formal close)
                if (type === "disconnected" || type.includes("disconnect")) {
                  const who = (ev?.who || "").toString().toUpperCase();
                  if (who === "ADMIN" || !who) {
                    setMessages((m) => [
                      ...m,
                      {
                        id: uuid(),
                        role: "bot",
                        t: Date.now(),
                        text: "Admin disconnected. You’re back with the assistant.",
                        admin: true,
                      },
                    ]);
                    setAdminReady(false);
                    setMode("bot");
                    setRequestId(null);
                    disconnectStomp();
                  }
                }
              });

              // 2) inbound messages for THIS user (delivered to user queue)
              subscribeOnce(`req.${req.id}.msg`, `/user/queue/chat/${req.id}`, (payload) => {
                // Support both shapes: {message, clientId} or raw ChatMessage
                const msg = payload?.message ?? payload ?? {};
                const clientId = payload?.clientId ?? msg?.clientId ?? null;

                // Extract sender, id, text
                const senderId =
                  msg?.senderId ?? msg?.sender?.id ?? msg?.fromUserId ?? null;
                const mid = msg?.id || null;
                const incomingText = msg?.text ?? msg?.body ?? "";

                // DEDUPE by server id (hard)
                if (mid && seenIdsRef.current.has(mid)) return;
                if (mid) seenIdsRef.current.add(mid);

                // Determine if this is likely *my* echo:
                const recentlySent =
                  lastLocalRef.current &&
                  incomingText === lastLocalRef.current.text &&
                  Date.now() - lastLocalRef.current.ts < 20000;

                const looksMine =
                  (myId && senderId && senderId === myId) || // explicit by sender
                  (clientId && lastLocalRef.current && clientId === lastLocalRef.current.clientId) || // echoing our clientId back
                  (!senderId && recentlySent); // fallback by text+time if senderId missing

                // If first message arrives before we saw 'accepted', flip to admin mode now.
                if (mode !== "admin") {
                  setMode("admin");
                  setAdminReady(true);
                }

                if (looksMine) {
                  // Replace the optimistic bubble if we can find it; otherwise drop the echo
                  setMessages((m) => {
                    const copy = [...m];

                    // A) best: match by clientId
                    if (clientId) {
                      const i = copy.findIndex(
                        (x) => x.id === clientId && x.role === "user"
                      );
                      if (i !== -1) {
                        copy[i] = { ...copy[i], id: mid || copy[i].id, pending: false };
                        return copy;
                      }
                    }

                    // B) fallback: last pending user msg with same text
                    for (let i = copy.length - 1; i >= 0; i--) {
                      const x = copy[i];
                      if (x.role === "user" && x.pending && x.text === incomingText) {
                        copy[i] = { ...x, id: mid || x.id, pending: false };
                        return copy;
                      }
                    }

                    // C) last fallback: if we very recently sent the same text, ignore server copy
                    if (recentlySent) return copy;

                    // If we couldn't match anything, safest is to ignore echo to prevent duplicates
                    return copy;
                  });
                  return;
                }

                // Not my echo → show as admin message
                setMessages((m) => [
                  ...m,
                  {
                    id: mid || uuid(),
                    role: "bot", // inbound to the user is from the admin
                    t: Date.now(),
                    text: incomingText,
                    admin: true,
                  },
                ]);
              });

              // let admin know the user is ready (optional)
              try {
                stompRef.current?.publish({
                  destination: `/app/support/requests/${req.id}/ready`,
                  body: JSON.stringify({ type: "USER_READY" }),
                });
              } catch {}
            });
          } catch (e) {
            console.error(e);
            setError(e?.message || "Could not start admin chat");
          }
        }
      } else {
        // OLD SHAPE (fallback)
        const catScores = data.categoryScores || data.catScores || {};
        const intScores = data.intentScores || {};
        const summary =
          `Category: ${data.category ?? "?"}\n` +
          `Top: ${topN(catScores)}\n\n` +
          `Intent: ${data.intent ?? "?"}\n` +
          `Top: ${topN(intScores)}`;
        setMessages((m) => [
          ...m,
          {
            id: uuid(),
            role: "bot",
            text: summary,
            t: Date.now(),
            raw: data,
          },
        ]);
      }
    } catch (e) {
      console.error(e);
      setError(e?.message || "Failed to send message");
      setMessages((m) => [
        ...m,
        { id: uuid(), role: "bot", text: "Server error. Try again.", t: Date.now() },
      ]);
    } finally {
      setSending(false);
    }
  };

  const handleKey = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  };

  const handleOpen = (e, link) => {
    if (!link) return;
    try {
      const abs = new URL(link, BASE);
      const cur = new URL(window.location.href);
      const sameOrigin = abs.origin === cur.origin;
      if (sameOrigin) {
        e.preventDefault();
        const pathWithQuery = abs.pathname + abs.search + abs.hash;
        navigate(pathWithQuery);
        setOpen(false);
      }
    } catch {
      if (link.startsWith("/")) {
        e.preventDefault();
        navigate(link);
        setOpen(false);
      }
    }
  };

  function clearHistory() {
    try {
      sessionStorage.removeItem("chatSupport_history");
    } catch {}
    seenIdsRef.current = new Set();
    lastLocalRef.current = null;
    setMessages([]);
    setError("");
    setInput("");
    setRequestId(null);
    setAdminReady(false);
    setMode("bot");
    setMyId(null);
    disconnectStomp();
  }

  const disabled = sending || !authed || mode === "waiting";

  const containerStyle = useMemo(
    () => ({
      position: "fixed",
      right: 20,
      bottom: 20,
      zIndex: 1000,
    }),
    []
  );

  const fabStyle = useMemo(
    () => ({
      position: "relative",
      width: 56,
      height: 56,
      borderRadius: "50%",
      background: "#6366f1",
      color: "#fff",
      border: "none",
      boxShadow: "0 12px 28px rgba(0,0,0,0.15)",
      cursor: "pointer",
      display: "inline-flex",
      alignItems: "center",
      justifyContent: "center",
      lineHeight: 0,
    }),
    []
  );

  const panelStyle = useMemo(
    () => ({
      width: 360,
      maxWidth: "92vw",
      height: 460,
      background: "#0b141f",
      color: "#e6edf3",
      borderRadius: 14,
      border: "1px solid rgba(255,255,255,0.08)",
      boxShadow: "0 20px 50px rgba(0,0,0,.5)",
      display: "grid",
      gridTemplateRows: "48px 1fr auto",
      overflow: "hidden",
      fontFamily:
        '-apple-system, system-ui, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
    }),
    []
  );

  return (
    <div style={containerStyle}>
      {!open ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Open support chat"
          style={fabStyle}
          title="Chat with us"
        >
          <ChatIcon />
          {unread > 0 && (
            <span
              style={{
                position: "absolute",
                top: -4,
                right: -4,
                background: "#ef4444",
                color: "#fff",
                borderRadius: 999,
                fontSize: 12,
                fontWeight: 900,
                padding: "2px 6px",
                border: "2px solid #0b141f",
              }}
            >
              {unread}
            </span>
          )}
        </button>
      ) : (
        <div style={panelStyle}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "0 10px",
              borderBottom: "1px solid rgba(255,255,255,0.08)",
              fontWeight: 800,
              fontSize: 14,
              background: "#0f172a",
              height: 48,
            }}
          >
            <span>
              Support
              {mode === "waiting" && " • requesting admin…"}
              {mode === "admin" && (adminReady ? " • live" : " • connecting…")}
            </span>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              {!authed && <span style={{ fontSize: 12, color: "#fbbf24" }}>login required</span>}
              <button
                onClick={clearHistory}
                aria-label="Clear chat"
                title="Clear chat"
                style={{
                  border: "1px solid #334155",
                  background: "#111827",
                  color: "#e6edf3",
                  cursor: "pointer",
                  fontSize: 12,
                  padding: "6px 8px",
                  borderRadius: 8,
                }}
              >
                Clear
              </button>
              <button
                onClick={() => setOpen(false)}
                aria-label="Close"
                style={{
                  border: "none",
                  background: "transparent",
                  color: "#e6edf3",
                  cursor: "pointer",
                  fontSize: 18,
                  lineHeight: 1,
                }}
              >
                ×
              </button>
            </div>
          </div>

          {/* messages list — compact */}
          <div
            ref={listRef}
            style={{
              padding: "8px 10px",
              overflowY: "auto",
              display: "grid",
              gap: 6,
              background: "#0b141f",
              alignContent: "start",
            }}
          >
            {messages.length === 0 && (
              <div style={{ opacity: 0.7, fontSize: 13, lineHeight: 1.25 }}>
                Hi! Send a message and I’ll classify it and route you. If an admin is
                needed, we’ll keep chatting here — no redirects.
              </div>
            )}
            {messages.map((m) => (
              <div
                key={m.id}
                style={{
                  justifySelf: m.role === "user" ? "end" : "start",
                  maxWidth: "85%",
                  padding: "6px 10px",
                  borderRadius: 12,
                  whiteSpace: "pre-wrap",
                  wordBreak: "break-word",
                  fontSize: 13,
                  lineHeight: 1.25,
                  background: m.role === "user" ? "#4f46e5" : "#111827",
                  color: "#fff",
                  boxShadow: "0 2px 6px rgba(0,0,0,0.18)",
                  opacity: m.pending ? 0.7 : 1, // subtle hint when pending
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <span>{m.text}</span>
                  {m.admin && (
                    <span
                      title="admin"
                      style={{
                        fontSize: 10,
                        fontWeight: 800,
                        padding: "2px 6px",
                        borderRadius: 999,
                        background: "#ef4444",
                        color: "#fff",
                        whiteSpace: "nowrap",
                      }}
                    >
                      ADMIN
                    </span>
                  )}
                </div>

                {/* optional CTA (only when NOT escalating) */}
                {m.link && mode === "bot" && (
                  <div style={{ marginTop: 8 }}>
                    {(() => {
                      const abs = m.linkAbs || absolutize(m.link);
                      const external = isExternal(m.link);
                      return (
                        <a
                          href={abs}
                          onClick={(e) => handleOpen(e, m.link)}
                          target={external ? "_blank" : "_self"}
                          rel="noreferrer"
                          style={{
                            display: "inline-block",
                            padding: "6px 10px",
                            borderRadius: 8,
                            border: "1px solid #6366f1",
                            background: "#1f2240",
                            color: "#fff",
                            fontWeight: 700,
                            textDecoration: "none",
                          }}
                        >
                          Open
                        </a>
                      );
                    })()}
                  </div>
                )}
              </div>
            ))}
          </div>

          <div
            style={{
              padding: 10,
              display: "flex",
              gap: 8,
              borderTop: "1px solid rgba(255,255,255,0.08)",
              background: "#0f172a",
            }}
          >
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKey}
              placeholder={
                authed
                  ? mode === "waiting"
                    ? "Waiting for an admin to accept…"
                    : "Type your message…"
                  : "Login to use chat support…"
              }
              disabled={disabled}
              style={{
                flex: 1,
                padding: "10px 12px",
                borderRadius: 10,
                border: "1px solid #1f2937",
                outline: "none",
                background: "#0b1220",
                color: "#e6edf3",
                fontSize: 14,
              }}
            />
            <button
              onClick={send}
              disabled={disabled}
              style={{
                padding: "10px 14px",
                borderRadius: 10,
                border: "1px solid #6366f1",
                background: disabled ? "#374151" : "#6366f1",
                color: "#fff",
                fontWeight: 800,
                cursor: disabled ? "not-allowed" : "pointer",
              }}
              title={!authed ? "Please log in" : mode === "waiting" ? "Awaiting admin" : "Send"}
            >
              {sending ? "…" : "Send"}
            </button>
          </div>

          {error && (
            <div
              style={{
                position: "absolute",
                bottom: 4,
                right: 8,
                fontSize: 12,
                color: "#fecaca",
              }}
            >
              {error}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
