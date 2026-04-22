# Hearthside — a voice-told story on Smallest Atoms

A minimal React Native (Expo) sample that opens a real-time voice session with a Smallest Atoms agent and lets the listener steer a short branching Victorian mystery with their voice. Built on the raw WebSocket protocol documented at [docs.smallest.ai/atoms/developer-guide/integrate/mobile/react-native](https://docs.smallest.ai/atoms/developer-guide/integrate/mobile/react-native).

The app is deliberately narrow. Every feature here matters to the experience: a clean narrator persona, natural turn-taking, low latency, interruption handling, and a visible waveform so the user trusts that their voice is being heard. Nothing else is on screen.

## What it shows

- Real-time voice session over `wss://api.smallest.ai/atoms/v1/agent/connect` using the built-in `WebSocket` global (no SDK).
- Microphone capture and gapless PCM playback using [`react-native-audio-api`](https://docs.swmansion.com/react-native-audio-api/).
- `input_audio_buffer.append` streaming, `output_audio.delta` scheduled playback, `agent_start_talking` / `agent_stop_talking` / `interruption` / `session.closed` handling.
- Exponential-backoff reconnect for transient drops, hard-stop on auth failures.
- Programmatic agent creation via `POST /agent` so the app is reproducible from a clean clone.
- Proper teardown on app backgrounding and component unmount.

## Prerequisites

- **Node** 20+
- **Python** 3.10+ (for the one-time setup script)
- **Xcode** 26 or newer for iOS builds, or **Android Studio** with SDK 34+ for Android builds
- A Smallest AI account and an API key from [app.smallest.ai/dashboard/api-keys](https://app.smallest.ai/dashboard/api-keys)

## Setup (from a fresh clone)

```bash
cd voice-agents/atoms_hearthside_rn

cp .env.example .env
# open .env and paste your SMALLEST_API_KEY

python scripts/setup_agent.py        # creates the narrator agent, writes AGENT_ID to .env
npm install
npx expo prebuild                    # generates ios/ and android/ projects
```

**Run on iOS** (simulator or device):

```bash
npx expo run:ios
```

**Run on Android** (emulator or device):

```bash
npx expo run:android
```

On first launch the app requests microphone permission. Tap **Begin story**, let the narrator read the opening scene, then speak your choice when the narrator pauses. Say *"wait"* or *"repeat that"* to back up to the last branch. Say *"end the story"* to wrap up.

## How it works

| Layer | Module | Responsibility |
|---|---|---|
| Transport | `src/agent/AtomsClient.ts` | Opens the WebSocket, dispatches server events, handles reconnect with backoff. |
| Capture | `src/agent/audioCapture.ts` | Configures the iOS audio session, starts an `AudioRecorder`, converts Float32 → Int16 LE, emits RMS for the mic waveform. |
| Playback | `src/agent/audioPlayback.ts` | Web Audio `AudioContext` with a `nextPlayTime` pointer for gapless scheduling; a `flush()` that resets the pointer on `interruption`. |
| State machine | `src/hooks/useAtomsSession.ts` | `idle → connecting → listening → narrating → error`. Owns permission check, lifecycle, and error classification. |
| UI | `app/index.tsx` + `src/ui/*` | Single screen; shows title card, status chip, two waveform bars (mic + narrator), call button, error banner. |

## Customising the narrator

The narrator persona lives in `scripts/setup_agent.py` as a constant string. Edit the `NARRATOR_SYSTEM_PROMPT`, change `voice_id` to any voice you prefer from the Smallest catalogue, and re-run `python scripts/setup_agent.py`. The script is idempotent: it looks up the agent by name and updates the existing record in place.

If you want a different story genre entirely, the simplest path is to change `AGENT_NAME` as well so the script creates a fresh agent rather than overwriting the mystery version.

## Known limitations

- **iOS simulator feedback loop.** The Mac speaker plays the narrator's audio, the Mac microphone picks it up, the server's VAD interprets it as the user interrupting, and the narrator cuts off in a loop. On a real device with earphones or an HFP Bluetooth headset this does not happen. If you are only evaluating in the simulator, plug in wired headphones or use AirPods.
- **Android emulator virtual microphone.** The emulator's virtual mic records silence by default. Either enable *Extended Controls → Microphone → Virtual microphone uses host audio input*, or run on a physical device.
- **Background mode.** The session tears down on app background. Keeping the socket alive during suspension needs a proper foreground service on Android and VoIP entitlements on iOS, neither of which is in scope for a showcase app.

## Reference

- [Realtime Agent WebSocket API](https://docs.smallest.ai/atoms/api-reference/api-reference/realtime-agent/realtime-agent) — full event protocol.
- [React Native integration guide](https://docs.smallest.ai/atoms/developer-guide/integrate/mobile/react-native) — the validated stack this app uses.
- [`react-native-audio-api`](https://github.com/software-mansion/react-native-audio-api) — the underlying audio library.
