"use client";
import { useEffect, useRef, useState, useCallback } from "react";
import { usePulseSTT } from "../lib/usePulseSTT";
import { useLightningTTS } from "../lib/useLightningTTS";

type Mode = "echo" | "chat";
type Status = "idle" | "listening" | "thinking" | "speaking";
type Role = "user" | "assistant";

interface Word { text: string; spoken: boolean; current: boolean; }
interface Message {
  id: string;
  role: Role;
  words: Word[];          // for assistant karaoke + replay
  text: string;           // canonical text for replay
  done: boolean;
}

const STATUS_LABEL: Record<Status, string> = {
  idle: "ready",
  listening: "listening",
  thinking: "thinking",
  speaking: "speaking",
};

// Split into rendered word tokens. Keep whitespace runs as part of the next word
// for natural reflow.
function tokenize(text: string): Word[] {
  return text
    .split(/(\s+)/)
    .filter((s) => s.length > 0)
    .map((s) => ({ text: s, spoken: false, current: false }));
}

// Splits *new* incoming text into sentence-bounded flushable chunks.
class SentenceFlusher {
  private buffer = "";
  push(chunk: string): string[] {
    this.buffer += chunk;
    const out: string[] = [];
    // Flush on . ! ? followed by space or end; also flush on commas after 80+ chars
    // to keep TTS latency low on long replies without commas.
    const re = /([^.!?]+[.!?]+(?:\s|$))/g;
    let lastIdx = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(this.buffer)) !== null) {
      out.push(m[1].trim());
      lastIdx = m.index + m[1].length;
    }
    if (lastIdx > 0) this.buffer = this.buffer.slice(lastIdx);
    if (this.buffer.length > 120) {
      // long no-punctuation tail — flush a chunk on the last comma or whitespace
      const cut = Math.max(this.buffer.lastIndexOf(", "), this.buffer.lastIndexOf(" "));
      if (cut > 60) {
        out.push(this.buffer.slice(0, cut + 1).trim());
        this.buffer = this.buffer.slice(cut + 1);
      }
    }
    return out;
  }
  flushFinal(): string | null {
    const t = this.buffer.trim();
    this.buffer = "";
    return t || null;
  }
}

export default function Page() {
  const [mode, setMode] = useState<Mode>("chat");
  const [echoEnabled, setEchoEnabled] = useState(false);
  const [status, setStatus] = useState<Status>("idle");
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState("");
  const [apiKey, setApiKey] = useState<string>("");

  // Force mode back to chat whenever echo gets disabled
  useEffect(() => { if (!echoEnabled && mode === "echo") setMode("chat"); }, [echoEnabled, mode]);

  const scrollRef = useRef<HTMLDivElement>(null);
  const tts = useLightningTTS();

  // Pull key from server on mount.
  useEffect(() => {
    fetch("/api/key")
      .then((r) => r.json())
      .then((d) => setApiKey(d.key))
      .catch(() => {});
  }, []);

  // Auto-scroll
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  // --- Karaoke word-highlight helper ---
  const highlightWord = useCallback((messageId: string, wordIndex: number) => {
    setMessages((prev) =>
      prev.map((m) => {
        if (m.id !== messageId) return m;
        const words = m.words.map((w, i) => ({
          ...w,
          current: i === wordIndex,
          spoken: i < wordIndex || w.spoken,
        }));
        return { ...m, words };
      })
    );
  }, []);

  // --- Speak text (assistant) ---
  // Note: Smallest TTS WS does not emit per-word timestamps in chunk frames as of
  // this writing, so the karaoke-style word highlight is not driven here. We mark
  // the whole bubble "spoken" once playback ends. The text stays live in the bubble.
  const speak = useCallback(
    (text: string, messageId: string) => {
      if (!text.trim()) return;
      console.log("[ui] speak:", text.slice(0, 60));
      setStatus("speaking");
      tts.speak({
        apiKey,
        text,
        voice: "avery",
        model: "lightning_v3.1",
        onEnd: () => {
          setStatus("idle");
          setMessages((prev) =>
            prev.map((m) =>
              m.id !== messageId
                ? m
                : { ...m, words: m.words.map((w) => ({ ...w, spoken: true, current: false })) }
            )
          );
        },
        onError: (msg) => {
          console.error("[ui] tts error:", msg);
          setStatus("idle");
        },
      });
    },
    [apiKey, tts]
  );

  // --- Submit handler: routes to echo or chat mode ---
  const handleSubmit = useCallback(
    async (utterance: string) => {
      const text = utterance.trim();
      if (!text) return;
      const userMsg: Message = {
        id: `u-${Date.now()}`,
        role: "user",
        text,
        words: tokenize(text),
        done: true,
      };
      setMessages((prev) => [...prev, userMsg]);
      setInputText("");

      if (mode === "echo") {
        // Direct echo: user's STT-final → TTS, no LLM
        const asstMsg: Message = {
          id: `a-${Date.now()}`,
          role: "assistant",
          text,
          words: tokenize(text),
          done: true,
        };
        setMessages((prev) => [...prev, asstMsg]);
        setTimeout(() => speak(text, asstMsg.id), 100);
        return;
      }

      // Chat mode — stream LLM, flush to TTS at sentence boundaries
      setStatus("thinking");
      const asstId = `a-${Date.now()}`;
      const asstMsg: Message = { id: asstId, role: "assistant", text: "", words: [], done: false };
      setMessages((prev) => [...prev, asstMsg]);

      const flusher = new SentenceFlusher();
      const ttsQueue: string[] = [];
      let ttsRunning = false;
      let llmDone = false;
      const maybeIdle = () => {
        if (llmDone && !ttsRunning && ttsQueue.length === 0) setStatus("idle");
      };
      const pumpTTS = () => {
        if (ttsRunning) return;
        const chunk = ttsQueue.shift();
        if (!chunk) {
          maybeIdle();
          return;
        }
        ttsRunning = true;
        tts.speak({
          apiKey,
          text: chunk,
          voice: "avery",
          model: "lightning_v3.1",
          onStart: () => setStatus("speaking"),
          onEnd: () => {
            ttsRunning = false;
            pumpTTS();
          },
          onError: (msg) => {
            console.error("[chat] tts chunk error:", msg);
            ttsRunning = false;
            pumpTTS();
          },
        });
      };

      try {
        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message: text }),
        });
        if (!res.body) throw new Error("no body");
        const reader = res.body.getReader();
        const dec = new TextDecoder();
        let assembled = "";
        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          const chunk = dec.decode(value, { stream: true });
          assembled += chunk;
          setMessages((prev) =>
            prev.map((m) => (m.id === asstId ? { ...m, text: assembled, words: tokenize(assembled) } : m))
          );
          for (const sent of flusher.push(chunk)) {
            ttsQueue.push(sent);
            pumpTTS();
          }
        }
        const tail = flusher.flushFinal();
        if (tail) {
          ttsQueue.push(tail);
          pumpTTS();
        }
        setMessages((prev) => prev.map((m) => (m.id === asstId ? { ...m, done: true } : m)));
        llmDone = true;
        maybeIdle();   // if no TTS chunks were ever queued, drop status back now
      } catch (e) {
        console.error("[chat] llm stream error:", e);
        llmDone = true;
        setStatus("idle");
      }
    },
    [apiKey, mode, speak, tts]
  );

  // --- Pulse STT hook ---
  const { recording, partial, start, stop } = usePulseSTT({
    apiKey,
    language: "en",
    onEvent: (e) => {
      console.log("[stt]", e.type, "text" in e ? e.text : "");
      if (e.type === "open") setStatus("listening");
      if (e.type === "close") {
        // safety: if we hit close without a final, drop status back to idle
        setStatus((s) => (s === "listening" ? "idle" : s));
      }
      if (e.type === "final") {
        // STT final → auto-submit and stop the mic
        setStatus("idle");
        stop();
        handleSubmit(e.text);
      }
    },
  });

  // Push-to-talk: mousedown to start, mouseup/leave/touchend to stop.
  // We also accept a quick click as a tap-to-toggle for desktop users who
  // don't like holding buttons.
  const heldRef = useRef(false);
  const micDown = () => {
    if (!apiKey) return;
    if (!recording) {
      heldRef.current = true;
      start();
    }
  };
  const micUp = () => {
    if (heldRef.current && recording) {
      heldRef.current = false;
      stop();
    }
  };
  const micToggle = () => {
    if (!apiKey) return;
    if (heldRef.current) return;  // already handled by mousedown/up cycle
    recording ? stop() : start();
  };

  return (
    <div className="app">
      <div className="header">
        <div className="logo">S</div>
        <div>
          <div className="title">Smallest AI — live voice chat</div>
          <div className="subtitle">Pulse STT WS · Lightning v3.1 TTS WS</div>
        </div>
        <div className="status-pill" data-state={status}>
          <span className="dot" />
          {STATUS_LABEL[status]}
        </div>
      </div>

      {echoEnabled && (
        <div style={{ padding: "10px 16px", display: "flex", gap: 8, borderBottom: "1px solid var(--line)" }}>
          <button
            onClick={() => setMode("chat")}
            style={{
              padding: "6px 14px",
              borderRadius: 999,
              border: "1px solid var(--line)",
              background: mode === "chat" ? "var(--accent)" : "var(--panel-2)",
              color: mode === "chat" ? "#0b0d10" : "var(--text)",
              cursor: "pointer",
              fontWeight: 600,
              fontSize: 12,
            }}
          >
            Chat (STT → LLM → TTS)
          </button>
          <button
            onClick={() => setMode("echo")}
            style={{
              padding: "6px 14px",
              borderRadius: 999,
              border: "1px solid var(--line)",
              background: mode === "echo" ? "var(--accent)" : "var(--panel-2)",
              color: mode === "echo" ? "#0b0d10" : "var(--text)",
              cursor: "pointer",
              fontWeight: 600,
              fontSize: 12,
            }}
          >
            Echo (STT → TTS)
          </button>
        </div>
      )}

      <div className="stream" ref={scrollRef}>
        {messages.length === 0 && (
          <div className="footer-note" style={{ marginTop: 40 }}>
            {mode === "echo"
              ? "Hold the mic and speak. We'll transcribe in real time, then echo it back through Lightning TTS."
              : "Hold the mic and speak — or type below. The bot streams its reply as text and speaks it in parallel."}
          </div>
        )}
        {messages.map((m) => (
          <div key={m.id} className={`msg ${m.role}`}>
            <div className="bubble">
              {m.role === "assistant" ? (
                <>
                  {m.words.map((w, i) => (
                    <span
                      key={i}
                      className={`word ${w.current ? "current" : ""} ${w.spoken ? "spoken" : ""}`}
                    >
                      {w.text}
                    </span>
                  ))}
                  {m.text && (
                    <div className="meta">
                      <button
                        className="replay"
                        onClick={() => speak(m.text, m.id)}
                        title="Re-stream this message through Lightning TTS"
                      >
                        ▶ replay
                      </button>
                    </div>
                  )}
                </>
              ) : (
                m.text
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="composer">
        <button
          className="mic"
          data-active={recording}
          onMouseDown={micDown}
          onMouseUp={micUp}
          onMouseLeave={micUp}
          onTouchStart={(e) => { e.preventDefault(); micDown(); }}
          onTouchEnd={(e) => { e.preventDefault(); micUp(); }}
          onClick={micToggle}
          title={recording ? "Release to stop" : "Hold to talk (or tap)"}
        >
          {recording ? (
            <div className="waveform">
              <span /><span /><span /><span /><span />
            </div>
          ) : (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
              <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
              <line x1="12" y1="19" x2="12" y2="23" />
              <line x1="8" y1="23" x2="16" y2="23" />
            </svg>
          )}
        </button>
        <input
          className={`input ${partial ? "live" : ""}`}
          placeholder={recording ? "Listening…" : "Type or hold the mic"}
          value={partial || inputText}
          onChange={(e) => setInputText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && inputText.trim()) handleSubmit(inputText);
          }}
          readOnly={recording}
        />
        <button
          className="send"
          onClick={() => handleSubmit(inputText)}
          disabled={!inputText.trim() || recording}
          title="Send"
        >
          ↑
        </button>
      </div>

      <div className="footer-note" style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 12 }}>
        <span>{apiKey ? "API key loaded" : "⚠ set SMALLEST_API_KEY in .env.local"}</span>
        <span style={{ opacity: 0.5 }}>·</span>
        <label style={{ cursor: "pointer", userSelect: "none", display: "inline-flex", alignItems: "center", gap: 6 }}>
          <input
            type="checkbox"
            checked={echoEnabled}
            onChange={(e) => setEchoEnabled(e.target.checked)}
            style={{ accentColor: "var(--accent)" }}
          />
          Enable echo mode (STT→TTS, no LLM)
        </label>
      </div>
    </div>
  );
}
