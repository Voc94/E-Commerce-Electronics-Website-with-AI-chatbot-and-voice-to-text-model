// src/pages/Navbar.jsx
import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { fetchWithAuth, logout, isAuthenticated } from "../utils/auth.js";
import { API_BASE, VOICE } from "../config.js";
import Avatar from "../components/Avatar.jsx";

/** Hotlink-safe stock images */
const CATEGORY_IMAGES = {
  SMARTPHONES: "https://images.pexels.com/photos/607812/pexels-photo-607812.jpeg",
  TABLETS: "https://images.pexels.com/photos/1334597/pexels-photo-1334597.jpeg",
  WEARABLES: "https://images.pexels.com/photos/2861929/pexels-photo-2861929.jpeg",
  LAPTOPS: "https://images.pexels.com/photos/18105/pexels-photo.jpg",
  DESKTOPS: "https://images.pexels.com/photos/38568/apple-imac-ipad-workplace-38568.jpeg",
  PC_COMPONENTS: "https://images.pexels.com/photos/6704948/pexels-photo-6704948.jpeg",
  MONITORS: "https://images.pexels.com/photos/1714202/pexels-photo-1714202.jpeg",
  PERIPHERALS_ACCESSORIES: "https://images.pexels.com/photos/2115256/pexels-photo-2115256.jpeg",
  STORAGE: "https://images.pexels.com/photos/2942361/pexels-photo-2942361.jpeg",
  SOFTWARE: "https://images.pexels.com/photos/546819/pexels-photo-546819.jpeg",
  CAMERAS: "https://images.pexels.com/photos/1203803/pexels-photo-1203803.jpeg",
  AUDIO_HEADPHONES: "https://images.pexels.com/photos/205926/pexels-photo-205926.jpeg",
  AUDIO_SPEAKERS: "https://images.pexels.com/photos/2651794/pexels-photo-2651794.jpeg",
  GAMING_CONSOLES: "https://images.pexels.com/photos/33513532/pexels-photo-33513532.jpeg",
  GAMING_ACCESSORIES: "https://images.pexels.com/photos/21067/pexels-photo.jpg",
  TV_HOME_THEATER: "https://images.pexels.com/photos/1201996/pexels-photo-1201996.jpeg",
  SMART_HOME: "https://images.pexels.com/photos/1072851/pexels-photo-1072851.jpeg",
  NETWORKING: "https://images.pexels.com/photos/159304/network-cable-ethernet-computer-159304.jpeg",
  PRINTERS_SCANNERS: "https://images.pexels.com/photos/9301887/pexels-photo-9301887.jpeg",
  DRONES: "https://images.pexels.com/photos/336232/pexels-photo-336232.jpeg",
  SMALL_APPLIANCES: "https://images.pexels.com/photos/29461935/pexels-photo-29461935.jpeg",
  ELECTRIC_MOBILITY: "https://images.pexels.com/photos/8811560/pexels-photo-8811560.jpeg",
};

/** Section titles + categories */
const SECTIONS = [
  {
    title: "Phones & Tablets",
    items: [
      { label: "Smartphones", value: "SMARTPHONES" },
      { label: "Tablets", value: "TABLETS" },
      { label: "Wearables", value: "WEARABLES" },
    ],
  },
  {
    title: "Computers",
    items: [
      { label: "Laptops", value: "LAPTOPS" },
      { label: "Desktops", value: "DESKTOPS" },
      { label: "PC Components", value: "PC_COMPONENTS" },
      { label: "Monitors", value: "MONITORS" },
      { label: "Peripherals & Accessories", value: "PERIPHERALS_ACCESSORIES" },
      { label: "Storage", value: "STORAGE" },
      { label: "Software", value: "SOFTWARE" },
    ],
  },
  {
    title: "Imaging & Audio",
    items: [
      { label: "Cameras", value: "CAMERAS" },
      { label: "Audio & Headphones", value: "AUDIO_HEADPHONES" },
      { label: "Audio Speakers", value: "AUDIO_SPEAKERS" },
    ],
  },
  {
    title: "Gaming",
    items: [
      { label: "Gaming Consoles", value: "GAMING_CONSOLES" },
      { label: "Gaming Accessories", value: "GAMING_ACCESSORIES" },
    ],
  },
  {
    title: "TV & Smart Home",
    items: [
      { label: "TV & Home Theater", value: "TV_HOME_THEATER" },
      { label: "Smart Home", value: "SMART_HOME" },
    ],
  },
  {
    title: "Networking & Printing",
    items: [
      { label: "Networking", value: "NETWORKING" },
      { label: "Printers & Scanners", value: "PRINTERS_SCANNERS" },
    ],
  },
  { title: "Drones", items: [{ label: "Drones", value: "DRONES" }] },
  {
    title: "Appliances & Mobility",
    items: [
      { label: "Small Appliances", value: "SMALL_APPLIANCES" },
      { label: "Electric Mobility", value: "ELECTRIC_MOBILITY" },
    ],
  },
];
/** ---------- WAV helpers (16k mono PCM16) ---------- */
function downsampleBuffer(buffer, inSampleRate, outSampleRate = 16000) {
  if (outSampleRate === inSampleRate) return buffer;
  const ratio = inSampleRate / outSampleRate;
  const newLen = Math.round(buffer.length / ratio);
  const out = new Float32Array(newLen);
  for (let i = 0; i < newLen; i++) {
    const start = Math.floor(i * ratio);
    const end = Math.min(Math.floor((i + 1) * ratio), buffer.length);
    let sum = 0;
    for (let j = start; j < end; j++) sum += buffer[j];
    out[i] = sum / Math.max(1, end - start);
  }
  return out;
}
function floatTo16BitPCM(float32) {
  const dv = new DataView(new ArrayBuffer(float32.length * 2));
  for (let i = 0, off = 0; i < float32.length; i++, off += 2) {
    let s = Math.max(-1, Math.min(1, float32[i]));
    dv.setInt16(off, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }
  return dv;
}
function encodeWavPCM16(samples, sampleRate = 16000) {
  const data = floatTo16BitPCM(samples);
  const buf = new ArrayBuffer(44 + data.byteLength);
  const view = new DataView(buf);
  const write = (o, s) => [...s].forEach((c, i) => view.setUint8(o + i, c.charCodeAt(0)));
  write(0, "RIFF"); view.setUint32(4, 36 + data.byteLength, true); write(8, "WAVE");
  write(12, "fmt "); view.setUint32(16, 16, true); view.setUint16(20, 1, true);
  view.setUint16(22, 1, true); view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true); view.setUint16(32, 2, true);
  view.setUint16(34, 16, true); write(36, "data"); view.setUint32(40, data.byteLength, true);
  new Uint8Array(buf, 44).set(new Uint8Array(data.buffer));
  return new Blob([buf], { type: "audio/wav" });
}

/** ---------- Fullscreen Voice Modal ---------- */
function VoiceModal({ open, onClose, onResult }) {
  const [state, setState] = useState("idle"); // idle | recording | sending | error
  const [err, setErr] = useState("");
  const [level, setLevel] = useState(0);
  const levelSmoothedRef = useRef(0);

  const audioCtxRef = useRef(null);
  const processorRef = useRef(null);
  const sourceRef = useRef(null);
  const streamRef = useRef(null);
  const chunksRef = useRef([]);
  const inRateRef = useRef(48000);

  useEffect(() => {
    if (!open) return;
    setState("idle"); setErr(""); setLevel(0); chunksRef.current = [];
  }, [open]);

  async function start() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      await ctx.resume();
      audioCtxRef.current = ctx;
      inRateRef.current = ctx.sampleRate;

      // --- Fallback if AudioWorklet not available ---
      if (!("audioWorklet" in ctx) || typeof AudioWorkletNode === "undefined") {
        console.warn("AudioWorklet not supported, falling back to ScriptProcessor (deprecated).");

        const source = ctx.createMediaStreamSource(stream);
        sourceRef.current = source;

        const proc = ctx.createScriptProcessor(4096, 1, 1);
        const analyser = ctx.createAnalyser(); analyser.fftSize = 2048;
        const data = new Uint8Array(analyser.frequencyBinCount);

        // set BEFORE pump()
        processorRef.current = { node: proc, raf: 0 };

        source.connect(analyser);
        analyser.connect(proc);
        proc.connect(ctx.destination);

        chunksRef.current = [];
        proc.onaudioprocess = (e) => {
          const ch0 = e.inputBuffer.getChannelData(0);
          chunksRef.current.push(new Float32Array(ch0));
        };

        const pump = () => {
          if (!processorRef.current) return; // modal closed / cleaned up
          analyser.getByteTimeDomainData(data);
          let sum = 0;
          for (let i = 0; i < data.length; i++) {
            const v = (data[i] - 128) / 128;
            sum += v * v;
          }
          const rms = Math.sqrt(sum / data.length);
          levelSmoothedRef.current = levelSmoothedRef.current * 0.85 + rms * 0.15;
          setLevel(levelSmoothedRef.current);
          processorRef.current.raf = requestAnimationFrame(pump);
        };
        pump();

        setState("recording");
        return;
      }

      // --- AudioWorklet path ---
      const source = ctx.createMediaStreamSource(stream);
      sourceRef.current = source;

      const workletCode = `
        class MicCaptureProcessor extends AudioWorkletProcessor {
          process(inputs) {
            const input = inputs[0];
            if (input && input[0]) {
              this.port.postMessage(input[0].slice(0));
            }
            return true;
          }
        }
        registerProcessor('mic-capture', MicCaptureProcessor);
      `;
      const url = URL.createObjectURL(new Blob([workletCode], { type: "application/javascript" }));
      await ctx.audioWorklet.addModule(url);

      const node = new AudioWorkletNode(ctx, "mic-capture", {
        numberOfInputs: 1,
        numberOfOutputs: 1,
        outputChannelCount: [1],
      });
      const mute = ctx.createGain(); mute.gain.value = 0;

      chunksRef.current = [];
      node.port.onmessage = (e) => {
        chunksRef.current.push(new Float32Array(e.data));
      };

      source.connect(node);
      node.connect(mute).connect(ctx.destination);

      const analyser = ctx.createAnalyser(); analyser.fftSize = 2048;
      const data = new Uint8Array(analyser.frequencyBinCount);
      source.connect(analyser);

      // set BEFORE pump()
      processorRef.current = { node, mute, raf: 0 };

      const pump = () => {
        if (!processorRef.current) return; // modal closed / cleaned up
        analyser.getByteTimeDomainData(data);
        let sum = 0;
        for (let i = 0; i < data.length; i++) {
          const v = (data[i] - 128) / 128;
          sum += v * v;
        }
        const rms = Math.sqrt(sum / data.length);
        levelSmoothedRef.current = levelSmoothedRef.current * 0.85 + rms * 0.15;
        setLevel(levelSmoothedRef.current);
        processorRef.current.raf = requestAnimationFrame(pump);
      };
      pump();

      setState("recording");
    } catch (e) {
      setErr(e?.message || "Microphone access failed");
      setState("error");
    }
  }

  async function stopAndSend() {
    try {
      setState("sending");

      const ctx = audioCtxRef.current;
      const p = processorRef.current;

      // stop meter loop
      try { if (p?.raf) cancelAnimationFrame(p.raf); } catch {}
      // detach messages
      try { if (p?.node?.port) p.node.port.onmessage = null; } catch {}
      // disconnect graph
      try { p?.node?.disconnect(); } catch {}
      try { p?.mute?.disconnect(); } catch {}
      try { sourceRef.current?.disconnect(); } catch {}
      // close & stop mic
      try { await ctx?.close(); } catch {}
      try { streamRef.current?.getTracks().forEach(t => t.stop()); } catch {}
      // release ref so pump() guards bail
      processorRef.current = null;

      const chunks = chunksRef.current || [];
      if (!chunks.length) throw new Error("No audio captured");

      const total = chunks.reduce((s, c) => s + c.length, 0);
      const merged = new Float32Array(total);
      for (let off = 0, i = 0; i < chunks.length; i++) { merged.set(chunks[i], off); off += chunks[i].length; }

      const inRate = inRateRef.current || 48000;
      const ds = downsampleBuffer(merged, inRate, 16000);
      const wav = encodeWavPCM16(ds, 16000);

      const fd = new FormData();
      fd.append("audio", wav, "clip.wav");

      const res = await fetch(VOICE.STT, { method: "POST", body: fd });
      const ctype = res.headers.get("content-type") || "";
      if (!res.ok) {
        const txt = await res.text();
        throw new Error(`Backend ${res.status}: ${txt.slice(0, 200)}`);
      }
      const json = ctype.includes("application/json") ? await res.json() : { fixed: await res.text() };
      const text = (json.fixed || json.greedy || "").trim();

      onResult(text);
      onClose();
    } catch (e) {
      setErr(e?.message || "Transcription failed");
      setState("error");
    }
  }

  async function cancelAll() {
  try {
    const p = processorRef.current;

    // stop meter loop & detach messages
    try { if (p?.raf) cancelAnimationFrame(p.raf); } catch {}
    try { if (p?.node?.port) p.node.port.onmessage = null; } catch {}

    // disconnect nodes safely
    try { p?.node?.disconnect(); } catch {}
    try { p?.mute?.disconnect(); } catch {}
    try { sourceRef.current?.disconnect(); } catch {}

    // safely close AudioContext
    const ctx = audioCtxRef.current;
    if (ctx && ctx.state !== "closed") {
      try { await ctx.close(); } catch {}
    }
    audioCtxRef.current = null;

    // stop active tracks safely
    const s = streamRef.current;
    if (s) {
      try {
        s.getTracks().forEach(t => {
          try { if (t.readyState !== "ended") t.stop(); } catch {}
        });
      } catch {}
    }
    streamRef.current = null;

  } catch {}
  processorRef.current = null;
  onClose();
}


  if (!open) return null;
  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.5)", display:"grid", placeItems:"center", zIndex:1000 }}>
      <div style={{ width:420, maxWidth:"92vw", background:"#111827", color:"#fff", borderRadius:14, boxShadow:"0 20px 50px rgba(0,0,0,.4)", overflow:"hidden" }}>
        <div style={{ padding:16, borderBottom:"1px solid rgba(255,255,255,0.12)", fontWeight:800 }}>Voice Search</div>
        <div style={{ padding:18, display:"grid", gap:12 }}>
          {state === "idle" && <div>Click <b>Start</b>, speak, then <b>Stop &amp; Use</b>.</div>}
          {state === "recording" && (
            <div style={{ display:"grid", gap:10 }}>
              <div>Listening…</div>
              <div style={{ height:10, borderRadius:999, background:"rgba(255,255,255,.15)", overflow:"hidden" }}>
                <div style={{ width: `${Math.min(100, Math.max(6, level * 1200))}%`, height: 10, background: "#22c55e" }} />
              </div>
              <div style={{ fontSize:12, opacity:.8 }}>Say product/brand title words (e.g., “iPhone 15 Pro”, “LG OLED”).</div>
            </div>
          )}
          {state === "sending" && <div>Transcribing…</div>}
          {state === "error" && <div style={{ color:"#fecaca" }}>Error: {err}</div>}

          <div style={{ display:"flex", gap:8 }}>
            {state !== "recording" && state !== "sending" && (
              <button onClick={start} style={{ flex:1, padding:"10px 12px", borderRadius:10, border:"1px solid #22c55e", background:"#22c55e", color:"#0b141f", fontWeight:800, cursor:"pointer" }}>
                Start
              </button>
            )}
            {state === "recording" && (
              <button onClick={stopAndSend} style={{ flex:1, padding:"10px 12px", borderRadius:10, border:"1px solid #f59e0b", background:"#f59e0b", color:"#0b141f", fontWeight:800, cursor:"pointer" }}>
                Stop &amp; Use
              </button>
            )}
            <button onClick={cancelAll} style={{ padding:"10px 12px", borderRadius:10, border:"1px solid #374151", background:"#1f2937", color:"#fff", fontWeight:700, cursor:"pointer" }}>
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/** Local helpers for cart */
function readCartArray() {
  try {
    const arr = JSON.parse(localStorage.getItem("cart") || "[]");
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}
function cartTotals(items) {
  const subtotal = items.reduce((s, it) => s + (Number(it.price) || 0) * (it.qty || 1), 0);
  const currency = items[0]?.currency || "RON";
  return { subtotal, currency };
}

export default function Navbar() {
  const [user, setUser] = useState(null);
  const [searchQ, setSearchQ] = useState("");
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [activeSectionIdx, setActiveSectionIdx] = useState(0);
  const [voiceOpen, setVoiceOpen] = useState(false);

  const [cartOpen, setCartOpen] = useState(false);
  const [cartItems, setCartItems] = useState([]);
  const cartBtnRef = useRef(null);
  const cartPanelRef = useRef(null);

  const menuRef = useRef(null);
  const navigate = useNavigate();

  const role = user?.role;
  const canShop = role === "USER"; // only normal users can buy
  const authed = isAuthenticated(); // <--- AUTH FLAG

  const fetchUser = async () => {
    if (!isAuthenticated()) {
      setUser(null);
      return;
    }
    try {
      const res = await fetchWithAuth(`${API_BASE}/auth/me`);
      if (res.ok) setUser(await res.json());
      else {
        logout();
        setUser(null);
      }
    } catch {
      logout();
      setUser(null);
    }
  };

  /** auth */
  useEffect(() => {
    fetchUser();
    const handleAuthChange = () => (isAuthenticated() ? fetchUser() : setUser(null));
    window.addEventListener("authChange", handleAuthChange);
    return () => window.removeEventListener("authChange", handleAuthChange);
  }, []);

  /** close mega menu when clicking outside */
  useEffect(() => {
    const onClickOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) setIsMenuOpen(false);
    };
    if (isMenuOpen) document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, [isMenuOpen]);

  /** cart: sync with localStorage + custom event */
  const refreshCart = () => setCartItems(readCartArray());
  useEffect(() => {
    refreshCart();
    const onCartChange = () => refreshCart();
    window.addEventListener("cartChange", onCartChange);
    window.addEventListener("storage", onCartChange);
    return () => {
      window.removeEventListener("cartChange", onCartChange);
      window.removeEventListener("storage", onCartChange);
    };
  }, []);

  /** close cart popover on outside click */
  useEffect(() => {
    if (!cartOpen) return;
    const onDocClick = (e) => {
      if (
        cartPanelRef.current &&
        !cartPanelRef.current.contains(e.target) &&
        cartBtnRef.current &&
        !cartBtnRef.current.contains(e.target)
      ) {
        setCartOpen(false);
      }
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [cartOpen]);

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  const submitSearch = (e) => {
    e.preventDefault();
    if (!isAuthenticated()) {
      navigate("/login");
      return;
    }
    const params = new URLSearchParams();
    if (searchQ.trim()) params.set("query", searchQ.trim());
    navigate(`/catalog?${params.toString()}`);
    setIsMenuOpen(false);
  };

  const goCategory = (value) => {
    const params = new URLSearchParams();
    params.set("category", value);
    if (!isAuthenticated()) {
      navigate("/login");
      return;
    }
    navigate(`/catalog?${params.toString()}`);
    setIsMenuOpen(false);
  };

  const handleClearCart = () => {
    localStorage.setItem("cart", "[]");
    window.dispatchEvent(new Event("cartChange"));
    refreshCart();
  };

  const handleToggleCart = () => {
    if (!canShop) return;
    setCartOpen((v) => !v);
  };

  const { subtotal, currency } = cartTotals(cartItems);
  const cartCount = cartItems.reduce((s, it) => s + (it.qty || 0), 0);

  // shared button styles
  const primaryBtn = {
    flex: 1,
    padding: "10px 12px",
    borderRadius: 10,
    border: "1px solid #6366f1",
    background: "#6366f1",
    color: "#fff",
    fontWeight: 800,
    cursor: "pointer",
  };
  const secondaryBtn = {
    flex: 1,
    padding: "10px 12px",
    borderRadius: 10,
    border: "1px solid #d1d5db",
    background: "#f9fafb",
    color: "#111827",
    fontWeight: 700,
    cursor: "pointer",
  };
  const dangerBtn = {
    padding: "8px 10px",
    borderRadius: 8,
    border: "1px solid #b91c1c",
    background: "#ef4444",
    color: "#fff",
    fontWeight: 800,
    cursor: "pointer",
  };
  const disabledBtn = {
    opacity: 0.5,
    cursor: "not-allowed",
    filter: "grayscale(0.2)",
  };

  return (
    <nav
      style={{
        padding: "12px 24px",
        display: "flex",
        justifyContent: "flex-start",
        alignItems: "center",
        background: "#fff",
        boxShadow: "0 4px 16px rgba(0,0,0,0.05)",
        fontFamily:
          '-apple-system, system-ui, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
        gap: 16,
        position: "sticky",
        top: 0,
        zIndex: 50,
      }}
    >
      {/* Left group: logo + (guarded) catalog + search */}
      <div style={{ display: "flex", alignItems: "center", gap: 16, flex: 1 }}>
        <Link
          to="/"
          style={{
            textDecoration: "none",
            fontWeight: 700,
            fontSize: 18,
            color: "#6366f1",
          }}
        >
          Spark✨
        </Link>

        {/* ---- GUARD: Only show Catalog + Search if authenticated ---- */}
        {authed && (
          <>
            {/* Catalog Trigger */}
            <div style={{ position: "relative" }} ref={menuRef}>
              <button
                type="button"
                onClick={() => {
                  setIsMenuOpen((v) => !v);
                  if (!isMenuOpen) setActiveSectionIdx(0);
                }}
                onMouseEnter={() => {
                  setIsMenuOpen(true);
                  setActiveSectionIdx((idx) => (idx == null ? 0 : idx));
                }}
                style={{
                  padding: "8px 12px",
                  borderRadius: 8,
                  border: "1px solid #e5e7eb",
                  background: "#fff",
                  cursor: "pointer",
                  fontWeight: 700,
                  fontSize: 14,
                  color: "#1f2937",
                  zIndex: 100,
                }}
              >
                Catalog ▾
              </button>

              {/* Mega Menu */}
              {isMenuOpen && (
                <div
                  role="menu"
                  onMouseLeave={() => setIsMenuOpen(false)}
                  style={{
                    position: "absolute",
                    top: "110%",
                    left: 0,
                    background: "#fff",
                    boxShadow: "0 10px 30px rgba(0,0,0,0.1)",
                    border: "1px solid #e5e7eb",
                    borderRadius: 12,
                    display: "grid",
                    gridTemplateColumns: "260px 1fr",
                    minWidth: 760,
                    overflow: "hidden",
                    zIndex: 60,
                  }}
                >
                  {/* Left rail */}
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      padding: 12,
                      borderRight: "1px solid #f3f4f6",
                      gap: 4,
                      background: "#fafafa",
                    }}
                  >
                    {SECTIONS.map((sec, i) => {
                      const active = i === activeSectionIdx;
                      return (
                        <div
                          key={sec.title}
                          role="presentation"
                          onMouseEnter={() => setActiveSectionIdx(i)}
                          style={{
                            padding: "10px 12px",
                            borderRadius: 8,
                            fontWeight: 700,
                            cursor: "default",
                            background: active ? "#eef2ff" : "transparent",
                            color: active ? "#3730a3" : "#111827",
                          }}
                        >
                          {sec.title}
                        </div>
                      );
                    })}
                  </div>

                  {/* Right panel */}
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "repeat(3, minmax(180px, 1fr))",
                      gap: 12,
                      padding: 16,
                    }}
                  >
                    {SECTIONS[activeSectionIdx]?.items.map((cat) => (
                      <button
                        key={cat.value}
                        onClick={() => goCategory(cat.value)}
                        style={{
                          position: "relative",
                          textAlign: "center",
                          padding: "24px 12px",
                          borderRadius: 12,
                          border: "1px solid #e5e7eb",
                          background: "#fff",
                          cursor: "pointer",
                          fontWeight: 600,
                          fontSize: 14,
                          overflow: "hidden",
                          height: 120,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                        onMouseEnter={(e) =>
                          (e.currentTarget.style.boxShadow = "0 4px 12px rgba(0,0,0,0.1)")
                        }
                        onMouseLeave={(e) => (e.currentTarget.style.boxShadow = "none")}
                      >
                        <img
                          src={CATEGORY_IMAGES[cat.value]}
                          alt={cat.label}
                          style={{
                            position: "absolute",
                            inset: 0,
                            width: "100%",
                            height: "100%",
                            objectFit: "cover",
                            zIndex: 1,
                          }}
                          loading="lazy"
                          referrerPolicy="no-referrer"
                        />
                        <div
                          style={{
                            position: "absolute",
                            inset: 0,
                            background: "rgba(255,255,255,0.45)",
                            zIndex: 2,
                            pointerEvents: "none",
                          }}
                        />
                        <span
                          style={{
                            position: "relative",
                            zIndex: 3,
                            color: "#111827",
                            fontWeight: 700,
                            padding: "4px 10px",
                            borderRadius: 8,
                            backdropFilter: "blur(2px) brightness(1.1)",
                            WebkitBackdropFilter: "blur(2px) brightness(1.1)",
                            background: "rgba(255,255,255,0.25)",
                            boxShadow: "0 1px 2px rgba(0,0,0,0.06)",
                          }}
                        >
                          {cat.label}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Search bar */}
            <form
              onSubmit={submitSearch}
              role="search"
              style={{
                flex: 1,
                maxWidth: 500,
                display: "flex",
                alignItems: "center",
                gap: 8,
              }}
            >
              <input
                placeholder="Search products…"
                value={searchQ}
                onChange={(e) => setSearchQ(e.target.value)}
                style={{
                  flex: 1,
                  padding: "10px 12px",
                  borderRadius: 10,
                  border: "1px solid #e5e7eb",
                  outline: "none",
                }}
              />
              <button
                type="submit"
                style={{
                  padding: "10px 14px",
                  borderRadius: 10,
                  border: "1px solid #6366f1",
                  background: "#6366f1",
                  color: "#fff",
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                Search
              </button>
              <button
                type="button"
                onClick={() => setVoiceOpen(true)}
                title="Voice search"
                aria-label="Voice search"
                style={{
                  padding: "10px 12px",
                  borderRadius: 10,
                  border: "1px solid #e5e7eb",
                  background: "#fff",
                  cursor: "pointer",
                  fontWeight: 700,
                }}
              >
                🎙️
              </button>
            </form>
          </>
        )}
      </div>

      {/* Right-side links */}
      <div className="links" style={{ display: "flex", alignItems: "center", gap: 16 }}>
        {/* ---- GUARD: Only show Explore/Orders/Cart if authenticated ---- */}
        {authed && (
          <>
            <Link to="/catalog" style={{ textDecoration: "none", color: "#6366f1", fontWeight: 700 }}>
              Explore
            </Link>

            {/* Role-based Orders link */}
            {user && role === "USER" && (
              <Link to="/orders" style={{ textDecoration: "none", color: "#6366f1", fontWeight: 700 }}>
                My Orders
              </Link>
            )}
            {role === "ADMIN" && (
              <Link
                to="/admin/support-requests"
                style={{ textDecoration: "none", color: "#6366f1", fontWeight: 600, fontSize: 14 }}
              >
                Support Requests
              </Link>
            )}
            {user && role === "BRAND_SELLER" && (
              <Link
                to="/my-brand/orders"
                style={{ textDecoration: "none", color: "#6366f1", fontWeight: 700 }}
              >
                Brand Orders
              </Link>
            )}

            {/* Cart button + popover */}
            <div style={{ position: "relative" }}>
              <button
                ref={cartBtnRef}
                type="button"
                onClick={handleToggleCart}
                aria-label="Open cart"
                disabled={!canShop}
                title={!canShop ? "Buying is disabled for your role" : "Open cart"}
                style={{
                  position: "relative",
                  padding: "8px 12px",
                  borderRadius: 8,
                  border: "1px solid #e5e7eb",
                  background: "#fff",
                  cursor: canShop ? "pointer" : "not-allowed",
                  fontWeight: 700,
                  fontSize: 14,
                  color: "#1f2937",
                  ...(canShop ? {} : disabledBtn),
                }}
              >
                🛒 Cart
                {cartCount > 0 && canShop && (
                  <span
                    style={{
                      marginLeft: 6,
                      background: "#ef4444",
                      color: "#fff",
                      borderRadius: 999,
                      padding: "2px 8px",
                      fontSize: 12,
                      fontWeight: 800,
                      verticalAlign: "middle",
                    }}
                  >
                    {cartCount}
                  </span>
                )}
              </button>

              {cartOpen && canShop && (
                <div
                  ref={cartPanelRef}
                  style={{
                    position: "absolute",
                    right: 0,
                    top: "115%",
                    width: 360,
                    background: "#fff",
                    border: "1px solid #e5e7eb",
                    borderRadius: 12,
                    boxShadow: "0 12px 30px rgba(0,0,0,0.12)",
                    overflow: "hidden",
                    zIndex: 70,
                  }}
                >
                  <div style={{ padding: 12, borderBottom: "1px solid #f3f4f6", fontWeight: 800 }}>
                    Your Cart
                  </div>

                  {cartItems.length === 0 ? (
                    <div style={{ padding: 16, color: "#6b7280" }}>Your cart is empty.</div>
                  ) : (
                    <>
                      <div
                        style={{
                          maxHeight: 320,
                          overflowY: "auto",
                          padding: 8,
                          display: "grid",
                          gap: 8,
                        }}
                      >
                        {cartItems.map((it) => (
                          <div
                            key={it.id}
                            style={{
                              display: "grid",
                              gridTemplateColumns: "64px 1fr auto",
                              gap: 8,
                              alignItems: "center",
                              border: "1px solid #f3f4f6",
                              borderRadius: 10,
                              padding: 8,
                            }}
                          >
                            <div
                              style={{
                                width: 64,
                                height: 64,
                                background: "#f3f4f6",
                                borderRadius: 8,
                                overflow: "hidden",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                              }}
                            >
                              {it.cover ? (
                                <img
                                  src={it.cover}
                                  alt={it.name}
                                  style={{ width: "100%", height: "100%", objectFit: "cover" }}
                                  loading="lazy"
                                />
                              ) : (
                                <span style={{ color: "#9ca3af", fontSize: 12 }}>No image</span>
                              )}
                            </div>
                            <div style={{ minWidth: 0 }}>
                              <div
                                style={{
                                  fontWeight: 700,
                                  fontSize: 14,
                                  whiteSpace: "nowrap",
                                  overflow: "hidden",
                                  textOverflow: "ellipsis",
                                }}
                                title={it.name}
                              >
                                {it.name}
                              </div>
                              <div style={{ color: "#6b7280", fontSize: 12 }}>Qty: {it.qty}</div>
                            </div>
                            <div style={{ fontWeight: 700, fontSize: 14 }}>
                              {it.price} {it.currency || "RON"}
                            </div>
                          </div>
                        ))}
                      </div>

                      <div style={{ padding: 12, borderTop: "1px solid #f3f4f6", display: "grid", gap: 8 }}>
                        <div
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                            marginBottom: 2,
                            fontWeight: 700,
                          }}
                        >
                          <span>Subtotal</span>
                          <span>
                            {subtotal.toFixed(2)} {currency}
                          </span>
                        </div>

                        {/* CLEAR */}
                        <div>
                          <button onClick={handleClearCart} style={dangerBtn} title="Clear cart">
                            🗑 Clear cart
                          </button>
                        </div>

                        {/* Actions */}
                        <div style={{ display: "flex", gap: 8 }}>
                          <button
                            onClick={() => {
                              setCartOpen(false);
                              navigate("/cart");
                            }}
                            style={secondaryBtn}
                          >
                            View cart
                          </button>
                          <button
                            onClick={() => {
                              setCartOpen(false);
                              navigate("/checkout");
                            }}
                            style={primaryBtn}
                          >
                            Checkout
                          </button>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>

            {/* User area when authenticated */}
            {user && (
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                {role === "ADMIN" && (
                  <Link
                    to="/admin"
                    style={{
                      marginRight: 8,
                      textDecoration: "none",
                      color: "#6366f1",
                      fontWeight: 600,
                      fontSize: 14,
                    }}
                  >
                    Admin
                  </Link>
                )}
                {role === "USER" && (
                  <Link
                    to="/request-brand"
                    style={{
                      textDecoration: "none",
                      color: "#6366f1",
                      fontWeight: 600,
                      fontSize: 14,
                    }}
                  >
                    Request Brand
                  </Link>
                )}
                {role === "ADMIN" && (
                  <Link
                    to="/admin/brand-requests"
                    style={{
                      textDecoration: "none",
                      color: "#6366f1",
                      fontWeight: 600,
                      fontSize: 14,
                    }}
                  >
                    Brand Requests
                  </Link>
                )}
                {role === "BRAND_SELLER" && (
                  <Link
                    to="/my-brand"
                    style={{
                      textDecoration: "none",
                      color: "#6366f1",
                      fontWeight: 600,
                      fontSize: 14,
                    }}
                  >
                    My Brand
                  </Link>
                )}

                <Link
                  to="/profile"
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    textDecoration: "none",
                    color: "#1f2d3a",
                  }}
                >
                  <Avatar imageUrl={user.imageUrl} size={32} alt={user.name} />
                  <span style={{ fontSize: 14, fontWeight: 600 }}>{user.name}</span>
                </Link>

                <button
                  type="button"
                  onClick={handleLogout}
                  aria-label="Logout"
                  style={{
                    padding: "8px 14px",
                    background: "#f5f7fa",
                    color: "#1f2d3a",
                    border: "1px solid #d1d9e6",
                    borderRadius: 6,
                    cursor: "pointer",
                    fontSize: 14,
                    fontWeight: 600,
                    transition: "background .2s ease, filter .2s ease",
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.filter = "brightness(1.03)")}
                  onMouseLeave={(e) => (e.currentTarget.style.filter = "none")}
                  onFocus={(e) => {
                    e.currentTarget.style.boxShadow = "0 0 0 3px rgba(99,102,241,0.5)";
                    e.currentTarget.style.outline = "none";
                  }}
                  onBlur={(e) => (e.currentTarget.style.boxShadow = "none")}
                >
                  Logout
                </button>
              </div>
            )}
          </>
        )}

        {/* ---- ALWAYS show Login/Register when NOT authenticated ---- */}
        {!authed && (
          <>
            <Link
              to="/login"
              style={{
                textDecoration: "none",
                color: "#6366f1",
                fontWeight: 600,
              }}
            >
              Login
            </Link>
            <Link
              to="/register"
              style={{
                textDecoration: "none",
                color: "#6366f1",
                fontWeight: 600,
              }}
            >
              Register
            </Link>
          </>
        )}
      </div>

      {/* Voice modal is only reachable via button above (hidden for guests) */}
      <VoiceModal
        open={voiceOpen}
        onClose={() => setVoiceOpen(false)}
        onResult={(text) => { if (text) setSearchQ(text); }}
      />
    </nav>
  );
}
