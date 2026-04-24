# iOS Swift Voice Agent

A minimal native iOS sample that opens a real-time voice session with a Smallest Atoms agent over the plain WebSocket endpoint. SwiftUI, `URLSessionWebSocketTask`, `AVAudioEngine`. iOS 16+.

The app has the same UX as the [React Native cookbook](../react_native_voice_agent/) — status chip, two labelled waveforms (narrator + you), mute toggle, sending counter, in-app settings sheet wired to the full `draft → publish → activate` REST flow.

## What it shows

- Real-time voice session over `wss://api.smallest.ai/atoms/v1/agent/connect` using `URLSessionWebSocketTask` (no SDK, no WebRTC, no LiveKit).
- Microphone capture via `AVAudioEngine` with a tap on the input node, resampled to 24 kHz PCM16 before sending.
- Gapless playback of `output_audio.delta` chunks via `AVAudioPlayerNode.scheduleBuffer`.
- Full protocol: `input_audio_buffer.append` streaming, `agent_start_talking` / `agent_stop_talking` / `interruption` / `session.closed` / `error` handling.
- Exponential-backoff reconnect on transient network errors; hard-stop on auth failures.
- In-app settings sheet: voice / speed / language pickers that drive the five-step `draft → publish → activate` REST dance.
- Mute toggle gates the mic-upload path client-side — useful during narration when room noise is tripping server VAD.
- Transport diagnostics: a live "sending · N" counter under the you waveform, independent of mic level.

## Prerequisites

- **macOS** with **Xcode 15+** (iOS 16 SDK or newer)
- **[xcodegen](https://github.com/yonaskolb/XcodeGen)** — used to generate the `.xcodeproj` from `project.yml`. Install with `brew install xcodegen`.
- A Smallest AI account and an API key from [app.smallest.ai/dashboard/api-keys](https://app.smallest.ai/dashboard/api-keys).
- An Atoms **agent ID**. Create one in the dashboard, or use the Python setup script from the [React Native cookbook](../react_native_voice_agent/scripts/setup_agent.py) to create a Victorian-mystery narrator end-to-end.

## Setup

```bash
cd voice-agents/ios_swift_voice_agent
xcodegen generate                # produces AtomsVoiceAgent.xcodeproj
open AtomsVoiceAgent.xcodeproj   # opens in Xcode
```

In Xcode:

1. Select the **AtomsVoiceAgent** target → **Signing & Capabilities** → set your **Team** (Personal Team is fine for a dev build).
2. **Product → Scheme → Edit Scheme... → Run → Arguments → Environment Variables**, add:

   | Key                 | Value                           |
   |---------------------|---------------------------------|
   | `ATOMS_API_KEY`     | `sk_...`                        |
   | `ATOMS_AGENT_ID`    | `669...` (your agent id)        |

   Keep these out of source control.
3. Pick a device or simulator and **Run**.

## How it works

| Layer | File | Responsibility |
|---|---|---|
| Transport | `Sources/Clients/AtomsClient.swift` | `URLSessionWebSocketTask` wrapper with exponential-backoff reconnect, event dispatch, auth-close hard-stop. |
| REST | `Sources/Clients/AtomsRest.swift` | Thin `URLSession` wrapper for the `draft → publish → activate` flow used by the settings sheet. |
| Audio | `Sources/Audio/AudioEngine.swift` | `AVAudioEngine` setup (`.playAndRecord` + `.voiceChat` + `defaultToSpeaker`), mic tap with inline resample to Int16 @ 24 kHz, `AVAudioPlayerNode` for gapless playback. |
| State machine | `Sources/ViewModels/SessionViewModel.swift` | `@MainActor ObservableObject`. Owns lifecycle, permission flow, mute gating, mic-chunk counter, error classification. |
| UI | `Sources/Views/*.swift` | SwiftUI single-screen app — title card, status chip, two labelled waveforms, mute pill, send counter, settings sheet, call button, error banner. |

## iOS audio session

`playAndRecord` + `.voiceChat` is the right pick for a bidirectional voice call on **device**:

- `.voiceChat` engages the hardware AEC / NS pipeline — matters when the speaker and mic are both open.
- `.defaultToSpeaker` routes to the loud bottom speaker. (Note: on `voiceChat` mode iOS can override this; in practice devices honor it when no external route is active.)
- `.allowBluetoothHFP` lets AirPods / Bluetooth headsets take the audio path.

If you test on the **simulator**, audio goes through macOS CoreAudio's resampler at 48 kHz and produces noticeably buzzy / distorted output on 24 kHz streams. **Validate audio quality on a physical device.** This is a documented Apple simulator limitation, not an app bug.

## In-app settings

Tap **settings** (top-right, idle screen) to open the agent configuration sheet:

- **Voice** — six curated `lightning-v3.1` voices (Magnus, Daniel, Emily, Sophia, Arjun, Priya). If the current voice is a custom clone, it's shown as a "custom:" chip.
- **Speed** — 0.85× / 1.00× / 1.15× / 1.30×.
- **Language** — English, Hindi, Multi (auto-detect).

**Apply & publish** runs the five-step REST flow (`GET /versions` → `POST /drafts` → `PATCH /drafts/.../config` → `POST /drafts/.../publish` → `PATCH /versions/.../activate`) against your live agent. End the current session and start a new one to hear the change.

## Testing

### Simulator smoke test

```bash
xcodegen generate
xcodebuild \
  -project AtomsVoiceAgent.xcodeproj \
  -scheme AtomsVoiceAgent \
  -configuration Debug \
  -sdk iphonesimulator \
  -destination 'generic/platform=iOS Simulator' \
  build
```

Should produce `** BUILD SUCCEEDED **`.

To run:

```bash
xcrun simctl boot 'iPhone 17 Pro' || true
open -a Simulator
# Then hit ▶ in Xcode, or build+install via xcodebuild
```

Expect: WebSocket opens, `session.created` fires, narrator greets. Agent audio will sound distorted on simulator (see iOS audio session note above).

### Physical device test

Plug in an iPhone via USB, Trust the computer, enable *Developer Mode* in Settings → Privacy & Security, then in Xcode select your phone from the device picker and Run. Everything works cleanly on device — clean full-speaker audio, real mic, no resampler artifacts.

### Verifying transport

During a session, the "sending · N" counter under the *you* waveform increments by one per outbound mic chunk (~10 per second when speaking). If the counter climbs, your mic data is reaching the server regardless of whether the mic is capturing silence or real audio. That's a cheap transport-alive signal you can reuse in your own app.

## Known limitations

- **iOS simulator distorts audio.** Sample-rate bridging through macOS CoreAudio introduces artifacts on 24 kHz streams. Test on device for audio fidelity.
- **Background mode.** The session tears down on app backgrounding. Notification Center, Control Center, and brief system dialogs keep the session alive. Running a socket + mic across a full app suspension requires VoIP entitlements + a CallKit integration, which is intentionally out of scope here.
- **Reconnect is auth-unaware.** If the server closes with an auth error the transport retries once more before giving up. Replace the retry logic in `AtomsClient.swift` if you need instant auth-error surfacing.
- **Curated voice list.** The settings sheet ships with six shortlisted voices. Fetch `GET /waves/v1/voices` at runtime for the full `lightning-v3.1` catalogue (106 voices).

## Reference

- [Realtime Agent WebSocket API](https://docs.smallest.ai/atoms/api-reference/api-reference/realtime-agent/realtime-agent) — full event protocol.
- [iOS (Swift) integration guide](https://docs.smallest.ai/atoms/developer-guide/integrate/mobile/ios-swift) — the integration reference this cookbook implements end-to-end.
- [React Native voice agent cookbook](../react_native_voice_agent/) — the same app pattern in React Native.
