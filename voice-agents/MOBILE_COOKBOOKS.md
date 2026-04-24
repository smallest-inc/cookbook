# Mobile voice agent cookbooks — how to test and use

Four end-to-end voice-agent apps live under `voice-agents/`, all implementing the **same UX pattern** against the Smallest Atoms realtime WebSocket. Pick the one matching your stack; the protocol is identical.

| Cookbook | Stack | Tested on |
|---|---|---|
| [`react_native_voice_agent/`](./react_native_voice_agent/) | Expo / React Native + `react-native-audio-api` | iOS sim, iPhone 13 USB, Android emulator, real Android phone |
| [`ios_swift_voice_agent/`](./ios_swift_voice_agent/) | SwiftUI + `URLSessionWebSocketTask` + `AVAudioEngine` | `xcodebuild … -sdk iphonesimulator build` → SUCCEEDED |
| [`android_kotlin_voice_agent/`](./android_kotlin_voice_agent/) | Jetpack Compose + OkHttp WS + `AudioRecord`/`AudioTrack` | `./gradlew assembleDebug` → SUCCESSFUL, runs on Pixel 9 emulator |
| [`flutter_voice_agent/`](./flutter_voice_agent/) | Flutter 3.22+ + `mic_stream` + `flutter_pcm_sound` | `flutter analyze` → 0 issues |

All four follow the same UX:
- Begin / End session button
- Status chip (`connecting → joined → listening → narrating`)
- Two labelled waveforms (narrator + you) with active colour states
- `sending · N` counter — outbound-chunk transport indicator
- Mute button that gates mic uploads client-side
- Error banner on server / auth / network errors

Only the RN and iOS Swift cookbooks ship an in-app settings sheet (voice / speed / language → full `draft → publish → activate` REST flow). Kotlin and Flutter cookbooks are minimal; configure the agent in the dashboard.

---

## Shared prerequisites

- **Smallest API key**: [app.smallest.ai/dashboard/api-keys](https://app.smallest.ai/dashboard/api-keys)
- **Agent ID**: create one in the dashboard, or use the Python script at [`react_native_voice_agent/scripts/setup_agent.py`](./react_native_voice_agent/scripts/setup_agent.py) to spin up a Victorian-mystery narrator end-to-end.
- One real phone per platform. Simulators work for protocol validation but **not** for audio quality (iOS simulator distorts through the macOS CoreAudio resampler; Android emulator virtual mic is silent on Apple Silicon without the host-audio-input toggle).

---

## Quick-run each cookbook

### React Native (Expo)
```bash
cd voice-agents/react_native_voice_agent
cp .env.example .env       # paste SMALLEST_API_KEY; AGENT_ID is optional (script fills it in)
python3 scripts/setup_agent.py
npm install
npx expo prebuild --clean
npx expo run:ios           # or: npx expo run:android
```

### iOS Swift
```bash
cd voice-agents/ios_swift_voice_agent
xcodegen generate          # brew install xcodegen if needed
open AtomsVoiceAgent.xcodeproj
# In Xcode: Scheme → Edit Scheme → Run → Arguments → Environment Variables
#   ATOMS_API_KEY = sk_...
#   ATOMS_AGENT_ID = 669...
# Select a device or simulator and hit Run
```

### Android Kotlin
```bash
cd voice-agents/android_kotlin_voice_agent
cp local.properties.example local.properties
# Edit local.properties: set sdk.dir, ATOMS_API_KEY, ATOMS_AGENT_ID
./gradlew assembleDebug
adb install -r app/build/outputs/apk/debug/app-debug.apk
adb shell am start -n ai.smallest.atomsvoiceagent/.MainActivity
```

### Flutter
```bash
cd voice-agents/flutter_voice_agent
flutter create . --platforms=ios,android --project-name atoms_voice_agent --org ai.smallest  # only if ios/ and android/ not present
flutter pub get
flutter run \
  --dart-define=ATOMS_API_KEY=sk_your_key \
  --dart-define=ATOMS_AGENT_ID=your_agent_id
```

---

## Validation each cookbook went through

### React Native
- ✅ iOS simulator (iPhone 17 Pro 26.4): WebSocket open, `session.created`, playback distorted via sim audio bridge (known Apple issue — real device is clean)
- ✅ iPhone 13 physical device: WebSocket + speaker playback + mic input + agent responds, settings sheet Apply succeeds
- ✅ Pixel_9 Android emulator with host-mic-input toggle: full loop works
- ✅ Voice / speed / language picker — `draft → publish → activate` REST dance confirmed against a live agent

### iOS Swift
- ✅ `xcodebuild -sdk iphonesimulator build` → `** BUILD SUCCEEDED **`, no warnings after cleanup
- ✅ Code pasted verbatim from the [iOS Swift integration guide](https://docs.smallest.ai/atoms/developer-guide/integrate/mobile/ios-swift)
- Not yet executed on device (scheme team-signing is a manual one-time step); validated by compile + by equivalence to the RN cookbook which tested cleanly on a physical iPhone 13 today

### Android Kotlin
- ✅ `./gradlew assembleDebug` → `BUILD SUCCESSFUL` (37 tasks, Kotlin 2.0.21, AGP 8.7.2, Compose BOM 2024.12.01, minSdk 24, targetSdk 35)
- ✅ Earlier the exact same `AtomsAgent.kt` + `AudioPlayer.kt` + `streamMicrophone` was validated against Pixel_9 API 35: WebSocket open, `session.created`, `AudioTrack stop(24): 23040 frames delivered` logged, MODE_IN_COMMUNICATION engaged per Telecom watchdog

### Flutter
- ✅ `flutter analyze` → **No issues found.** on Flutter 3.32.5 / Dart 3.8.1
- ✅ `flutter pub get` resolves `mic_stream`, `flutter_pcm_sound ^3.3.3`, `web_socket_channel`, `permission_handler`
- Not yet executed on device in this session; the app code mirrors the validated integration guide patterns

---

## Testing patterns that work across all four

### 1. Smoke-test the WebSocket without any mic
Run the Python probe in the repo root ([`/tmp/wss_probe.py`](../../../tmp/wss_probe.py) if you preserved it locally, or just curl the endpoint) with your API key + agent id. If `session.created` fires and audio starts flowing, the backend + your credentials are fine — anything else is client-side.

### 2. Watch the `sending · N` counter
Present in all four apps. It increments per outbound mic chunk (~10-50/sec depending on buffer size). If the number climbs, your mic-upload pipeline is alive and transport is OK regardless of whether the mic is capturing silence.

### 3. Listen first, then speak
Tap **Begin session**. The agent greets you → narrator plays → status flips to `listening`. If you hear the greeting, output-audio path works. Then speak; if the agent responds, input-audio path works.

### 4. Headphones for mic-loop debugging
The speaker → mic echo loop on hands-free causes the server's VAD to fire `interruption` events mid-narration. The mute button helps. Headphones kill it entirely. Ship with the mute button, document the limitation.

### 5. Android emulator on Apple Silicon
Enable **Extended Controls → Microphone → Virtual microphone uses host audio input** — without it the emulator's virtual mic records silence regardless of what you say to your Mac.

---

## When to use which cookbook

- **Cross-platform app, you already use React Native or want to** → Hearthside (`react_native_voice_agent`). Fastest to ship. Largest feature set (settings sheet).
- **Existing native iOS app** → `ios_swift_voice_agent`. Pulls in only `URLSessionWebSocketTask` + `AVAudioEngine`, no external deps, no React bridge.
- **Existing native Android app** → `android_kotlin_voice_agent`. OkHttp-only, Compose-native, minSdk 24.
- **Existing Flutter app** → `flutter_voice_agent`. Three well-maintained pub.dev packages, no platform-channel code to own.

If you have no existing app and are starting fresh, Hearthside (RN) is the recommended entry point — shortest path to a production-quality experience on both platforms.

---

## Known gaps (roadmap for future work)

- **No drop-in SDK yet** — these are reference apps, not packages. A future sprint can publish `@smallest-ai/atoms-react-native`, an iOS Swift Package, an Android Maven artifact, and a Flutter pub.dev package that wraps the Hearthside patterns as one-line components.
- **Background mode** isn't wired on any of the four. Requires a foreground service on Android (with `foregroundServiceType="phoneCall"` from Android 14) and VoIP entitlements + CallKit on iOS. Out of scope for a cookbook demo; see the platform integration guides for the foreground-service pattern.
- **Only RN + iOS ship a settings sheet.** Porting to Kotlin + Flutter is a simple REST-wrapper pattern; happy to add if there's demand.
- **Flutter iOS AEC.** `mic_stream` skips `AVAudioSession` configuration on iOS. For hands-free iOS use with Flutter, add the [`audio_session`](https://pub.dev/packages/audio_session) package and configure `.playAndRecord` / `.voiceChat` before starting capture.

---

## Reference

- [Realtime Agent WebSocket API](https://docs.smallest.ai/atoms/api-reference/api-reference/realtime-agent/realtime-agent) — full event protocol.
- [React Native integration guide](https://docs.smallest.ai/atoms/developer-guide/integrate/mobile/react-native)
- [iOS (Swift) integration guide](https://docs.smallest.ai/atoms/developer-guide/integrate/mobile/ios-swift)
- [Android (Kotlin) integration guide](https://docs.smallest.ai/atoms/developer-guide/integrate/mobile/android-kotlin)
- [Flutter integration guide](https://docs.smallest.ai/atoms/developer-guide/integrate/mobile/flutter)
