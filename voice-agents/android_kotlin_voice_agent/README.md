# Android Kotlin Voice Agent

A minimal native Android sample that opens a real-time voice session with a Smallest Atoms agent over the plain WebSocket endpoint. Jetpack Compose, OkHttp, `AudioRecord` + `AudioTrack`. Min SDK 24 (Android 7).

Same UX as the [React Native cookbook](../react_native_voice_agent/) and the [iOS Swift cookbook](../ios_swift_voice_agent/) — status chip, two labelled waveforms (narrator + you), mute toggle, sending counter, call button. Agent settings picker (voice / speed / language) is in the roadmap for this cookbook; for now, configure the agent in the dashboard.

## What it shows

- Real-time voice session over `wss://api.smallest.ai/atoms/v1/agent/connect` using OkHttp's `WebSocket` (no SDK, no WebRTC).
- Microphone capture with `AudioRecord(MediaRecorder.AudioSource.VOICE_COMMUNICATION, 24000, MONO, PCM_16BIT)` — engages the platform AEC + NS pipeline.
- Gapless playback via `AudioTrack` in `MODE_STREAM` with `USAGE_MEDIA` (see "Audio routing" below).
- Full protocol: `input_audio_buffer.append` streaming, `agent_start_talking` / `agent_stop_talking` / `interruption` / `session.closed` / `error` handling.
- Exponential-backoff reconnect on transient OkHttp failures; hard-stop on 4401 / 4403 auth closes.
- Mute toggle gates the mic-upload path client-side — the `onChunk` callback still fires (for UI level) but nothing leaves the phone.
- Transport diagnostics: a live `sending · N` counter under the *you* waveform.

## Prerequisites

- **Android Studio** Koala or newer, or equivalent command-line Android SDK (SDK 35 + build-tools + platform-tools).
- JDK 17 on PATH (Android Gradle Plugin 8.7 target).
- A Smallest AI account and an API key from [app.smallest.ai/dashboard/api-keys](https://app.smallest.ai/dashboard/api-keys).
- An Atoms **agent ID** — create one in the dashboard or use the Python setup script from the [React Native cookbook](../react_native_voice_agent/scripts/setup_agent.py).

## Setup

```bash
cd voice-agents/android_kotlin_voice_agent

# 1. Tell Gradle where the SDK lives + inject credentials at build time.
cp local.properties.example local.properties
# then edit local.properties: set sdk.dir, ATOMS_API_KEY, ATOMS_AGENT_ID.

# 2. Build the APK.
./gradlew assembleDebug
```

Install on an emulator or physical device:

```bash
adb install -r app/build/outputs/apk/debug/app-debug.apk
adb shell am start -n ai.smallest.atomsvoiceagent/.MainActivity
```

Or open the folder in Android Studio and hit ▶.

> `local.properties` is `.gitignore`d. Keep secrets out of VCS.

## How it works

| Layer | File | Responsibility |
|---|---|---|
| Transport | `AtomsClient.kt` | OkHttp `WebSocket`. Owns its own `CoroutineScope` so the mic job survives past `onOpen`. Dispatches typed `ServerEvent`s. Reconnect with 500 ms → 15 s backoff, auth-close hard-stop. |
| Mic capture | `MicCapture.kt` | `AudioRecord(VOICE_COMMUNICATION, 24 kHz, MONO, PCM_16BIT)`. Base64-encodes each `read()` chunk, sends as `input_audio_buffer.append`. Gated by the mute flag in the view-model. |
| Playback | `AudioPlayer.kt` | `AudioTrack(USAGE_MEDIA, MODE_STREAM)`. Background writer thread consumes a `LinkedBlockingQueue<ByteArray>`. `flush()` clears pending chunks on server `interruption`. |
| State machine | `SessionViewModel.kt` | `AndroidViewModel`. Owns lifecycle: sets `AudioManager.MODE_IN_COMMUNICATION` for the session, wires client + player, exposes `StateFlow<SessionState>` with status / levels / chunk counter / mute. |
| UI | `MainActivity.kt` | Compose single-screen app. Status chip, two labelled waveforms (simple VU-style meter), mute pill, sending counter, call button, error banner. |

## Audio routing

For a Kotlin voice agent three things must line up, or the mic gets silent / the speaker gets quiet:

- **Mic source** must be `MediaRecorder.AudioSource.VOICE_COMMUNICATION`. Without it there is no platform AEC and the agent will hear its own output looping.
- **App audio mode** must be `AudioManager.MODE_IN_COMMUNICATION` during the session. This engages the HAL's AEC / NS coupling on top of the source flag. Restore `MODE_NORMAL` on teardown. The view-model does this automatically.
- **Playback** uses `USAGE_MEDIA` on the `AudioTrack`. `USAGE_VOICE_COMMUNICATION` would map to `STREAM_VOICE_CALL`, which is system-controlled, has no app-settable volume, and is silent on emulators. AEC coupling still works — it's the mic source + audio mode, not the output stream identity, that matters.

## Testing

### Emulator

```bash
# boot Pixel_9 AVD
$ANDROID_HOME/emulator/emulator -avd Pixel_9 -no-snapshot-save -audio coreaudio &

# install + launch
adb install -r app/build/outputs/apk/debug/app-debug.apk
adb shell am start -n ai.smallest.atomsvoiceagent/.MainActivity
adb shell cmd audio set-volume 3 25   # max media volume
```

On the emulator's `⋯` (Extended Controls) → **Microphone** panel, enable **"Virtual microphone uses host audio input"**. Without this the emulator's virtual mic records zero-amplitude PCM regardless of what you say to your Mac — the `sending · N` counter will climb (transport works) but the server's VAD will never trigger.

Expected logcat after tapping **Begin session**:

```
I Atoms   : WebSocket open
I Atoms   : session.created
D AudioTrack: stop(…): called with N frames delivered    # agent audio played
```

### Physical device

Same `./gradlew installDebug` with a plugged-in device. Real mic works out of the box; no host-mic toggle needed.

## Known limitations

- **Emulator mic is silent by default on Apple Silicon.** You must enable Virtual microphone uses host audio input in Extended Controls. Even then the routing is flaky on some Android Studio versions. Real device is the reliable path for mic testing.
- **Emulator output routing is sticky.** If you plug in or unplug headphones while the emulator is running, the qemu CoreAudio backend can lose the output route. Reboot the emulator to recover. Real device unaffected.
- **No settings picker** for voice / speed / language in this cookbook. The [React Native](../react_native_voice_agent/) and [iOS Swift](../ios_swift_voice_agent/) cookbooks have one; this one is kept minimal. To change voice, use the dashboard or the Python `setup_agent.py` script.
- **Background mode.** The session tears down on app backgrounding. Keeping the socket + mic open requires a foreground service with `foregroundServiceType="phoneCall"` (Android 14+), which is out of scope here. See the [Android Kotlin integration guide](https://docs.smallest.ai/atoms/developer-guide/integrate/mobile/android-kotlin) for the foreground-service pattern.

## Reference

- [Realtime Agent WebSocket API](https://docs.smallest.ai/atoms/api-reference/api-reference/realtime-agent/realtime-agent) — full event protocol.
- [Android (Kotlin) integration guide](https://docs.smallest.ai/atoms/developer-guide/integrate/mobile/android-kotlin) — the protocol snippets this cookbook builds on.
- [React Native voice agent cookbook](../react_native_voice_agent/) — the same app pattern in React Native.
- [iOS Swift voice agent cookbook](../ios_swift_voice_agent/) — the same app pattern in SwiftUI.
