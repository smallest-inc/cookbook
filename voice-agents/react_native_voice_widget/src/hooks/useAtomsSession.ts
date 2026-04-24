import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, Platform } from 'react-native';
import { PERMISSIONS, request, RESULTS } from 'react-native-permissions';
import { AtomsClient } from '@/agent/AtomsClient';
import { startMicCapture, CaptureHandle } from '@/agent/audioCapture';
import { ScheduledPlayback } from '@/agent/audioPlayback';
import { ServerEvent, SessionError, SessionStatus } from '@/agent/types';

const SAMPLE_RATE = 24_000;
const CHUNK_FRAMES = 480; // 20ms at 24kHz

export interface TranscriptEntry {
  id: string;
  role: 'user' | 'assistant';
  text: string;
}

export interface UseAtomsSessionResult {
  status: SessionStatus;
  error: SessionError | null;
  micLevel: number;
  agentLevel: number;
  micChunksSent: number;    // increments per outbound chunk — proves transport
  muted: boolean;
  transcript: TranscriptEntry[];
  toggleMute: () => void;
  start: () => void;
  stop: () => void;
}

export interface UseAtomsSessionConfig {
  apiKey: string | undefined;
  agentId: string | undefined;
}

async function ensureMicPermission(): Promise<boolean> {
  const perm = Platform.OS === 'ios'
    ? PERMISSIONS.IOS.MICROPHONE
    : PERMISSIONS.ANDROID.RECORD_AUDIO;
  const result = await request(perm);
  return result === RESULTS.GRANTED;
}

export function useAtomsSession({ apiKey, agentId }: UseAtomsSessionConfig): UseAtomsSessionResult {
  const [status, setStatus] = useState<SessionStatus>('idle');
  const [error, setError] = useState<SessionError | null>(null);
  const [micLevel, setMicLevel] = useState(0);
  const [agentLevel, setAgentLevel] = useState(0);
  const [micChunksSent, setMicChunksSent] = useState(0);
  const [muted, setMuted] = useState(false);
  const [transcript, setTranscript] = useState<TranscriptEntry[]>([]);

  const clientRef = useRef<AtomsClient | null>(null);
  const captureRef = useRef<CaptureHandle | null>(null);
  const playbackRef = useRef<ScheduledPlayback | null>(null);
  // Ref mirror because the mic onChunk closure is captured once per session;
  // a stale `muted` value in state wouldn't reach the hot path.
  const mutedRef = useRef(false);

  const toggleMute = useCallback(() => {
    setMuted((prev) => {
      const next = !prev;
      mutedRef.current = next;
      return next;
    });
  }, []);

  const teardown = useCallback(() => {
    captureRef.current?.stop();
    captureRef.current = null;
    playbackRef.current?.stop();
    playbackRef.current = null;
    clientRef.current?.close();
    clientRef.current = null;
    setMicLevel(0);
    setAgentLevel(0);
    setMicChunksSent(0);
    setMuted(false);
    mutedRef.current = false;
    setTranscript([]);
  }, []);

  const stop = useCallback(() => {
    teardown();
    setStatus('idle');
  }, [teardown]);

  const fail = useCallback((err: SessionError) => {
    teardown();
    setError(err);
    setStatus('error');
  }, [teardown]);

  const handleEvent = useCallback((ev: ServerEvent) => {
    switch (ev.type) {
      case 'session.created':
        setStatus('joined');
        break;
      case 'output_audio.delta':
        if ('audio' in ev && typeof ev.audio === 'string') {
          playbackRef.current?.enqueueBase64(ev.audio);
        }
        break;
      case 'agent_start_talking':
        setStatus('narrating');
        break;
      case 'agent_stop_talking':
        setStatus('listening');
        break;
      case 'interruption':
        playbackRef.current?.flush();
        break;
      case 'transcript':
        if ('role' in ev && 'text' in ev && typeof ev.text === 'string' && ev.text.trim().length) {
          const text = ev.text;
          const role: 'user' | 'assistant' = ev.role === 'agent' ? 'assistant' : 'user';
          setTranscript((prev) => [
            ...prev,
            { id: `${Date.now()}-${prev.length}`, role, text },
          ]);
        }
        break;
      case 'session.closed':
        stop();
        break;
      case 'error':
        if ('code' in ev && 'message' in ev) {
          fail({
            kind: 'server',
            message: `${ev.code}: ${ev.message}`,
            retryable: false,
          });
        }
        break;
    }
  }, [stop, fail]);

  const start = useCallback(async () => {
    if (!apiKey || !agentId) {
      fail({
        kind: 'missing-config',
        message: 'SMALLEST_API_KEY and AGENT_ID must be set in .env',
        retryable: false,
      });
      return;
    }

    setError(null);
    setStatus('connecting');

    let granted: boolean;
    try {
      granted = await ensureMicPermission();
    } catch (e) {
      fail({
        kind: 'permission',
        message: e instanceof Error ? e.message : 'permission request failed',
        retryable: true,
      });
      return;
    }
    if (!granted) {
      fail({
        kind: 'permission',
        message: 'microphone permission was denied',
        retryable: false,
      });
      return;
    }

    const playback = new ScheduledPlayback({
      sampleRate: SAMPLE_RATE,
      onLevel: setAgentLevel,
    });
    playback.start();
    playbackRef.current = playback;

    const client = new AtomsClient({
      apiKey,
      agentId,
      sampleRate: SAMPLE_RATE,
      onOpen: () => {
        captureRef.current = startMicCapture({
          sampleRate: SAMPLE_RATE,
          chunkFrames: CHUNK_FRAMES,
          onChunk: (b64, rms) => {
            if (mutedRef.current) {
              setMicLevel(0);
              return;
            }
            client.sendMicChunk(b64);
            setMicLevel(rms);
            setMicChunksSent((n) => n + 1);
          },
          onError: (msg) => {
            fail({ kind: 'unknown', message: msg, retryable: true });
          },
        });
      },
      onEvent: handleEvent,
      onClose: () => {
        captureRef.current?.stop();
        captureRef.current = null;
      },
      onFatalError: fail,
    });
    clientRef.current = client;
    client.start();
  }, [apiKey, agentId, handleEvent, fail]);

  // Tear down only on *real* backgrounding, not on the transient
  // `inactive` state. iOS fires `inactive` when the user pulls the
  // notification shade, opens Control Center, answers a brief system
  // dialog — none of which should kill a story in progress. `background`
  // means the app actually left the foreground and iOS will suspend us.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (next) => {
      if (next === 'background' && clientRef.current) stop();
    });
    return () => sub.remove();
  }, [stop]);

  // Unmount safety net. Running audio from an unmounted component produces
  // zombie state the user can't recover from without a hard reload.
  useEffect(() => () => teardown(), [teardown]);

  return {
    status, error,
    micLevel, agentLevel, micChunksSent,
    muted, transcript,
    toggleMute,
    start, stop,
  };
}
