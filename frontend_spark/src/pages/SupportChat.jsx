// src/pages/SupportChat.jsx
// Requires: npm i @stomp/stompjs sockjs-client
import { useEffect, useRef, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { API_BASE, WS_HTTP_FROM_AGENTS } from "../config.js";
import { fetchWithAuth, isAuthenticated, getToken } from "../utils/auth.js";
import { Client as StompClient } from "@stomp/stompjs";
import SockJS from "sockjs-client";

// Ensure SockJS URL ends with /ws; fallback to localhost
function wsUrl() {
  try {
    const base =
      (typeof WS_HTTP_FROM_AGENTS === "function" ? WS_HTTP_FROM_AGENTS() : WS_HTTP_FROM_AGENTS) ||
      "";
    const u = base || "http://localhost:8082/ws";
    return u.endsWith("/ws") ? u : u.replace(/\/+$/, "") + "/ws";
  } catch {
    return "http://localhost:8082/ws";
  }
}

function normText(s) {
  return (s ?? "").toString().trim().replace(/\s+/g, " ");
}

function uuid() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function pickClientId(p) {
  // Try a few common keys in case backend maps it differently
  return (
    p.clientId ??
    p.client_id ??
    p.clientMID ??
    p.clientMid ??
    p.tempId ??
    p.localId ??
    null
  );
}

export default function SupportChat() {
  // route: /admin/support/chat/:requestId  OR /support/chat/:requestId
  const { requestId } = useParams();
  const navigate = useNavigate();

  const [me, setMe] = useState(null);
  const [msgs, setMsgs] = useState([]);
  const [input, setInput] = useState("");
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");

  const listRef = useRef(null);
  const clientRef = useRef(null);

  // Dedupe helpers (logic unchanged)
  const seenServerIdsRef = useRef(new Set()); // server message ids
  const recentByClientIdRef = useRef(new Map()); // clientId -> { text, ts }
  const recentByTextRef = useRef([]); // [{ text, ts }]

  // who am I (:8080 auth)
  useEffect(() => {
    if (!isAuthenticated()) return;
    (async () => {
      try {
        const res = await fetchWithAuth(`${API_BASE}/auth/me`);
        if (res.ok) setMe(await res.json());
      } catch {
        /* ignore */
      }
    })();
  }, []);

  // autoscroll
  useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [msgs]);

  // Connect to :8082 WS via SockJS http url — only after we know me.id
  useEffect(() => {
    if (!requestId || !me?.id) return;

    const token = getToken();
    if (!token) {
      setError("No token found (jwt_token). Please log in.");
      setReady(false);
      return;
    }

    const client = new StompClient({
      webSocketFactory: () => new SockJS(wsUrl()),
      connectHeaders: {
        Authorization: `Bearer ${token}`,
        access_token: token,
        token,
      },
      debug: () => {},
      reconnectDelay: 3000,
      onConnect: () => {
        // Chat queue (private)
        const subChat = client.subscribe(`/user/queue/chat/${requestId}`, (frame) => {
          try {
            const p = JSON.parse(frame.body || "{}"); // ChatMessage from server

            const serverId = p.id || null;
            const senderId = p.senderId ?? p.sender?.id ?? p.fromUserId ?? null;
            const text = normText(typeof p.text === "string" ? p.text : p.body ?? "");
            const createdAt = p.createdAt || Date.now();
            const clientId = pickClientId(p);

            // ---- hard dedupe gates ----

            // 1) server id we've seen
            if (serverId && seenServerIdsRef.current.has(serverId)) return;
            if (serverId) seenServerIdsRef.current.add(serverId);

            // 2) my own echo (correct senderId set)
            if (senderId && me?.id && senderId === me.id) return;

            // 3) my own echo matched by clientId (best path)
            if (clientId && recentByClientIdRef.current.has(clientId)) {
              // we already optimistically rendered it — drop the server copy
              recentByClientIdRef.current.delete(clientId);
              return;
            }

            // 4) fallback: my own echo matched by text within 30s
            const now = Date.now();
            // prune
            for (const [cid, rec] of Array.from(recentByClientIdRef.current.entries())) {
              if (now - rec.ts > 30000) recentByClientIdRef.current.delete(cid);
            }
            recentByTextRef.current = recentByTextRef.current.filter((r) => now - r.ts < 30000);

            const looksMine = recentByTextRef.current.some((r) => r.text === text);
            if (looksMine) return;

            // ---- if it passed all gates, it's *not* my own message ----
            setMsgs((m) => [
              ...m,
              {
                id: serverId || `srv-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
                senderId: senderId || null,
                text,
                createdAt,
              },
            ]);
          } catch {
            setMsgs((m) => [
              ...m,
              { id: `${Date.now()}-${Math.random()}`, senderId: null, text: frame.body || "" },
            ]);
          }
        });

        // Topic subscription for presence/status (ACCEPT/CLOSE/DISCONNECTED, etc.)
        const subTopic = client.subscribe(`/topic/support/requests/${requestId}`, (frame) => {
          try {
            const ev = JSON.parse(frame.body || "{}");
            const type = (ev?.type || "").toString().toUpperCase();

            if (type === "DISCONNECTED") {
              const who = (ev?.who || "").toString().toUpperCase();
              const text =
                who === "ADMIN"
                  ? "Admin has disconnected."
                  : who === "USER"
                  ? "User has disconnected."
                  : "A participant disconnected.";
              setMsgs((m) => [
                ...m,
                {
                  id: `sys-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
                  text,
                  createdAt: Date.now(),
                  _system: true,
                },
              ]);
            }
          } catch {
            // ignore malformed events
          }
        });

        clientRef.current = client;
        clientRef.current._subs = [subChat, subTopic];
        setReady(true);
        setError("");
      },
      onWebSocketClose: () => setReady(false),
      onStompError: (f) => {
        setReady(false);
        setError(f?.headers?.message || "STOMP error");
      },
    });

    client.activate();
    clientRef.current = client;

    return () => {
      try {
        clientRef.current?._subs?.forEach((s) => s?.unsubscribe());
      } catch {}
      try {
        client.deactivate();
      } catch {}
      clientRef.current = null;
    };
  }, [requestId, me?.id]);

  function send() {
    const raw = input.trim();
    if (!raw || !clientRef.current || !ready || !me?.id) return;

    const text = normText(raw);
    const clientId = uuid(); // correlate optimistic -> server echo
    setInput("");

    // Optimistic echo so the sender sees it immediately (only once)
    const localId = `local-${clientId}`;
    setMsgs((m) => [
      ...m,
      {
        id: localId,
        senderId: me.id,
        text,
        createdAt: Date.now(),
        _mine: true,
        _clientId: clientId,
      },
    ]);

    // Track recent sends for robust echo suppression
    const now = Date.now();
    recentByClientIdRef.current.set(clientId, { text, ts: now });
    recentByTextRef.current.push({ text, ts: now });
    recentByTextRef.current = recentByTextRef.current
      .filter((r) => now - r.ts < 30000)
      .slice(-100);

    try {
      clientRef.current.publish({
        destination: `/app/chat/${requestId}`,
        body: JSON.stringify({ body: text, clientId }), // include clientId for best dedupe
      });
    } catch (e) {
      setError(e?.message || "Failed to send");
    }
  }

  // Manual disconnect (doesn't alter the existing message/WS logic), then redirect
  function disconnect() {
    try {
      clientRef.current?._subs?.forEach((s) => s?.unsubscribe());
    } catch {}
    try {
      clientRef.current?.deactivate();
    } catch {}
    clientRef.current = null;
    setReady(false);

    // Redirect to the admin support-requests list.
    // Prefer SPA navigation; if routing isn't available, fall back to hard redirect.
    try {
      navigate("/admin/support-requests");
    } catch {
      try {
        window.location.href = "/admin/support-requests";
      } catch {}
    }
  }

  // ------------- Styles (UI-only) -------------
  const shell = {
    padding: 16,
    maxWidth: 880,
    margin: "0 auto",
    fontFamily:
      '-apple-system, system-ui, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
  };

  const headerRow = {
    marginBottom: 10,
    display: "flex",
    gap: 12,
    alignItems: "center",
    justifyContent: "space-between",
  };

  const statusWrap = {
    display: "flex",
    alignItems: "center",
    gap: 10,
  };

  const statusPill = (ok) => ({
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
    padding: "6px 10px",
    fontSize: 12,
    fontWeight: 700,
    borderRadius: 999,
    color: ok ? "#065f46" : "#7f1d1d",
    background: ok ? "#d1fae5" : "#fee2e2",
    border: `1px solid ${ok ? "#10b981" : "#f87171"}`,
    userSelect: "none",
  });

  const button = (variant = "primary") => ({
    padding: "8px 12px",
    borderRadius: 10,
    border: "1px solid",
    fontWeight: 800,
    cursor: "pointer",
    ...(variant === "primary"
      ? { background: "#6366f1", color: "#fff", borderColor: "#6366f1" }
      : variant === "ghost"
      ? { background: "transparent", color: "#374151", borderColor: "#d1d5db" }
      : { background: "#ef4444", color: "#fff", borderColor: "#ef4444" }),
  });

  const list = {
    height: 460,
    border: "1px solid #e5e7eb",
    borderRadius: 12,
    padding: 10,
    overflowY: "auto",
    display: "grid",
    alignContent: "start",
    gap: 6,
    background: "#0b141f",
  };

  const bubble = (mine, system = false) => ({
    justifySelf: mine ? "end" : "start",
    background: system ? "#0f172a" : mine ? "#4f46e5" : "#111827",
    color: system ? "#e5e7eb" : "#fff",
    border: system ? "1px solid #1f2937" : "none",
    borderRadius: mine
      ? system
        ? "10px"
        : "14px 14px 4px 14px"
      : system
      ? "10px"
      : "14px 14px 14px 4px",
    padding: system ? "6px 8px" : "6px 10px",
    maxWidth: "75%",
    whiteSpace: "pre-wrap",
    wordBreak: "break-word",
    boxShadow: system ? "none" : "0 2px 6px rgba(0,0,0,0.18)",
    fontSize: 14,
    lineHeight: 1.3, // tighter lines
    fontStyle: system ? "italic" : "normal",
    opacity: system ? 0.9 : 1,
  });

  const inputRow = {
    display: "flex",
    gap: 8,
    marginTop: 10,
  };

  const inputBox = {
    flex: 1,
    padding: "10px 12px",
    borderRadius: 10,
    border: "1px solid #e5e7eb",
    outline: "none",
    fontSize: 14,
    lineHeight: 1.2,
  };

  return (
    <div style={shell}>
      <h1 style={{ margin: "0 0 8px 0", fontSize: 20, color: "#111827" }}>Live Support</h1>

      <div style={headerRow}>
        <div style={statusWrap}>
          <span style={statusPill(ready)}>
            <span
              style={{
                width: 8,
                height: 8,
                borderRadius: 999,
                background: ready ? "#10b981" : "#ef4444",
                display: "inline-block",
              }}
            />
            {ready ? "Connected" : "Connecting…"}
          </span>
          {error && (
            <span
              style={{
                fontSize: 12,
                color: "#991b1b",
                background: "#fee2e2",
                border: "1px solid #fecaca",
                padding: "6px 8px",
                borderRadius: 8,
              }}
            >
              {error}
            </span>
          )}
        </div>

        <div style={{ display: "flex", gap: 8 }}>
          <button
            onClick={disconnect}
            disabled={!ready}
            style={{
              ...button("danger"),
              opacity: ready ? 1 : 0.6,
              cursor: ready ? "pointer" : "not-allowed",
            }}
            title="Disconnect WebSocket"
          >
            Disconnect
          </button>
        </div>
      </div>

      <div ref={listRef} style={list}>
        {msgs.length === 0 && (
          <div style={{ color: "#9ca3af", fontSize: 13 }}>No messages yet.</div>
        )}
        {msgs.map((m) => {
          const mine = !!(me?.id && m.senderId && m.senderId === me.id) || m._mine === true;
          const text = typeof m.text === "string" ? m.text : m.body ?? "";
          return (
            <div key={m.id} style={bubble(mine, m._system === true)}>
              {text}
            </div>
          );
        })}
      </div>

      <div style={inputRow}>
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              send();
            }
          }}
          placeholder="Type a message…"
          style={inputBox}
        />
        <button
          onClick={send}
          disabled={!ready || !input.trim() || !me?.id}
          style={{
            ...button("primary"),
            opacity: !ready || !me?.id || !input.trim() ? 0.6 : 1,
            cursor: !ready || !me?.id || !input.trim() ? "not-allowed" : "pointer",
          }}
          title={!me?.id ? "Loading your identity…" : "Send"}
        >
          Send
        </button>
      </div>
    </div>
  );
}
