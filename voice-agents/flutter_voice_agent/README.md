# Flutter Voice Agent

A minimal Flutter sample that opens a real-time voice session with a Smallest Atoms agent over the plain WebSocket endpoint. Dart + Material 3, `web_socket_channel`, `mic_stream`, `flutter_pcm_sound`. iOS + Android.

Same UX pattern as the [React Native](../react_native_voice_agent/), [iOS Swift](../ios_swift_voice_agent/), and [Android Kotlin](../android_kotlin_voice_agent/) cookbooks — status chip, two labelled waveforms, mute toggle, transport counter, call button.

## What it shows

- Realtime voice session over `wss://api.smallest.ai/atoms/v1/agent/connect` using Dart's `web_socket_channel` (no SDK, no WebRTC).
- Microphone capture via `mic_stream` at 24 kHz Int16 mono, base64-encoded and streamed as `input_audio_buffer.append`.
- Gapless playback via `flutter_pcm_sound` — a purpose-built realtime PCM16 writer with no format conversion overhead.
- Full protocol: `input_audio_buffer.append`, `output_audio.delta`, `agent_start_talking`, `agent_stop_talking`, `interruption`, `session.closed`, `error`.
- Exponential-backoff reconnect on transient drops; hard-stop on 4401/4403 auth closes.
- Mute toggle gates the mic-upload path client-side.
- Transport diagnostics: live `sending · N` counter so you can verify chunks are leaving the phone regardless of mic level.
- `ValueListenable`-backed state — no state-management library needed, easy to read.

## Prerequisites

- Flutter SDK ≥ 3.22 (Dart ≥ 3.4). Earlier versions work if you loosen the pubspec constraints.
- Xcode 15+ for iOS, Android Studio + SDK 35 for Android.
- A Smallest AI account and an API key from [app.smallest.ai/dashboard/api-keys](https://app.smallest.ai/dashboard/api-keys).
- An Atoms **agent ID** from the dashboard (or use the Python script from the [RN cookbook](../react_native_voice_agent/scripts/setup_agent.py)).

## Setup

The cookbook ships the `lib/` source and `pubspec.yaml` plus minor platform overrides for mic permissions. The `ios/` and `android/` Flutter scaffolding regenerates on first build:

```bash
cd voice-agents/flutter_voice_agent

# If ios/ and android/ aren't present (fresh clone), regenerate them:
flutter create . --platforms=ios,android --project-name atoms_voice_agent --org ai.smallest

# Resolve packages
flutter pub get
```

Run with credentials injected at build time (Dart `String.fromEnvironment`):

```bash
flutter run \
  --dart-define=ATOMS_API_KEY=sk_your_key \
  --dart-define=ATOMS_AGENT_ID=your_agent_id
```

Or export them as environment variables and the app falls back to those at runtime (useful in CI).

## How it works

| Layer | File | Responsibility |
|---|---|---|
| Transport | `lib/atoms_client.dart` | `WebSocketChannel.connect` with typed `AtomsServerEvent` decoding, exponential-backoff reconnect, 4401/4403 auth hard-stop. |
| Mic capture | `lib/audio/mic_capture.dart` | `mic_stream` with `AudioSource.VOICE_COMMUNICATION`. Delivers `Uint8List` PCM16 chunks. Base64 + RMS computed inline. Gated by mute flag. |
| Playback | `lib/audio/pcm_playback.dart` | `flutter_pcm_sound` setup + feed. `flush()` implemented via release + restart for instant barge-in response on server `interruption`. |
| State machine | `lib/session_controller.dart` | Owns client + mic + playback lifecycle. Exposes `ValueNotifier<SessionState>` — no Provider / Bloc needed. |
| UI | `lib/ui/voice_agent_screen.dart` | Single-screen Material 3. Status chip, two labelled waveforms (animated VU), mute pill, send counter, call button, error banner. |

## Audio session notes

- **Android**: `mic_stream` uses `MediaRecorder.AudioSource.VOICE_COMMUNICATION` when you pass `AudioSource.VOICE_COMMUNICATION`. Combined with the platform-default speaker output, this engages AEC out of the box.
- **iOS**: `mic_stream` uses `AVCaptureSession` directly and does **not** configure `AVAudioSession`, so you get no hardware AEC. For clean hands-free on iOS device, add [`audio_session`](https://pub.dev/packages/audio_session) and configure `.playAndRecord` / `.voiceChat` before starting the mic — or rely on the mute button and headphones. Simulator is noisy regardless due to the Mac CoreAudio bridge; validate audio quality on a real device.

## Testing

### Analyzer

```bash
flutter analyze
# → No issues found.
```

### Simulator / emulator

```bash
flutter run --dart-define=ATOMS_API_KEY=sk_... --dart-define=ATOMS_AGENT_ID=...
```

Expect: tap Begin session → `sending · N` counter climbs → agent greets → you speak → agent responds.

On Android emulator, enable *Extended Controls → Microphone → Virtual microphone uses host audio input* to route your Mac mic into the emulator. On iOS simulator, expect audio distortion — use a device.

### Verifying transport

The `sending · N` counter under the *you* waveform increments per outbound chunk. If it climbs, mic chunks are reaching the server regardless of what the mic actually captured. Simple proof-of-wire diagnostic that survives emulator mic limitations.

## Known limitations

- **No in-app settings sheet** for voice / speed / language — the RN and iOS cookbooks have one; this one stays minimal. To change the agent config, use the dashboard or the Python `setup_agent.py` helper from the RN cookbook.
- **iOS AEC** isn't wired by default — see the audio session note above.
- **Backgrounding** tears down the session. For always-on calls, add a foreground service on the Android side and VoIP / CallKit entitlements on iOS.
- **`mic_stream` + `flutter_pcm_sound`** target mobile only. Desktop (macOS, Linux, Windows) needs platform-channel bridges or `flutter_webrtc`.

## Reference

- [Realtime Agent WebSocket API](https://docs.smallest.ai/atoms/api-reference/api-reference/realtime-agent/realtime-agent) — full event protocol.
- [Flutter integration guide](https://docs.smallest.ai/atoms/developer-guide/integrate/mobile/flutter) — the docs pattern this cookbook implements end-to-end.
- [`mic_stream`](https://pub.dev/packages/mic_stream), [`flutter_pcm_sound`](https://pub.dev/packages/flutter_pcm_sound), [`web_socket_channel`](https://pub.dev/packages/web_socket_channel) — the three libraries doing the heavy lifting.
