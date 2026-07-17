import { useState, useRef, useEffect, useCallback } from "react";

// ─── Capacitor Plugin Bridges ───────────────────────────────────────────────
// These are called via window.Capacitor.Plugins.* in the Android WebView.
// In a real Capacitor project, import from @capacitor/core registerPlugin instead.
const Plugins: any = typeof window !== "undefined" && (window as any).Capacitor
  ? (window as any).Capacitor.Plugins
  : {};

const LlamaPlugin      = Plugins.LlamaPlugin      ?? null;
const AiEngine         = Plugins.AiEngine         ?? null;
const SystemAnalyzer   = Plugins.SystemAnalyzer   ?? null;

// ─── Types ──────────────────────────────────────────────────────────────────
type AppMode  = null | "online" | "offline";
type Role     = "user" | "assistant";
type Attachment = { kind: "image" | "file"; name: string; data: string };

type Msg = {
  role: Role;
  chat?: string;
  code?: string;
  codeType?: "html" | "react" | "python" | "js" | "text";
  attachments?: Attachment[];
  loading?: boolean;
};

interface AIModel {
  name: string;
  description: string;
  parameters: string;
  abilities: string[];
  gguf_size_bytes: number | null;
  download_url: string;
  gguf_file: string;
}

interface SystemInfo {
  ram:     { totalMB: number; availableMB: number; usedMB: number };
  cpu:     { cores: number; arch: string; model: string };
  battery: { percent: number; isCharging: boolean };
  device:  { model: string; brand: string; androidVersion: string };
}

// ─── AI Model List ──────────────────────────────────────────────────────────
const AI_MODELS: AIModel[] = [
  {
    name: "Qwen2.5-Coder-3B-Instruct-GGUF",
    description: "Text Generation • 3B — Hafif, hızlı kod asistanı",
    parameters: "3B",
    abilities: ["text-generation", "code"],
    gguf_size_bytes: 2104932800,
    gguf_file: "qwen2.5-coder-3b-instruct-q4_k_m.gguf",
    download_url: "https://huggingface.co/Qwen/Qwen2.5-Coder-3B-Instruct-GGUF/resolve/main/qwen2.5-coder-3b-instruct-q4_k_m.gguf",
  },
  {
    name: "Phi-4-mini-instruct-GGUF",
    description: "Text Generation • 4B — Genel amaçlı, akıllı ve hızlı",
    parameters: "4B",
    abilities: ["text-generation"],
    gguf_size_bytes: 2491874272,
    gguf_file: "Phi-4-mini-instruct-Q4_K_M.gguf",
    download_url: "https://huggingface.co/unsloth/Phi-4-mini-instruct-GGUF/resolve/main/Phi-4-mini-instruct-Q4_K_M.gguf",
  },
  {
    name: "Jan-code-4b-gguf",
    description: "Text Generation • 4B — Kod yazmaya odaklı",
    parameters: "4B",
    abilities: ["text-generation", "code"],
    gguf_size_bytes: 2716066656,
    gguf_file: "Jan-code-4b-Q4_K_M.gguf",
    download_url: "https://huggingface.co/janhq/Jan-code-4b-gguf/resolve/main/Jan-code-4b-Q4_K_M.gguf",
  },
  {
    name: "DeepSeek-R1-0528-Qwen3-8B-GGUF",
    description: "Text Generation • 8B — Güçlü mantık yürütme",
    parameters: "8B",
    abilities: ["text-generation", "reasoning"],
    gguf_size_bytes: 5027785216,
    gguf_file: "DeepSeek-R1-0528-Qwen3-8B-Q4_K_M.gguf",
    download_url: "https://huggingface.co/unsloth/DeepSeek-R1-0528-Qwen3-8B-GGUF/resolve/main/DeepSeek-R1-0528-Qwen3-8B-Q4_K_M.gguf",
  },
  {
    name: "Qwen2.5-Coder-7B-Instruct-GGUF",
    description: "Text Generation • 8B — Güçlü kod + açıklama",
    parameters: "8B",
    abilities: ["text-generation", "code"],
    gguf_size_bytes: 3993201376,
    gguf_file: "qwen2.5-coder-7b-instruct-q4_k_m-00001-of-00002.gguf",
    download_url: "https://huggingface.co/Qwen/Qwen2.5-Coder-7B-Instruct-GGUF/resolve/main/qwen2.5-coder-7b-instruct-q4_k_m-00001-of-00002.gguf",
  },
  {
    name: "Lexi-Llama-3-8B-Uncensored-GGUF",
    description: "Text Generation • 8B — Kısıtlamasız yaratıcı model",
    parameters: "8B",
    abilities: ["uncensored"],
    gguf_size_bytes: 4920733984,
    gguf_file: "Lexi-Llama-3-8B-Uncensored-Q4_K_M.gguf",
    download_url: "https://huggingface.co/bartowski/Lexi-Llama-3-8B-Uncensored-GGUF/resolve/main/Lexi-Llama-3-8B-Uncensored-Q4_K_M.gguf",
  },
  {
    name: "Guanaco-13B-Uncensored-GGUF",
    description: "Text Generation • 13B — Büyük, kısıtlamasız model",
    parameters: "13B",
    abilities: ["uncensored"],
    gguf_size_bytes: 7865956288,
    gguf_file: "guanaco-13b-uncensored.Q4_K_M.gguf",
    download_url: "https://huggingface.co/TheBloke/Guanaco-13B-Uncensored-GGUF/resolve/main/guanaco-13b-uncensored.Q4_K_M.gguf",
  },
];

function recommendModel(ramMB: number): AIModel {
  if (ramMB >= 10000) return AI_MODELS.find(m => m.parameters === "13B") ?? AI_MODELS[0];
  if (ramMB >= 6000)  return AI_MODELS.find(m => m.name.includes("Coder-7B")) ?? AI_MODELS[0];
  if (ramMB >= 4000)  return AI_MODELS.find(m => m.parameters === "4B") ?? AI_MODELS[0];
  return AI_MODELS[0]; // 3B fallback
}

function formatBytes(b: number | null): string {
  if (!b) return "Boyut bilinmiyor";
  const gb = b / 1024 ** 3;
  return gb >= 1 ? `${gb.toFixed(1)} GB` : `${(b / 1024 ** 2).toFixed(0)} MB`;
}

// ─── Online API helpers (bridge — same as before) ────────────────────────────
const ONLINE_API = "https://api.onlinecompiler.io/api/run-code-sync/";
const ONLINE_KEY = "54a81b482603efeb0fdbf7ce5784e330";

async function runOnlineCode(code: string, language: string): Promise<string> {
  try {
    const res = await fetch(ONLINE_API, {
      method: "POST",
      headers: {
        Authorization: ONLINE_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ compiler: language, code, input: "" }),
    });
    const data = await res.json();
    return data.output ?? data.error ?? JSON.stringify(data);
  } catch (e: any) {
    return `Hata: ${e.message}`;
  }
}

// ─── Error auto-search helper ────────────────────────────────────────────────
function searchError(errorMsg: string) {
  const q = encodeURIComponent(`Mini AI offline llama.cpp hata: ${errorMsg}`);
  const url = `https://www.google.com/search?q=${q}`;
  // Capacitor'da InAppBrowser veya window.open kullanılabilir
  window.open(url, "_blank");
}

// ─── Storage helpers ─────────────────────────────────────────────────────────
const STORAGE_KEY_MODEL = "mini_downloaded_model";
const STORAGE_KEY_MODE  = "mini_app_mode";

function getSavedModel(): { name: string; path: string } | null {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY_MODEL) ?? "null"); }
  catch { return null; }
}
function setSavedModel(m: { name: string; path: string } | null) {
  m ? localStorage.setItem(STORAGE_KEY_MODEL, JSON.stringify(m))
     : localStorage.removeItem(STORAGE_KEY_MODEL);
}

// ─── Main Component ──────────────────────────────────────────────────────────
export default function Index() {
  // ── App-level state ────────────────────────────────────────────────────────
  const [mode, setMode]                 = useState<AppMode>(null);
  const [sysInfo, setSysInfo]           = useState<SystemInfo | null>(null);
  const [recommended, setRecommended]   = useState<AIModel | null>(null);
  const [theme, setTheme]               = useState<"light"|"dark">(
    () => (localStorage.getItem("mini_theme") as any) ?? "dark",
  );

  // ── Online-mode state (mirrors original Index.tsx) ─────────────────────────
  const [messages,    setMessages]      = useState<Msg[]>([]);
  const [input,       setInput]         = useState("");
  const [busy,        setBusy]          = useState(false);
  const [code,        setCode]          = useState("");
  const [codeType,    setCodeType]      = useState<Msg["codeType"]>("html");
  const [codeOutput,  setCodeOutput]    = useState("");
  const [tab,         setTab]           = useState<"chat"|"code"|"output">("chat");
  const [copied,      setCopied]        = useState(false);
  const [attachments, setAttachments]   = useState<Attachment[]>([]);
  const fileInputRef  = useRef<HTMLInputElement>(null);
  const chatEndRef    = useRef<HTMLDivElement>(null);

  // ── Offline-mode state ─────────────────────────────────────────────────────
  const [offlineStep, setOfflineStep]   = useState<"pick"|"warn"|"downloading"|"loading"|"chat">("pick");
  const [selectedModel, setSelectedModel] = useState<AIModel | null>(null);
  const [downloadId,  setDownloadId]    = useState<number | null>(null);
  const [downloadDone,setDownloadDone]  = useState(false);
  const [modelLoaded, setModelLoaded]   = useState(false);
  const [loadError,   setLoadError]     = useState<string | null>(null);
  const [offlineMsgs, setOfflineMsgs]   = useState<Msg[]>([]);
  const [offlineInput,setOfflineInput]  = useState("");
  const [offlineBusy, setOfflineBusy]   = useState(false);
  const offlineChatEnd = useRef<HTMLDivElement>(null);
  const [modelSysInfo, setModelSysInfo] = useState<string>("");

  // ── Init: read mode + system info ─────────────────────────────────────────
  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
    localStorage.setItem("mini_theme", theme);
  }, [theme]);

  useEffect(() => {
    // Try to load system info from native plugin
    if (SystemAnalyzer) {
      SystemAnalyzer.getSystemInfo().then((info: SystemInfo) => {
        setSysInfo(info);
        setRecommended(recommendModel(info.ram.totalMB));
      }).catch(() => {});
    }
    // Check if a model was previously downloaded
    const saved = getSavedModel();
    if (saved && mode === "offline") {
      setSelectedModel(AI_MODELS.find(m => m.name === saved.name) ?? null);
      setOfflineStep("loading");
    }
  }, []);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);
  useEffect(() => {
    offlineChatEnd.current?.scrollIntoView({ behavior: "smooth" });
  }, [offlineMsgs]);

  // ── Online send ────────────────────────────────────────────────────────────
  async function sendOnline() {
    if (!input.trim() && attachments.length === 0) return;
    const userMsg: Msg = { role: "user", chat: input, attachments };
    setMessages(m => [...m, userMsg, { role: "assistant", loading: true }]);
    setInput(""); setAttachments([]); setBusy(true);
    try {
      // Detect if user wants to run code
      const codeMatch = input.match(/```(\w+)?\n([\s\S]*?)```/);
      if (codeMatch) {
        const lang = codeMatch[1] ?? "python-3.14";
        const snippet = codeMatch[2];
        let output: string;
        if (AiEngine) {
          const r = await AiEngine.runCode({ code: snippet, language: lang });
          output = r.output;
        } else {
          output = await runOnlineCode(snippet, lang === "python" ? "python-3.14" : lang);
        }
        try { const parsed = JSON.parse(output); output = parsed.output ?? parsed.error ?? output; } catch {}
        setMessages(m => {
          const copy = [...m]; copy[copy.length - 1] = { role: "assistant", chat: `**Çıktı:**\n\`\`\`\n${output}\n\`\`\`` };
          return copy;
        });
        setCodeOutput(output); setCode(snippet); setCodeType("python"); setTab("output");
      } else {
        // Simple echo-based response placeholder (replace with your AI endpoint below)
        const apiEndpoint = (window as any).__MINI_AI_ENDPOINT ?? "";
        let reply = "";
        if (apiEndpoint) {
          const res = await fetch(apiEndpoint, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ prompt: input, history: messages.map(m => ({ role: m.role, content: m.chat ?? "" })) }),
          });
          const data = await res.json();
          reply = data.text ?? data.response ?? JSON.stringify(data);
        } else {
          reply = `Online moda hoş geldin! API uç noktanı \`window.__MINI_AI_ENDPOINT\` olarak ayarla.`;
        }
        setMessages(m => {
          const copy = [...m]; copy[copy.length - 1] = { role: "assistant", chat: reply };
          return copy;
        });
      }
    } catch (e: any) {
      const errMsg = e.message ?? String(e);
      setMessages(m => {
        const copy = [...m];
        copy[copy.length - 1] = {
          role: "assistant",
          chat: `❌ Hata: ${errMsg}\n\n[Google'da ara](https://www.google.com/search?q=${encodeURIComponent(errMsg)})`,
        };
        return copy;
      });
      searchError(errMsg);
    } finally { setBusy(false); }
  }

  // ── Offline: start download ────────────────────────────────────────────────
  async function startDownload() {
    if (!selectedModel) return;
    setOfflineStep("downloading");
    try {
      if (LlamaPlugin) {
        const res = await LlamaPlugin.downloadModel({ url: selectedModel.download_url });
        setDownloadId(res.downloadId);
        // DownloadManager handles it natively; notification will show progress.
        // Poll until the file can be loaded.
        pollDownloadCompletion(selectedModel, res.fileName);
      } else {
        // Browser fallback — just show instructions
        setLoadError("LlamaPlugin bulunamadı. Bu özellik yalnızca Android APK'da çalışır.");
      }
    } catch (e: any) {
      setLoadError(e.message); searchError(e.message);
    }
  }

  function pollDownloadCompletion(model: AIModel, fileName: string) {
    // Try loading model every 15 seconds once download starts
    const interval = setInterval(async () => {
      const modelPath = `/storage/emulated/0/Android/data/com.mini.app/files/Downloads/${fileName}`;
      try {
        if (LlamaPlugin) {
          const res = await LlamaPlugin.loadModel({ modelPath });
          if (res.success) {
            clearInterval(interval);
            setSavedModel({ name: model.name, path: modelPath });
            setModelSysInfo(res.info ?? "");
            setModelLoaded(true);
            setOfflineStep("chat");
            setOfflineMsgs([{
              role: "assistant",
              chat: `✅ Model yüklendi! Sistem: ${res.info ?? ""}\n\nArtık tamamen çevrimdışı çalışıyorsun. İnternet gerektirmez. Kod yazma, soru sorma, her şey burada!`,
            }]);
          }
        }
      } catch { /* still downloading */ }
    }, 15000);
  }

  // ── Offline: load existing model ───────────────────────────────────────────
  useEffect(() => {
    if (offlineStep !== "loading") return;
    const saved = getSavedModel();
    if (!saved || !LlamaPlugin) return;
    LlamaPlugin.loadModel({ modelPath: saved.path }).then((res: any) => {
      if (res.success) {
        setModelSysInfo(res.info ?? "");
        setModelLoaded(true);
        setOfflineStep("chat");
        setOfflineMsgs([{
          role: "assistant",
          chat: `✅ Model yüklendi! (${saved.name})\n\nTamamen çevrimdışı moddasın. İnternet yok — kod, sohbet, her şey çalışır.`,
        }]);
      }
    }).catch((e: any) => { setLoadError(e.message); searchError(e.message); });
  }, [offlineStep]);

  // ── Offline: send message ──────────────────────────────────────────────────
  async function sendOffline() {
    if (!offlineInput.trim()) return;
    const userMsg: Msg = { role: "user", chat: offlineInput };
    setOfflineMsgs(m => [...m, userMsg, { role: "assistant", loading: true }]);
    setOfflineInput(""); setOfflineBusy(true);

    try {
      // Build prompt with chat history
      const history = offlineMsgs
        .filter(m => m.chat)
        .map(m => `${m.role === "user" ? "User" : "Assistant"}: ${m.chat}`)
        .join("\n");
      const prompt = `${history}\nUser: ${offlineInput}\nAssistant:`;

      let reply = "";
      if (LlamaPlugin) {
        const res = await LlamaPlugin.generate({ prompt, formatChat: true });
        reply = res.text ?? "(boş yanıt)";
      } else {
        reply = "⚠️ LlamaPlugin bulunamadı. Bu özellik yalnızca Android APK'da çalışır.";
      }

      // Detect code blocks in reply
      const codeBlockMatch = reply.match(/```(\w+)?\n?([\s\S]*?)```/);
      if (codeBlockMatch) {
        const lang = (codeBlockMatch[1] ?? "text") as Msg["codeType"];
        setCode(codeBlockMatch[2]); setCodeType(lang);
      }

      setOfflineMsgs(m => {
        const copy = [...m]; copy[copy.length - 1] = { role: "assistant", chat: reply };
        return copy;
      });
    } catch (e: any) {
      const errMsg = e.message ?? String(e);
      setOfflineMsgs(m => {
        const copy = [...m];
        copy[copy.length - 1] = {
          role: "assistant",
          chat: `❌ Hata: ${errMsg}\n\n[Google'da ara](https://www.google.com/search?q=${encodeURIComponent(errMsg)})`,
        };
        return copy;
      });
      searchError(errMsg);
    } finally { setOfflineBusy(false); }
  }

  // ── Offline: run code block in output pane ─────────────────────────────────
  async function runCodeBlock(snippet: string, lang: string) {
    setTab("output"); setCodeOutput("Çalıştırılıyor...");
    try {
      let output = "";
      if (AiEngine) {
        const r = await AiEngine.runCode({ code: snippet, language: lang === "python" ? "python-3.14" : lang });
        output = r.output;
        try { const p = JSON.parse(output); output = p.output ?? p.error ?? output; } catch {}
      } else {
        output = "⚠️ Online kod çalıştırma yalnızca online modda çalışır.";
      }
      setCodeOutput(output);
    } catch (e: any) { setCodeOutput(`Hata: ${e.message}`); searchError(e.message); }
  }

  // ── File attachment handler ────────────────────────────────────────────────
  async function handleFilePick(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    for (const f of files) {
      if (f.size > 2 * 1024 * 1024) { alert(`${f.name} çok büyük (max 2MB)`); continue; }
      const text = await f.text();
      setAttachments(a => [...a, { kind: "file", name: f.name, data: text }]);
    }
    e.target.value = "";
  }

  // ── Render helpers ─────────────────────────────────────────────────────────
  const isDark = theme === "dark";
  const bg     = isDark ? "#0f0f1a" : "#f8fafc";
  const card   = isDark ? "#1a1a2e"  : "#ffffff";
  const border = isDark ? "#2d2d50"  : "#e2e8f0";
  const text   = isDark ? "#e2e8f0"  : "#0f172a";
  const muted  = isDark ? "#94a3b8"  : "#64748b";
  const accent = "#6366f1";
  const green  = "#22c55e";

  const btnStyle: React.CSSProperties = {
    padding: "10px 20px", borderRadius: 12, border: "none",
    background: accent, color: "#fff", cursor: "pointer",
    fontWeight: 600, fontSize: 14, transition: "opacity .15s",
  };
  const cardStyle: React.CSSProperties = {
    background: card, border: `1px solid ${border}`,
    borderRadius: 20, padding: 24,
  };
  const inputStyle: React.CSSProperties = {
    width: "100%", background: isDark ? "#0f0f1a" : "#f1f5f9",
    border: `1px solid ${border}`, borderRadius: 14, padding: "12px 16px",
    color: text, fontSize: 15, outline: "none", resize: "none",
    fontFamily: "inherit", boxSizing: "border-box",
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // SCREEN 0 — Mode Selection
  // ═══════════════════════════════════════════════════════════════════════════
  if (mode === null) {
    return (
      <div style={{ minHeight: "100vh", background: bg, color: text, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "24px", fontFamily: "'Inter', system-ui, sans-serif" }}>
        {/* Glow blobs */}
        <div style={{ position: "fixed", inset: 0, zIndex: 0, overflow: "hidden", pointerEvents: "none" }}>
          <div style={{ position: "absolute", top: -80, left: -80, width: 400, height: 400, borderRadius: "50%", background: "radial-gradient(circle, #6366f140 0%, transparent 70%)" }} />
          <div style={{ position: "absolute", bottom: -80, right: -80, width: 400, height: 400, borderRadius: "50%", background: "radial-gradient(circle, #8b5cf640 0%, transparent 70%)" }} />
        </div>

        <div style={{ position: "relative", zIndex: 1, width: "100%", maxWidth: 420, textAlign: "center" }}>
          {/* Logo */}
          <div style={{ width: 80, height: 80, borderRadius: 24, background: "linear-gradient(135deg,#6366f1,#8b5cf6)", margin: "0 auto 20px", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 36, boxShadow: "0 0 40px #6366f160" }}>
            🧠
          </div>
          <h1 style={{ fontSize: 32, fontWeight: 800, margin: "0 0 4px" }}>Mini AI</h1>
          <p style={{ color: muted, marginBottom: 12 }}>Yapay zeka asistanın</p>

          {/* System info badge */}
          {sysInfo && (
            <div style={{ background: isDark ? "#1a1a2e" : "#f1f5f9", border: `1px solid ${border}`, borderRadius: 12, padding: "10px 16px", marginBottom: 20, fontSize: 13, color: muted }}>
              📱 {sysInfo.device.brand} {sysInfo.device.model} &nbsp;·&nbsp;
              🧠 {(sysInfo.ram.totalMB / 1024).toFixed(1)} GB RAM &nbsp;·&nbsp;
              ⚡ {sysInfo.cpu.cores} çekirdek
              {recommended && (
                <div style={{ marginTop: 4, color: green }}>✨ Önerilen model: <b>{recommended.name.split("-").slice(0, 3).join(" ")}</b></div>
              )}
            </div>
          )}

          <p style={{ color: muted, marginBottom: 28, fontSize: 15 }}>Nasıl bağlanmak istiyorsun?</p>

          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {/* ONLINE */}
            <button
              onClick={() => setMode("online")}
              style={{ ...cardStyle, cursor: "pointer", textAlign: "left", border: `2px solid ${accent}`, transition: "transform .15s, box-shadow .15s", background: isDark ? "#1a1a2e" : "#f8fafc" }}
              onMouseOver={e => { (e.currentTarget as HTMLElement).style.transform = "scale(1.02)"; (e.currentTarget as HTMLElement).style.boxShadow = `0 0 30px ${accent}40`; }}
              onMouseOut={e  => { (e.currentTarget as HTMLElement).style.transform = "scale(1)"; (e.currentTarget as HTMLElement).style.boxShadow = "none"; }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                <span style={{ fontSize: 36 }}>🌐</span>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 18, color: text }}>Çevrimiçi</div>
                  <div style={{ color: muted, fontSize: 14 }}>Bulut AI • Hızlı • İnternet gerektirir</div>
                </div>
              </div>
            </button>

            {/* OFFLINE */}
            <button
              onClick={() => {
                const saved = getSavedModel();
                if (saved) { setMode("offline"); setOfflineStep("loading"); }
                else       { setMode("offline"); setOfflineStep("pick"); }
              }}
              style={{ ...cardStyle, cursor: "pointer", textAlign: "left", border: `2px solid ${green}`, transition: "transform .15s, box-shadow .15s", background: isDark ? "#1a1a2e" : "#f8fafc" }}
              onMouseOver={e => { (e.currentTarget as HTMLElement).style.transform = "scale(1.02)"; (e.currentTarget as HTMLElement).style.boxShadow = `0 0 30px ${green}40`; }}
              onMouseOut={e  => { (e.currentTarget as HTMLElement).style.transform = "scale(1)"; (e.currentTarget as HTMLElement).style.boxShadow = "none"; }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                <span style={{ fontSize: 36 }}>📴</span>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 18, color: text }}>Çevrimdışı</div>
                  <div style={{ color: muted, fontSize: 14 }}>Yerel GGUF modeli • İnternet gerektirmez</div>
                  {getSavedModel() && <div style={{ color: green, fontSize: 12, marginTop: 2 }}>✔ Model hazır: {getSavedModel()!.name.split("-").slice(0,3).join(" ")}</div>}
                </div>
              </div>
            </button>
          </div>

          <button onClick={() => setTheme(t => t === "dark" ? "light" : "dark")} style={{ marginTop: 24, background: "none", border: "none", cursor: "pointer", color: muted, fontSize: 13 }}>
            {isDark ? "☀️ Aydınlık mod" : "🌙 Karanlık mod"}
          </button>
        </div>
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // SCREEN 1 — ONLINE MODE
  // ═══════════════════════════════════════════════════════════════════════════
  if (mode === "online") {
    const lastCode = [...messages].reverse().find(m => m.code);
    const displayCode = lastCode?.code ?? code;
    const displayCodeType = lastCode?.codeType ?? codeType ?? "html";

    return (
      <div style={{ minHeight: "100vh", background: bg, color: text, fontFamily: "'Inter', system-ui, sans-serif", display: "flex", flexDirection: "column" }}>
        {/* Header */}
        <header style={{ borderBottom: `1px solid ${border}`, padding: "12px 20px", display: "flex", alignItems: "center", justifyContent: "space-between", background: card }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <button onClick={() => setMode(null)} style={{ background: "none", border: "none", cursor: "pointer", color: muted, fontSize: 20, padding: 4 }}>←</button>
            <span style={{ fontSize: 20 }}>🌐</span>
            <span style={{ fontWeight: 700 }}>Mini AI — Çevrimiçi</span>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            {(["chat","code","output"] as const).map(t => (
              <button key={t} onClick={() => setTab(t)} style={{ ...btnStyle, background: tab === t ? accent : "transparent", color: tab === t ? "#fff" : muted, padding: "6px 14px" }}>
                {t === "chat" ? "💬 Sohbet" : t === "code" ? "💻 Kod" : "▶ Çıktı"}
              </button>
            ))}
            <button onClick={() => setTheme(t => t === "dark" ? "light" : "dark")} style={{ background: "none", border: "none", cursor: "pointer", color: muted, fontSize: 18 }}>
              {isDark ? "☀️" : "🌙"}
            </button>
          </div>
        </header>

        {/* Tab content */}
        <main style={{ flex: 1, overflow: "auto", padding: "16px 20px" }}>
          {tab === "chat" && (
            <div style={{ maxWidth: 800, margin: "0 auto", display: "flex", flexDirection: "column", gap: 12, paddingBottom: 80 }}>
              {messages.length === 0 && (
                <div style={{ textAlign: "center", paddingTop: 60, color: muted }}>
                  <div style={{ fontSize: 48, marginBottom: 12 }}>🧠</div>
                  <div style={{ fontSize: 20, fontWeight: 700, color: text }}>Merhaba! Ben Mini.</div>
                  <div style={{ marginTop: 8 }}>Kod yaz, soru sor, her şeyi yapabilirim.</div>
                  <div style={{ marginTop: 6, fontSize: 13 }}>Kod çalıştırmak için: <code style={{ background: isDark ? "#1a1a2e" : "#f1f5f9", padding: "2px 6px", borderRadius: 6 }}>```python\nprint("hello")\n```</code></div>
                </div>
              )}
              {messages.map((m, i) => (
                <div key={i} style={{ display: "flex", justifyContent: m.role === "user" ? "flex-end" : "flex-start" }}>
                  <div style={{ maxWidth: "85%", borderRadius: 18, padding: "12px 16px", fontSize: 15, lineHeight: 1.6, background: m.role === "user" ? "linear-gradient(135deg,#6366f1,#8b5cf6)" : card, color: m.role === "user" ? "#fff" : text, border: m.role === "user" ? "none" : `1px solid ${border}` }}>
                    {m.loading ? <span style={{ opacity: 0.6 }}>Düşünüyor...</span> : (
                      <span style={{ whiteSpace: "pre-wrap" }}>{m.chat}</span>
                    )}
                    {m.code && (
                      <div style={{ marginTop: 8 }}>
                        <button onClick={() => { setCode(m.code!); setCodeType(m.codeType); setTab("code"); }} style={{ ...btnStyle, padding: "6px 12px", fontSize: 12, background: "#22c55e20", color: green, border: `1px solid ${green}` }}>
                          💻 Kodu Gör
                        </button>
                      </div>
                    )}
                    {m.attachments?.map((a, j) => (
                      <div key={j} style={{ marginTop: 6, fontSize: 12, opacity: 0.7 }}>📎 {a.name}</div>
                    ))}
                  </div>
                </div>
              ))}
              <div ref={chatEndRef} />
            </div>
          )}

          {tab === "code" && (
            <div style={{ maxWidth: 900, margin: "0 auto" }}>
              <div style={{ ...cardStyle, fontFamily: "monospace" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                  <span style={{ fontSize: 13, color: muted }}>📄 {displayCodeType?.toUpperCase()}</span>
                  <div style={{ display: "flex", gap: 8 }}>
                    <button onClick={() => { navigator.clipboard.writeText(displayCode); setCopied(true); setTimeout(() => setCopied(false), 1500); }} style={{ ...btnStyle, padding: "6px 12px", fontSize: 12 }}>
                      {copied ? "✅ Kopyalandı" : "📋 Kopyala"}
                    </button>
                    {(displayCodeType === "python" || displayCodeType === "js") && (
                      <button onClick={() => runCodeBlock(displayCode, displayCodeType)} style={{ ...btnStyle, padding: "6px 12px", fontSize: 12, background: green }}>
                        ▶ Çalıştır
                      </button>
                    )}
                    {displayCodeType === "html" && (
                      <button onClick={() => setTab("output")} style={{ ...btnStyle, padding: "6px 12px", fontSize: 12, background: "#f59e0b" }}>
                        👁 Önizle
                      </button>
                    )}
                  </div>
                </div>
                <pre style={{ margin: 0, overflowX: "auto", fontSize: 13, lineHeight: 1.6, color: isDark ? "#a5f3fc" : "#0f172a" }}>{displayCode || "// Henüz kod yok"}</pre>
              </div>
            </div>
          )}

          {tab === "output" && (
            <div style={{ maxWidth: 900, margin: "0 auto" }}>
              {displayCodeType === "html" ? (
                <iframe
                  srcDoc={displayCode}
                  style={{ width: "100%", height: 600, border: `1px solid ${border}`, borderRadius: 16, background: "#fff" }}
                  sandbox="allow-scripts allow-same-origin"
                  title="preview"
                />
              ) : (
                <div style={{ ...cardStyle, fontFamily: "monospace" }}>
                  <div style={{ fontSize: 13, color: muted, marginBottom: 8 }}>▶ Çıktı</div>
                  <pre style={{ margin: 0, color: green, fontSize: 13, lineHeight: 1.6, whiteSpace: "pre-wrap" }}>{codeOutput || "Henüz çıktı yok. Kodu çalıştır."}</pre>
                </div>
              )}
            </div>
          )}
        </main>

        {/* Input bar */}
        <div style={{ position: "sticky", bottom: 0, background: card, borderTop: `1px solid ${border}`, padding: "12px 20px" }}>
          {attachments.length > 0 && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 8 }}>
              {attachments.map((a, i) => (
                <span key={i} style={{ background: isDark ? "#1a1a2e" : "#f1f5f9", border: `1px solid ${border}`, borderRadius: 20, padding: "4px 12px", fontSize: 13, display: "flex", alignItems: "center", gap: 6 }}>
                  📎 {a.name}
                  <button onClick={() => setAttachments(x => x.filter((_, j) => j !== i))} style={{ background: "none", border: "none", cursor: "pointer", color: "#ef4444", fontSize: 16, lineHeight: 1 }}>×</button>
                </span>
              ))}
            </div>
          )}
          <div style={{ display: "flex", gap: 8, alignItems: "flex-end", maxWidth: 800, margin: "0 auto" }}>
            <button onClick={() => fileInputRef.current?.click()} style={{ ...btnStyle, background: isDark ? "#1a1a2e" : "#f1f5f9", color: text, padding: "12px 14px", flexShrink: 0 }} title="Dosya ekle">📎</button>
            <textarea
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) { e.preventDefault(); if (!busy) sendOnline(); } }}
              placeholder="Mesaj yaz... (Ctrl+Enter gönder)"
              rows={2}
              style={{ ...inputStyle, flex: 1, minHeight: 48 }}
            />
            <button onClick={sendOnline} disabled={busy} style={{ ...btnStyle, padding: "12px 18px", flexShrink: 0, opacity: busy ? 0.5 : 1 }}>
              {busy ? "⏳" : "➤"}
            </button>
          </div>
          <input ref={fileInputRef} type="file" multiple hidden onChange={handleFilePick} />
        </div>
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // SCREEN 2 — OFFLINE MODE
  // ═══════════════════════════════════════════════════════════════════════════
  if (mode === "offline") {

    // ── Step: model picker ────────────────────────────────────────────────────
    if (offlineStep === "pick") {
      return (
        <div style={{ minHeight: "100vh", background: bg, color: text, fontFamily: "'Inter', system-ui, sans-serif", padding: 20 }}>
          <header style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 24, paddingBottom: 16, borderBottom: `1px solid ${border}` }}>
            <button onClick={() => { setMode(null); setOfflineStep("pick"); }} style={{ background: "none", border: "none", cursor: "pointer", color: muted, fontSize: 22 }}>←</button>
            <span style={{ fontSize: 22 }}>📴</span>
            <div>
              <div style={{ fontWeight: 700, fontSize: 18 }}>Çevrimdışı Mod — Model Seç</div>
              <div style={{ color: muted, fontSize: 13 }}>Model ilk indirme için internet gerekir; sonrası internetsiz çalışır</div>
            </div>
          </header>

          {/* System info + recommendation */}
          {sysInfo && recommended && (
            <div style={{ ...cardStyle, marginBottom: 20, borderColor: green, background: isDark ? "#052e16" : "#f0fdf4" }}>
              <div style={{ fontWeight: 700, color: green, marginBottom: 8 }}>✨ Cihazına Göre Öneri</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, fontSize: 13, color: muted, marginBottom: 12 }}>
                <span>🧠 RAM: {(sysInfo.ram.totalMB/1024).toFixed(1)} GB</span>
                <span>⚡ CPU: {sysInfo.cpu.cores} çekirdek</span>
                <span>📱 {sysInfo.device.brand} {sysInfo.device.model}</span>
                <span>🤖 Android {sysInfo.device.androidVersion}</span>
              </div>
              <div style={{ fontWeight: 600, color: text }}>
                Önerilen: <span style={{ color: accent }}>{recommended.name.split("-").slice(0,4).join(" ")}</span> ({recommended.parameters})
              </div>
              <div style={{ fontSize: 12, color: muted, marginTop: 4 }}>{formatBytes(recommended.gguf_size_bytes)} indirme</div>
              <button onClick={() => { setSelectedModel(recommended); setOfflineStep("warn"); }} style={{ ...btnStyle, marginTop: 12, background: green }}>
                Bu modeli kullan →
              </button>
            </div>
          )}

          {/* All models list */}
          <div style={{ fontWeight: 700, marginBottom: 12, color: muted, fontSize: 13, textTransform: "uppercase", letterSpacing: 1 }}>Tüm Modeller</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {AI_MODELS.map(m => (
              <button
                key={m.name}
                onClick={() => { setSelectedModel(m); setOfflineStep("warn"); }}
                style={{ ...cardStyle, cursor: "pointer", textAlign: "left", border: `1px solid ${selectedModel?.name === m.name ? accent : border}`, transition: "border-color .15s" }}
              >
                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 4 }}>{m.name.split("-").slice(0, 5).join(" ")}</div>
                    <div style={{ color: muted, fontSize: 13 }}>{m.description}</div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginTop: 8 }}>
                      {m.abilities.map(a => (
                        <span key={a} style={{ background: isDark ? "#1e293b" : "#f1f5f9", border: `1px solid ${border}`, borderRadius: 20, padding: "2px 10px", fontSize: 11, color: muted }}>
                          {a}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div style={{ textAlign: "right", flexShrink: 0 }}>
                    <div style={{ fontWeight: 700, color: accent, fontSize: 16 }}>{m.parameters}</div>
                    <div style={{ fontSize: 12, color: muted }}>{formatBytes(m.gguf_size_bytes)}</div>
                    {recommended?.name === m.name && <div style={{ fontSize: 11, color: green, marginTop: 2 }}>★ Önerilen</div>}
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>
      );
    }

    // ── Step: download warning ─────────────────────────────────────────────────
    if (offlineStep === "warn" && selectedModel) {
      return (
        <div style={{ minHeight: "100vh", background: bg, color: text, fontFamily: "'Inter', system-ui, sans-serif", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
          <div style={{ ...cardStyle, maxWidth: 440, width: "100%", textAlign: "center" }}>
            <div style={{ fontSize: 56, marginBottom: 16 }}>⚠️</div>
            <h2 style={{ fontSize: 22, fontWeight: 800, marginBottom: 12 }}>İndirme Uyarısı</h2>
            <p style={{ color: muted, lineHeight: 1.7, marginBottom: 8 }}>
              <b style={{ color: text }}>{selectedModel.name.split("-").slice(0,5).join(" ")}</b> modeli indirilecek.
            </p>
            <div style={{ background: isDark ? "#1a1a2e" : "#f8fafc", border: `1px solid ${border}`, borderRadius: 12, padding: "16px", marginBottom: 20, textAlign: "left" }}>
              <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
                <span>📦</span>
                <span style={{ color: muted }}>İndirme boyutu: <b style={{ color: text }}>{formatBytes(selectedModel.gguf_size_bytes)}</b></span>
              </div>
              <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
                <span>📶</span>
                <span style={{ color: muted }}>İndirme için <b style={{ color: "#f59e0b" }}>internet bağlantısı gerekir</b></span>
              </div>
              <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
                <span>📴</span>
                <span style={{ color: muted }}>İndirme tamamlandıktan sonra <b style={{ color: green }}>tamamen internetsiz çalışır</b></span>
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <span>🔒</span>
                <span style={{ color: muted }}>Hiçbir verin buluta gönderilmez</span>
              </div>
            </div>
            <p style={{ fontSize: 13, color: muted, marginBottom: 20 }}>
              İndirme sistem bildirimi olarak arka planda çalışır. Tamamlandığında model otomatik yüklenir.
            </p>
            <div style={{ display: "flex", gap: 12 }}>
              <button onClick={() => setOfflineStep("pick")} style={{ ...btnStyle, flex: 1, background: isDark ? "#1a1a2e" : "#f1f5f9", color: text, border: `1px solid ${border}` }}>
                ← Geri
              </button>
              <button onClick={startDownload} style={{ ...btnStyle, flex: 2, background: green }}>
                📥 İndir ve Devam Et
              </button>
            </div>
          </div>
        </div>
      );
    }

    // ── Step: downloading ──────────────────────────────────────────────────────
    if (offlineStep === "downloading") {
      return (
        <div style={{ minHeight: "100vh", background: bg, color: text, fontFamily: "'Inter', system-ui, sans-serif", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
          <div style={{ ...cardStyle, maxWidth: 400, width: "100%", textAlign: "center" }}>
            <div style={{ fontSize: 56, marginBottom: 16 }}>📥</div>
            <h2 style={{ fontSize: 22, fontWeight: 800, marginBottom: 8 }}>İndiriliyor...</h2>
            <p style={{ color: muted, lineHeight: 1.7, marginBottom: 20 }}>
              Model arka planda indiriliyor. Bildirim çubuğunda ilerlemeyi görebilirsin.
            </p>
            {/* Animated bar */}
            <div style={{ height: 8, background: isDark ? "#1a1a2e" : "#f1f5f9", borderRadius: 999, overflow: "hidden", marginBottom: 16 }}>
              <div style={{ height: "100%", width: "60%", background: `linear-gradient(90deg,${accent},${green})`, borderRadius: 999, animation: "pulse 2s ease-in-out infinite" }} />
            </div>
            <p style={{ fontSize: 13, color: muted }}>
              {selectedModel?.name.split("-").slice(0,4).join(" ")} • {formatBytes(selectedModel?.gguf_size_bytes ?? null)}
            </p>
            {loadError && (
              <div style={{ marginTop: 16, padding: 12, background: "#7f1d1d", borderRadius: 12, color: "#fca5a5", fontSize: 13 }}>
                ❌ {loadError}
                <br />
                <button onClick={() => searchError(loadError)} style={{ ...btnStyle, marginTop: 8, padding: "6px 12px", fontSize: 12, background: "#dc2626" }}>
                  🔍 Google'da Ara
                </button>
              </div>
            )}
            <p style={{ fontSize: 12, color: muted, marginTop: 16 }}>
              İndirme tamamlanınca uygulama otomatik devam eder.
            </p>
          </div>
        </div>
      );
    }

    // ── Step: loading model ────────────────────────────────────────────────────
    if (offlineStep === "loading") {
      return (
        <div style={{ minHeight: "100vh", background: bg, color: text, fontFamily: "'Inter', system-ui, sans-serif", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
          <div style={{ ...cardStyle, maxWidth: 380, width: "100%", textAlign: "center" }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>⚙️</div>
            <h2 style={{ fontSize: 20, fontWeight: 800, marginBottom: 8 }}>Model Yükleniyor</h2>
            <p style={{ color: muted, fontSize: 14, marginBottom: 20 }}>Model RAM'e yükleniyor, lütfen bekle...</p>
            {loadError && (
              <div style={{ padding: 12, background: "#7f1d1d", borderRadius: 12, color: "#fca5a5", fontSize: 13, textAlign: "left" }}>
                ❌ Hata: {loadError}
                <br /><br />
                <button onClick={() => { setSavedModel(null); setOfflineStep("pick"); setLoadError(null); }} style={{ ...btnStyle, background: "#dc2626", padding: "8px 12px", fontSize: 12, marginRight: 8 }}>
                  Modeli Sil & Yeniden Seç
                </button>
                <button onClick={() => searchError(loadError)} style={{ ...btnStyle, padding: "8px 12px", fontSize: 12 }}>
                  🔍 Google
                </button>
              </div>
            )}
          </div>
        </div>
      );
    }

    // ── Step: offline chat ─────────────────────────────────────────────────────
    if (offlineStep === "chat") {
      return (
        <div style={{ minHeight: "100vh", background: bg, color: text, fontFamily: "'Inter', system-ui, sans-serif", display: "flex", flexDirection: "column" }}>
          {/* Header */}
          <header style={{ borderBottom: `1px solid ${border}`, padding: "12px 20px", display: "flex", alignItems: "center", justifyContent: "space-between", background: card }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <button onClick={() => setMode(null)} style={{ background: "none", border: "none", cursor: "pointer", color: muted, fontSize: 20 }}>←</button>
              <span style={{ fontSize: 20 }}>📴</span>
              <div>
                <div style={{ fontWeight: 700 }}>Mini AI — Çevrimdışı</div>
                <div style={{ fontSize: 11, color: green }}>● İnternetsiz · {getSavedModel()?.name.split("-").slice(0,3).join(" ")}</div>
              </div>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              {(["chat","code","output"] as const).map(t => (
                <button key={t} onClick={() => setTab(t)} style={{ ...btnStyle, background: tab === t ? accent : "transparent", color: tab === t ? "#fff" : muted, padding: "6px 14px", fontSize: 13 }}>
                  {t === "chat" ? "💬" : t === "code" ? "💻" : "▶"}
                </button>
              ))}
              <button onClick={() => { if (confirm("Modeli kaldır ve yeniden seç?")) { if (LlamaPlugin) LlamaPlugin.unloadModel(); setSavedModel(null); setOfflineStep("pick"); setOfflineMsgs([]); } }} style={{ ...btnStyle, background: "none", color: "#ef4444", padding: "6px 10px" }} title="Modeli değiştir">🗑</button>
            </div>
          </header>

          {/* Chat / Code / Output */}
          <main style={{ flex: 1, overflow: "auto", padding: "16px 20px" }}>
            {tab === "chat" && (
              <div style={{ maxWidth: 800, margin: "0 auto", display: "flex", flexDirection: "column", gap: 12, paddingBottom: 80 }}>
                {offlineMsgs.map((m, i) => (
                  <div key={i} style={{ display: "flex", justifyContent: m.role === "user" ? "flex-end" : "flex-start" }}>
                    <div style={{ maxWidth: "88%", borderRadius: 18, padding: "12px 16px", fontSize: 15, lineHeight: 1.6, background: m.role === "user" ? "linear-gradient(135deg,#059669,#10b981)" : card, color: m.role === "user" ? "#fff" : text, border: m.role === "user" ? "none" : `1px solid ${border}` }}>
                      {m.loading ? (
                        <span style={{ opacity: 0.6 }}>🧠 Düşünüyor...</span>
                      ) : (
                        <span style={{ whiteSpace: "pre-wrap" }}>{m.chat}</span>
                      )}
                      {/* Run code button if message has a code block */}
                      {!m.loading && m.role === "assistant" && m.chat?.includes("```") && (() => {
                        const match = m.chat.match(/```(\w+)?\n?([\s\S]*?)```/);
                        if (!match) return null;
                        const [, lang, snippet] = match;
                        return (
                          <div style={{ marginTop: 8, display: "flex", gap: 8 }}>
                            <button onClick={() => { setCode(snippet); setCodeType((lang ?? "text") as any); setTab("code"); }} style={{ ...btnStyle, padding: "5px 10px", fontSize: 12, background: accent }}>💻 Kodu Gör</button>
                            {(lang === "python" || lang === "js") && (
                              <button onClick={() => runCodeBlock(snippet, lang)} style={{ ...btnStyle, padding: "5px 10px", fontSize: 12, background: green }}>▶ Çalıştır</button>
                            )}
                          </div>
                        );
                      })()}
                    </div>
                  </div>
                ))}
                <div ref={offlineChatEnd} />
              </div>
            )}

            {tab === "code" && (
              <div style={{ maxWidth: 900, margin: "0 auto" }}>
                <div style={{ ...cardStyle }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                    <span style={{ fontSize: 13, color: muted }}>💻 {(codeType ?? "text").toUpperCase()}</span>
                    <div style={{ display: "flex", gap: 8 }}>
                      <button onClick={() => { navigator.clipboard.writeText(code); setCopied(true); setTimeout(() => setCopied(false), 1500); }} style={{ ...btnStyle, padding: "6px 12px", fontSize: 12 }}>
                        {copied ? "✅" : "📋"} {copied ? "Kopyalandı" : "Kopyala"}
                      </button>
                      {(codeType === "python" || codeType === "js") && (
                        <button onClick={() => runCodeBlock(code, codeType)} style={{ ...btnStyle, padding: "6px 12px", fontSize: 12, background: green }}>▶ Çalıştır</button>
                      )}
                    </div>
                  </div>
                  <pre style={{ margin: 0, overflowX: "auto", fontSize: 13, lineHeight: 1.6, color: isDark ? "#a5f3fc" : "#0f172a", whiteSpace: "pre-wrap" }}>{code || "// Model henüz kod üretmedi"}</pre>
                </div>
              </div>
            )}

            {tab === "output" && (
              <div style={{ maxWidth: 900, margin: "0 auto" }}>
                <div style={{ ...cardStyle }}>
                  <div style={{ fontSize: 13, color: muted, marginBottom: 8 }}>▶ Kod Çıktısı</div>
                  <pre style={{ margin: 0, color: green, fontSize: 13, lineHeight: 1.6, whiteSpace: "pre-wrap" }}>{codeOutput || "Henüz çıktı yok."}</pre>
                </div>
              </div>
            )}
          </main>

          {/* Input bar */}
          <div style={{ position: "sticky", bottom: 0, background: card, borderTop: `1px solid ${border}`, padding: "12px 20px" }}>
            <div style={{ maxWidth: 800, margin: "0 auto", display: "flex", gap: 8, alignItems: "flex-end" }}>
              <textarea
                value={offlineInput}
                onChange={e => setOfflineInput(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) { e.preventDefault(); if (!offlineBusy) sendOffline(); } }}
                placeholder="Mesaj yaz... (Ctrl+Enter gönder) — İnternet yok, model yerel çalışıyor"
                rows={2}
                style={{ ...inputStyle, flex: 1 }}
              />
              <button onClick={sendOffline} disabled={offlineBusy} style={{ ...btnStyle, background: green, padding: "12px 18px", flexShrink: 0, opacity: offlineBusy ? 0.5 : 1 }}>
                {offlineBusy ? "⏳" : "➤"}
              </button>
            </div>
            <div style={{ textAlign: "center", fontSize: 11, color: muted, marginTop: 6 }}>
              📴 Çevrimdışı — Hiçbir veri internete gitmiyor • {modelSysInfo.slice(0, 60)}
            </div>
          </div>
        </div>
      );
    }

    return null;
  }

  return null;
}
