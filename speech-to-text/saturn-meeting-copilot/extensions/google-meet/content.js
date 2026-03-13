/**
 * Saturn × Google Meet — content script
 *
 * Two capture modes (auto-detected):
 *
 * 1. CAPTION MODE  — reads Google Meet's live captions directly from the DOM.
 *    Works for ALL participants. Speaker names come from Meet's own attribution.
 *    Zero STT cost, low latency. Activates automatically when CC is enabled.
 *
 * 2. AUDIO MODE  — captures the tab's audio output (all remote voices) mixed
 *    with the local microphone, then transcribes via Smallest.ai. Falls back
 *    to mic-only if tab capture is unavailable.
 *
 * Saturn automatically switches to caption mode if captions become enabled
 * while audio mode is running.
 */

const SATURN_URL = "http://localhost:3000";
const CHUNK_MS = 5000;

let isCapturing = false;
let captureMode = null; // 'caption' | 'audio'
let stopSignal = false;
let audioStream = null;
let audioCtx = null;
let captionObserver = null;
let captionPollTimer = null;
let enabled = true;

// Caption debounce state
const pendingBySpeaker = new Map(); // speaker -> { text, timer }

// ─── Widget ──────────────────────────────────────────────────────────────────

function injectWidget() {
  if (document.getElementById("saturn-widget")) return;

  const el = document.createElement("div");
  el.id = "saturn-widget";
  el.style.cssText = `
    position: fixed; top: 16px; right: 16px; z-index: 99999;
    background: #09090b; border: 1px solid rgba(255,255,255,0.1);
    border-radius: 12px; padding: 8px 14px 8px 10px;
    display: flex; align-items: center; gap: 8px;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    font-size: 12px; color: rgba(255,255,255,0.8);
    box-shadow: 0 4px 24px rgba(0,0,0,0.6); user-select: none;
  `;
  el.innerHTML = `
    <span style="font-size:15px;line-height:1;opacity:0.9">⬡</span>
    <span id="saturn-label" style="font-weight:500;min-width:80px">Saturn</span>
    <span id="saturn-mode" style="font-size:10px;opacity:0.45;font-weight:500"></span>
    <div id="saturn-dot" style="
      width:6px;height:6px;border-radius:50%;background:#6b7280;
      flex-shrink:0;transition:background 0.3s;
    "></div>
    <button id="saturn-btn" style="
      background:rgba(124,58,237,0.15); border:1px solid rgba(124,58,237,0.35);
      border-radius:6px; color:#a78bfa; font-size:11px; font-weight:600;
      padding:3px 9px; cursor:pointer; font-family:inherit; transition:background 0.15s;
    ">Start</button>
  `;
  document.body.appendChild(el);
  document.getElementById("saturn-btn").addEventListener("click", () => {
    if (isCapturing) stopCapture();
    else startCapture();
  });
}

function setStatus(state) {
  const dot = document.getElementById("saturn-dot");
  const label = document.getElementById("saturn-label");
  const btn = document.getElementById("saturn-btn");
  if (!dot || !label || !btn) return;

  const states = {
    capturing:    { dot: "#34d399", glow: "rgba(52,211,153,0.5)",   text: "Listening", btn: "Stop" },
    transcribing: { dot: "#818cf8", glow: "rgba(129,140,248,0.5)",  text: "Transcribing…", btn: "Stop" },
    error:        { dot: "#f87171", glow: "none",                   text: "Error",     btn: "Retry" },
    idle:         { dot: "#6b7280", glow: "none",                   text: "Saturn",    btn: "Start" },
  };
  const s = states[state] ?? states.idle;
  dot.style.background = s.dot;
  dot.style.boxShadow = s.glow === "none" ? "none" : `0 0 6px ${s.glow}`;
  label.textContent = s.text;
  btn.textContent = s.btn;
}

function setModeLabel(mode) {
  const el = document.getElementById("saturn-mode");
  if (el) el.textContent = mode === "caption" ? "CC" : mode === "audio" ? "🎙" : "";
}

// ─── Caption Mode ─────────────────────────────────────────────────────────────
//
// Google Meet renders captions in DOM elements we watch with MutationObserver.
// We try several selector strategies since Meet's class names change over time.

// Item containers — each holds one speaker's current caption
const CAPTION_ITEM_SELECTORS = [
  '[jsname="tgaKEf"]',
  '[data-message-id]',
  ".CNusmb",
  ".iOzk7",
];

// Speaker name elements within a caption item
const CAPTION_SPEAKER_SELECTORS = [
  '[jsname="YSg2ue"]',
  ".zs7s8d",
  ".YTbUzc",
  "[data-self-name]",
];

function detectCaptionElements() {
  return CAPTION_ITEM_SELECTORS.some((s) => document.querySelector(s));
}

function startCaptionMode() {
  if (captionObserver) return; // already running
  captureMode = "caption";
  setStatus("capturing");
  setModeLabel("caption");

  captionObserver = new MutationObserver(onCaptionMutation);
  captionObserver.observe(document.body, {
    childList: true,
    subtree: true,
    characterData: true,
  });
}

function stopCaptionMode() {
  captionObserver?.disconnect();
  captionObserver = null;
  pendingBySpeaker.forEach(({ timer }) => clearTimeout(timer));
  pendingBySpeaker.clear();
}

function onCaptionMutation() {
  for (const sel of CAPTION_ITEM_SELECTORS) {
    document.querySelectorAll(sel).forEach(processCaptionItem);
  }
}

function processCaptionItem(item) {
  // Extract speaker name
  let speaker = "Participant";
  for (const ssel of CAPTION_SPEAKER_SELECTORS) {
    const el = item.querySelector(ssel);
    if (el?.textContent?.trim()) {
      speaker = el.textContent.trim();
      break;
    }
  }

  // Extract caption text (exclude the speaker name element)
  const clone = item.cloneNode(true);
  for (const ssel of CAPTION_SPEAKER_SELECTORS) {
    clone.querySelector(ssel)?.remove();
  }
  const text = clone.textContent.replace(/\s+/g, " ").trim();
  if (text.length < 4) return;

  // Debounce per speaker: push after 1.5s of no new updates (speech pause)
  const prev = pendingBySpeaker.get(speaker);
  if (prev?.text === text) return; // no change, skip
  if (prev) clearTimeout(prev.timer);

  const timer = setTimeout(() => {
    const entry = pendingBySpeaker.get(speaker);
    if (entry) {
      pushText(entry.text, entry.speaker);
      pendingBySpeaker.delete(speaker);
    }
  }, 1500);

  pendingBySpeaker.set(speaker, { text, speaker, timer });
}

// ─── Audio Mode (Tab + Mic) ───────────────────────────────────────────────────

async function startAudioMode() {
  captureMode = "audio";
  stopSignal = false;

  try {
    const micStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });

    let captureStream = micStream;

    // Ask background for a tab stream ID (captures all remote audio)
    try {
      const resp = await chrome.runtime.sendMessage({ type: "GET_STREAM_ID" });
      if (resp?.streamId) {
        const tabStream = await navigator.mediaDevices.getUserMedia({
          audio: {
            mandatory: {
              chromeMediaSource: "tab",
              chromeMediaSourceId: resp.streamId,
            },
          },
          video: false,
        });

        // Mix tab audio (remote voices) + mic (local user)
        audioCtx = new AudioContext();
        const dest = audioCtx.createMediaStreamDestination();
        audioCtx.createMediaStreamSource(tabStream).connect(dest);
        audioCtx.createMediaStreamSource(micStream).connect(dest);
        captureStream = dest.stream;
      }
    } catch (e) {
      // Tab capture unavailable — mic-only fallback is fine
      console.warn("[Saturn] Tab capture unavailable, mic-only mode:", e.message);
    }

    audioStream = captureStream;
    setStatus("capturing");
    setModeLabel("audio");
    captureLoop(captureStream);
  } catch (err) {
    console.error("[Saturn] Audio capture error:", err);
    isCapturing = false; // allow Start button to work again
    setStatus("error");
  }
}

let activeRecorder = null; // ref to the currently-recording MediaRecorder

function stopAudioMode() {
  stopSignal = true;
  // Stop the active recorder immediately so recordChunk resolves right away
  if (activeRecorder?.state === "recording") activeRecorder.stop();
  activeRecorder = null;
  audioStream?.getTracks().forEach((t) => t.stop());
  audioCtx?.close().catch(() => {});
  audioStream = null;
  audioCtx = null;
}

// ─── Shared start/stop ────────────────────────────────────────────────────────

async function startCapture() {
  if (isCapturing) return;
  isCapturing = true;

  if (detectCaptionElements()) {
    // Caption mode: Meet already has CC enabled
    startCaptionMode();
  } else {
    // Audio mode: capture tab + mic
    await startAudioMode();
    // Poll in case the user enables CC later — switch over seamlessly
    captionPollTimer = setInterval(() => {
      if (!isCapturing || captureMode === "caption") {
        clearInterval(captionPollTimer);
        return;
      }
      if (detectCaptionElements()) {
        stopAudioMode();
        startCaptionMode();
        clearInterval(captionPollTimer);
      }
    }, 2000);
  }
}

function stopCapture() {
  isCapturing = false;
  captureMode = null;
  stopCaptionMode();
  stopAudioMode();
  clearInterval(captionPollTimer);
  setStatus("idle");
  setModeLabel(null);
}

// ─── Audio capture helpers ────────────────────────────────────────────────────

async function captureLoop(stream) {
  while (!stopSignal) {
    try {
      const blob = await recordChunk(stream, CHUNK_MS);
      if (stopSignal || blob.size < 1500) continue; // stopped or near-silence
      setStatus("transcribing");
      await transcribeAndPush(blob);
      if (!stopSignal) setStatus("capturing");
    } catch {
      // stream stopped or recorder error — loop condition will exit naturally
    }
  }
}

function recordChunk(stream, durationMs) {
  return new Promise((resolve, reject) => {
    const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
      ? "audio/webm;codecs=opus"
      : "audio/webm";
    const recorder = new MediaRecorder(stream, { mimeType });
    const chunks = [];
    recorder.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data); };
    recorder.onstop = () => resolve(new Blob(chunks, { type: recorder.mimeType }));
    recorder.onerror = reject;
    activeRecorder = recorder;
    recorder.start();
    setTimeout(() => { if (recorder.state !== "inactive") recorder.stop(); }, durationMs);
  });
}

async function transcribeAndPush(blob) {
  const formData = new FormData();
  formData.append("audio", blob, "chunk.webm");

  const res = await fetch(`${SATURN_URL}/api/transcribe`, { method: "POST", body: formData });
  if (!res.ok) {
    console.warn("[Saturn] /api/transcribe returned", res.status);
    return;
  }

  const { fullText, segments } = await res.json();
  if (!fullText?.trim()) return;

  const speaker = segments?.[0]?.speaker ?? "You";
  await pushText(fullText, speaker);
}

// ─── Push to Saturn ───────────────────────────────────────────────────────────

async function pushText(text, speaker = "You") {
  try {
    await fetch(`${SATURN_URL}/api/transcript/push`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        text,
        segments: [{ speaker, startTime: 0, endTime: 0, confidence: 0.95 }],
      }),
    });
  } catch (e) {
    console.warn("[Saturn] Push failed:", e.message);
  }
}

// ─── Extension messaging ──────────────────────────────────────────────────────

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg.type === "GET_STATUS") {
    sendResponse({ connected: isCapturing, mode: captureMode });
    return true;
  }
  if (msg.type === "SET_ENABLED") {
    enabled = msg.value;
    if (!enabled && isCapturing) stopCapture();
    sendResponse({ ok: true });
    return true;
  }
});

// ─── Init ─────────────────────────────────────────────────────────────────────

chrome.storage.local.get("enabled", (res) => {
  enabled = res.enabled !== false;

  const tryInject = () => {
    if (document.body) {
      setTimeout(injectWidget, 2000);
    } else {
      const obs = new MutationObserver(() => {
        if (document.body) { injectWidget(); obs.disconnect(); }
      });
      obs.observe(document.documentElement, { childList: true, subtree: true });
    }
  };
  tryInject();
});
