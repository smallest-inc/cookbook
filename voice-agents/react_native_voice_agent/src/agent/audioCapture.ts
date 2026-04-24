import { AudioManager, AudioRecorder } from 'react-native-audio-api';
import { Buffer } from 'buffer';
import { rmsFloat32 } from './rms';

export interface CaptureOptions {
  sampleRate: number;
  chunkFrames: number;
  onChunk: (base64Int16LE: string, rms: number) => void;
  onError: (message: string) => void;
}

export interface CaptureHandle {
  stop: () => void;
}

// Convert Float32 [-1,1] -> Int16 little-endian bytes. Allocates per call
// because chunk frames are fixed and the GC impact at 24kHz/20ms is ~50/s.
function float32ToInt16LE(float32: Float32Array): Uint8Array {
  const out = new Uint8Array(float32.length * 2);
  const view = new DataView(out.buffer);
  for (let i = 0; i < float32.length; i++) {
    const clipped = Math.max(-1, Math.min(1, float32[i]));
    view.setInt16(i * 2, clipped < 0 ? clipped * 0x8000 : clipped * 0x7fff, true);
  }
  return out;
}

// Configures the platform audio session for a voice call and starts an
// AudioRecorder that delivers Float32 PCM frames at the requested rate.
// Caller receives base64-encoded Int16 LE plus an RMS reading per frame
// so the UI can render a live mic waveform without reading the buffer
// twice.
export function startMicCapture(opts: CaptureOptions): CaptureHandle {
  // iOS audio mode trade-off for a storytelling app with long-running
  // playback:
  //   - voiceChat / videoChat: AEC + NS but route via the phone-call
  //     audio path (receiver, ~50% volume, defaultToSpeaker ignored).
  //   - voicePrompt: speaker-routed AND AEC, but the audio unit is
  //     tuned for short Siri-style prompts. Continuous 24 kHz streaming
  //     for minutes underruns and distorts (muffled, buzzy, choppy).
  //   - default: no voice processing, but stable continuous playback at
  //     full media volume on the loud speaker when defaultToSpeaker is
  //     set. Best overall. The absence of hardware AEC means the
  //     speaker can echo back into the mic; the mute button in the UI
  //     and headphone use both kill that loop cleanly.
  // allowBluetoothA2DP lets output prefer stereo BT (AirPods) over mono
  // HFP when both are available.
  AudioManager.setAudioSessionOptions({
    iosCategory: 'playAndRecord',
    iosMode:     'default',
    iosOptions:  ['allowBluetoothHFP', 'allowBluetoothA2DP', 'defaultToSpeaker'],
  });
  AudioManager.setAudioSessionActivity(true).catch(() => {
    // Harmless: setAudioSessionActivity rejects when already active.
  });

  const recorder = new AudioRecorder();
  recorder.onAudioReady(
    { sampleRate: opts.sampleRate, bufferLength: opts.chunkFrames, channelCount: 1 },
    ({ buffer }) => {
      try {
        const float32 = buffer.getChannelData(0);
        const rms = rmsFloat32(float32);
        const int16 = float32ToInt16LE(float32);
        opts.onChunk(Buffer.from(int16).toString('base64'), rms);
      } catch (e) {
        opts.onError(e instanceof Error ? e.message : 'capture chunk failed');
      }
    },
  );
  recorder.onError((err) => opts.onError(err.message));
  recorder.start();

  return {
    stop: () => {
      try { recorder.stop(); } catch { /* already stopped */ }
    },
  };
}
