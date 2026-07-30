"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  HydraClient,
  HydraStatus,
  DEFAULT_HYDRA_WS_URL,
} from "@/app/lib/hydra-client";
import {
  Playback,
  bytesToB64,
  b64ToArrayBuffer,
  startMic,
  type MicHandle,
} from "@/app/lib/audio";
import { executeTool, resetAllTools } from "@/app/tools";
import type {
  ClientEvent,
  LoggedEvent,
  OrbState,
  ServerEvent,
  SessionConfig,
  ToolCall,
  TranscriptBubble,
} from "@/app/types";

const MAX_LOG_ROWS = 800;

export interface SessionState {
  status: HydraStatus;
  orb: OrbState;
  level: number; // 0..1 audio amplitude (input when listening, output when speaking)
  micMuted: boolean;
  sessionId: string | null;
  transcript: TranscriptBubble[];
  events: LoggedEvent[];
  lastError: string | null;
  outputSampleRate: number;
}

export interface SessionConfigInput {
  url: string;
  apiKey: string;
  voice: string;
  instructions: string;
  tools: SessionConfig["tools"];
  generateInitialResponse: boolean;
}

const initialState: SessionState = {
  status: "idle",
  orb: "idle",
  level: 0,
  micMuted: false,
  sessionId: null,
  transcript: [],
  events: [],
  lastError: null,
  outputSampleRate: 24000,
};

export function useHydraSession() {
  const [state, setState] = useState<SessionState>(initialState);

  const clientRef = useRef<HydraClient | null>(null);
  const micRef = useRef<MicHandle | null>(null);
  const playbackRef = useRef<Playback | null>(null);
  const sessionStartRef = useRef<number>(0);
  const configRef = useRef<SessionConfigInput | null>(null);
  const fnCallsRef = useRef<Record<string, { name: string; args: string }>>({});
  const responseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inputLevelRef = useRef(0);
  const animFrameRef = useRef<number | null>(null);
  // Server says "response done" the moment generation finishes — but audio
  // is delivered ~10x faster than realtime, so the user is still hearing it
  // for several more seconds. We hold the "speaking" orb until playback
  // actually drains (no buffers queued or playing).
  const pendingResponseDoneRef = useRef(false);

  // ─── level + orb-drain animation loop ──────────────────────────────────
  useEffect(() => {
    const tick = () => {
      const playback = playbackRef.current;
      const playLevel = playback?.level() ?? 0;
      const speaking = playback?.isPlaying() ?? false;
      const level = speaking ? playLevel : inputLevelRef.current;
      setState((s) => {
        let next = s;
        if (Math.abs(s.level - level) >= 0.005) {
          next = next === s ? { ...s, level } : { ...next, level };
        }
        // Deferred orb drain: response.done fired earlier, but we held
        // "speaking" until playback finished. Flip once the queue is empty.
        if (
          pendingResponseDoneRef.current &&
          !speaking &&
          (s.orb === "speaking" || s.orb === "thinking")
        ) {
          pendingResponseDoneRef.current = false;
          next = next === s ? { ...s, orb: "connected" } : { ...next, orb: "connected" };
        }
        return next;
      });
      animFrameRef.current = requestAnimationFrame(tick);
    };
    animFrameRef.current = requestAnimationFrame(tick);
    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, []);

  // ─── helpers ───────────────────────────────────────────────────────────
  const logEvent = useCallback((dir: "in" | "out", evt: unknown) => {
    const ts = sessionStartRef.current
      ? performance.now() - sessionStartRef.current
      : 0;
    const type =
      (evt as { type?: string }).type || "unknown";
    setState((s) => {
      const rows = s.events.length >= MAX_LOG_ROWS ? s.events.slice(-MAX_LOG_ROWS + 1) : s.events;
      return {
        ...s,
        events: [
          ...rows,
          {
            id: `${ts}-${Math.random().toString(36).slice(2, 8)}`,
            dir,
            ts,
            type,
            raw: evt,
          },
        ],
      };
    });
  }, []);

  const sendEvent = useCallback(
    (evt: ClientEvent) => {
      clientRef.current?.send(evt);
    },
    [],
  );

  const setOrb = useCallback((orb: OrbState) => {
    setState((s) => (s.orb === orb ? s : { ...s, orb }));
  }, []);

  // ─── transcript / item lifecycle ───────────────────────────────────────
  const upsertBubble = useCallback(
    (id: string, patch: Partial<TranscriptBubble>) => {
      setState((s) => {
        const idx = s.transcript.findIndex((b) => b.id === id);
        if (idx === -1) {
          const bubble: TranscriptBubble = {
            id,
            role: patch.role || "assistant",
            text: patch.text || "",
            status: patch.status || "in_progress",
            toolCalls: patch.toolCalls || [],
          };
          return { ...s, transcript: [...s.transcript, bubble] };
        }
        const next = [...s.transcript];
        next[idx] = { ...next[idx], ...patch };
        return { ...s, transcript: next };
      });
    },
    [],
  );

  const removeBubble = useCallback((id: string) => {
    setState((s) => ({
      ...s,
      transcript: s.transcript.filter((b) => b.id !== id),
    }));
  }, []);

  // ─── server event handler ─────────────────────────────────────────────
  const handleServerEvent = useCallback(
    (evt: ServerEvent) => {
      logEvent("in", evt);
      const cfg = configRef.current;

      switch (evt.type) {
        case "session.created": {
          if (!cfg) return;
          resetAllTools();
          setState((s) => ({
            ...s,
            sessionId: (evt as { session_id: string }).session_id,
            transcript: [],
          }));
          sendEvent({
            type: "session.configure",
            session: {
              instructions: cfg.instructions,
              voice: cfg.voice,
              tools: (cfg.tools || []).map((t) => ({ ...t, type: "function" })),
              generate_initial_response: cfg.generateInitialResponse,
            },
          });
          return;
        }
        case "session.configured": {
          const e = evt as { session: SessionConfig };
          const rate = e.session?.output_audio_sample_rate;
          if (rate) {
            setState((s) => ({ ...s, outputSampleRate: rate }));
            playbackRef.current?.setSampleRate(rate);
          }
          setOrb("connected");
          startMicLoop();
          return;
        }
        case "session.updated":
          return;

        case "input_audio_buffer.speech_started":
          // User barged in (or first turn). Cancel any pending drain so we
          // don't accidentally flip to "connected" mid-listening.
          pendingResponseDoneRef.current = false;
          setOrb("listening");
          playbackRef.current?.stop();
          return;
        case "input_audio_buffer.speech_stopped":
          setOrb("thinking");
          return;

        case "conversation.item.added": {
          const e = evt as { item: { id: string; role?: string; type?: string } };
          const it = e.item;
          if (!it?.id) return;
          if (it.role === "user" || it.role === "assistant") {
            upsertBubble(it.id, {
              role: it.role,
              status: "in_progress",
              text: "",
            });
          }
          return;
        }
        case "conversation.item.done": {
          const e = evt as {
            item: {
              id: string;
              role?: string;
              status?: "completed" | "incomplete" | "in_progress";
              content?: { text?: string }[];
            };
          };
          const it = e.item;
          if (!it?.id) return;
          const txt = it.content?.[0]?.text;
          if (
            it.role === "user" &&
            it.status === "incomplete" &&
            !txt
          ) {
            removeBubble(it.id);
            return;
          }
          upsertBubble(it.id, {
            status: (it.status as TranscriptBubble["status"]) || "completed",
            ...(txt ? { text: txt } : {}),
          });
          return;
        }

        case "response.created":
          // Don't flip to "speaking" yet — no audio has been scheduled.
          // Stay in "thinking" until the first output_audio.delta arrives.
          return;
        case "response.output_audio.delta": {
          const e = evt as { delta: string };
          if (e.delta) {
            playbackRef.current?.play(b64ToArrayBuffer(e.delta));
            // First chunk for this response — now we can safely show
            // "speaking" because audio is queued on the AudioContext.
            setOrb("speaking");
          }
          return;
        }
        case "response.output_audio.done":
          return;
        case "response.done": {
          const e = evt as {
            response: {
              status: string;
              status_details?: { reason?: string };
              output?: { id?: string; status?: string }[];
            };
          };
          const status = e.response.status;
          if (status !== "completed") {
            const out = e.response.output?.[0];
            if (out?.id) {
              upsertBubble(out.id, {
                status: (out.status as TranscriptBubble["status"]) || "incomplete",
              });
            }
          }
          // Hold the orb on "speaking" until playback actually drains.
          // Server-side generation is ~10x faster than realtime — flipping
          // here would show "connected" while ~5s of audio is still queued.
          // The animation tick checks playback.isPlaying() and flips when
          // the AudioContext has nothing left to play.
          //
          // Exception: if the response was cancelled/interrupted (which
          // already stopped playback) or no audio ever played (e.g. a
          // tool-only turn), isPlaying() will already be false and the
          // next tick will flip immediately — so this works for both
          // cases without special-casing.
          if (!playbackRef.current?.isPlaying()) {
            // No audio in flight — flip now to avoid a one-frame "speaking"
            // flash on tool-only / failed turns.
            setOrb("connected");
          } else {
            pendingResponseDoneRef.current = true;
          }
          return;
        }

        case "response.function_call_arguments.delta": {
          const e = evt as { call_id: string; name?: string; delta: string };
          const st =
            fnCallsRef.current[e.call_id] ||
            (fnCallsRef.current[e.call_id] = { name: e.name || "", args: "" });
          if (e.name) st.name = e.name;
          st.args += e.delta || "";
          return;
        }
        case "response.function_call_arguments.done": {
          const e = evt as {
            call_id: string;
            name?: string;
            arguments: string;
            item_id?: string;
          };
          const st =
            fnCallsRef.current[e.call_id] || {
              name: e.name || "",
              args: e.arguments || "",
            };
          st.name = e.name || st.name;
          st.args = e.arguments || st.args;
          let parsed: Record<string, unknown> = {};
          try {
            parsed = JSON.parse(st.args || "{}");
          } catch {
            parsed = { _raw: st.args };
          }
          const result = executeTool(st.name, parsed);
          const call: ToolCall = {
            call_id: e.call_id,
            name: st.name,
            args: parsed,
            result,
          };
          // Attach the tool call to the in-progress assistant bubble of THIS response.
          setState((s) => {
            const next = [...s.transcript];
            for (let i = next.length - 1; i >= 0; i--) {
              if (next[i].role === "assistant") {
                const tc = next[i].toolCalls ? [...next[i].toolCalls!] : [];
                tc.push(call);
                next[i] = { ...next[i], toolCalls: tc };
                break;
              }
            }
            return { ...s, transcript: next };
          });
          delete fnCallsRef.current[e.call_id];

          sendEvent({
            type: "conversation.item.create",
            item: {
              type: "function_call_output",
              call_id: e.call_id,
              output: result,
            },
          });
          // debounce so multiple parallel calls all land before we narrate
          if (responseTimerRef.current) clearTimeout(responseTimerRef.current);
          responseTimerRef.current = setTimeout(() => {
            responseTimerRef.current = null;
            sendEvent({ type: "response.create" });
          }, 220);
          return;
        }

        case "error": {
          const e = evt as { error: { message?: string; code?: string } };
          setState((s) => ({
            ...s,
            lastError: `[${e.error.code || "?"}] ${e.error.message || "unknown"}`,
            orb: "error",
          }));
          return;
        }

        default:
          // forward-compat: log + ignore
          return;
      }
    },
    [logEvent, removeBubble, sendEvent, setOrb, upsertBubble],
  );

  // ─── mic loop ────────────────────────────────────────────────────────
  const startMicLoop = useCallback(async () => {
    if (micRef.current) return;
    try {
      micRef.current = await startMic({
        initiallyMuted: false,
        onChunk: ({ pcm, peak }) => {
          inputLevelRef.current =
            inputLevelRef.current * 0.7 + Math.min(1, peak * 1.5) * 0.3;
          if (clientRef.current?.getStatus() === "open") {
            sendEvent({
              type: "input_audio_buffer.append",
              audio: bytesToB64(new Uint8Array(pcm)),
            });
          }
        },
      });
    } catch (e) {
      setState((s) => ({
        ...s,
        lastError: "Microphone permission denied — refresh and allow mic access.",
        orb: "error",
      }));
      console.error("mic error", e);
    }
  }, [sendEvent]);

  const stopMicLoop = useCallback(() => {
    micRef.current?.stop();
    micRef.current = null;
  }, []);

  // ─── connect / disconnect ────────────────────────────────────────────
  const connect = useCallback(
    (cfg: SessionConfigInput) => {
      if (clientRef.current) return;
      configRef.current = cfg;
      sessionStartRef.current = performance.now();
      playbackRef.current = new Playback(state.outputSampleRate);
      setState((s) => ({
        ...s,
        status: "connecting",
        orb: "connecting",
        events: [],
        transcript: [],
        lastError: null,
      }));
      clientRef.current = new HydraClient({
        url: cfg.url || DEFAULT_HYDRA_WS_URL,
        apiKey: cfg.apiKey,
        onEvent: handleServerEvent,
        onSent: (evt) => logEvent("out", evt),
        onStatus: (status, err) => {
          setState((s) => ({
            ...s,
            status,
            orb:
              status === "open"
                ? s.orb === "idle" || s.orb === "connecting"
                  ? "connected"
                  : s.orb
                : status === "closed"
                  ? "idle"
                  : status === "error"
                    ? "error"
                    : s.orb,
            lastError: err ? err.message : s.lastError,
          }));
        },
      });
      clientRef.current.connect();
    },
    [handleServerEvent, logEvent, state.outputSampleRate],
  );

  const disconnect = useCallback(() => {
    clientRef.current?.close();
    clientRef.current = null;
    stopMicLoop();
    playbackRef.current?.stop();
    playbackRef.current = null;
    fnCallsRef.current = {};
    pendingResponseDoneRef.current = false;
    setState((s) => ({
      ...s,
      status: "closed",
      orb: "idle",
      micMuted: false,
      sessionId: null,
    }));
  }, [stopMicLoop]);

  // ─── controls ────────────────────────────────────────────────────────
  const toggleMute = useCallback(() => {
    setState((s) => {
      const next = !s.micMuted;
      micRef.current?.setMuted(next);
      return { ...s, micMuted: next };
    });
  }, []);

  const cancelResponse = useCallback(() => {
    sendEvent({ type: "response.cancel" });
  }, [sendEvent]);

  const clearEvents = useCallback(() => {
    setState((s) => ({ ...s, events: [] }));
  }, []);

  useEffect(() => {
    return () => {
      clientRef.current?.close();
      stopMicLoop();
      playbackRef.current?.stop();
    };
  }, [stopMicLoop]);

  return {
    state,
    connect,
    disconnect,
    toggleMute,
    cancelResponse,
    clearEvents,
  };
}
