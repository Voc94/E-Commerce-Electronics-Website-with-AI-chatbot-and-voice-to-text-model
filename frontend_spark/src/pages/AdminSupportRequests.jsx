import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { API_BASE, ADMIN_REQUESTS } from "../config.js";
import { fetchWithAuth } from "../utils/auth.js";

export default function AdminSupportRequests() {
  const [items, setItems] = useState([]);
  const [me, setMe] = useState(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const navigate = useNavigate();

  async function load() {
    setLoading(true); setErr("");
    try {
      const [meRes, listRes] = await Promise.all([
        fetchWithAuth(`${API_BASE}/auth/me`),                 // :8080
        fetchWithAuth(ADMIN_REQUESTS.AWAITING),               // :8082
      ]);
      if (!meRes.ok) throw new Error("Failed /auth/me");
      if (!listRes.ok) throw new Error("Failed awaiting");
      setMe(await meRes.json());
      setItems(await listRes.json());
    } catch (e) {
      setErr(e?.message || "Load failed");
    } finally { setLoading(false); }
  }

  useEffect(() => { load(); }, []);

  async function accept(id) {
    try {
      if (!me?.id) throw new Error("No admin id");
      const res = await fetchWithAuth(ADMIN_REQUESTS.ACCEPT(id), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ adminId: me.id }),
      });
      if (!res.ok) throw new Error(await res.text());
      navigate(`/admin/support/chat/${id}`);
    } catch (e) {
      alert(e?.message || "Accept failed");
    }
  }

  return (
    <div style={{ padding: 24 }}>
      <h1>Support Requests</h1>
      <div style={{ margin: "8px 0" }}>
        <button onClick={load}>Refresh</button>
      </div>
      {err && <div style={{ color: "#b91c1c" }}>{err}</div>}
      {loading ? "Loading…" : (
        items.length === 0 ? <div>No pending requests.</div> : (
          <div style={{ display: "grid", gap: 10 }}>
            {items.map(r => (
              <div key={r.id} style={{ border: "1px solid #e5e7eb", borderRadius: 10, padding: 12 }}>
                <div><b>ID:</b> {r.id}</div>
                <div><b>User:</b> {r.userId}</div>
                <div><b>Status:</b> {r.status}</div>
                {r.initialMessage && <div><b>Msg:</b> {r.initialMessage}</div>}
                <div style={{ marginTop: 8, display: "flex", gap: 8 }}>
                  <button onClick={() => accept(r.id)} style={{ background: "#10b981", color: "#fff", border: 0, padding: "8px 12px", borderRadius: 8 }}>
                    Accept & Open
                  </button>
                  <button onClick={() => navigate(`/admin/support/chat/${r.id}`)} style={{ padding: "8px 12px", borderRadius: 8 }}>
                    Open Chat
                  </button>
                </div>
              </div>
            ))}
          </div>
        )
      )}
    </div>
  );
}
