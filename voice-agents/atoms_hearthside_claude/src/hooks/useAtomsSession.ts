import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, Platform } from 'react-native';
import { PERMISSIONS, request, RESULTS } from 'react-native-permissions';
import { AtomsClient } from '@/agent/AtomsClient';
import { startMicCapture, CaptureHandle } from '@/agent/audioCapture';
import { ScheduledPlayback } from '@/agent/audioPlayback';
import { ServerEvent, SessionError, SessionStatus } from '@/agent/types';

const SAMPLE_RATE = 24_000;
const CHUNK_FRAMES = 480; // 20ms at 24kHz

export interface UseAtomsSessionResult {
  status: SessionStatus;
  error: SessionError | null;
  micLevel: number;
  agentLevel: number;
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

  const clientRef = useRef<AtomsClient | null>(null);
  const captureRef = useRef<CaptureHandle | null>(null);
  const playbackRef = useRef<ScheduledPlayback | null>(null);

  const teardown = useCallback(() => {
    captureRef.current?.stop();
    captureRef.current = null;
    playbackRef.current?.stop();
    playbackRef.current = null;
    clientRef.current?.close();
    clientRef.current = null;
    setMicLevel(0);
    setAgentLevel(0);
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
        setStatus('listening');
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
            client.sendMicChunk(b64);
            setMicLevel(rms);
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

  // Tear down on hard background transitions. iOS kills the socket on
  // suspension anyway; Android revokes mic access without a foreground
  // service. The UX tradeoff is intentional: ending the story cleanly
  // beats the user coming back to a broken state.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (next) => {
      if (next !== 'active' && clientRef.current) stop();
    });
    return () => sub.remove();
  }, [stop]);

  // Unmount safety net. Running audio from an unmounted component produces
  // zombie state the user can't recover from without a hard reload.
  useEffect(() => () => teardown(), [teardown]);

  return { status, error, micLevel, agentLevel, start, stop };
}
