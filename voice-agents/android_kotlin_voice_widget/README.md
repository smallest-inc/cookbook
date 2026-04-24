# Android Kotlin Voice Widget

Drop-in voice-agent widget for existing Android apps. One Composable — `AtomsWidget(apiKey, agentId)` — renders a floating **Ask AI** pill in the corner, opens a Material 3 `ModalBottomSheet` on tap with a live voice session (status line, animated waveform, mic button). Host app keeps rendering underneath.

Mirrors the React Native widget cookbook at [`react_native_voice_widget/`](../react_native_voice_widget/). Transport, audio, and state pattern are all parallel; only the UI layer is native Kotlin/Compose.

## Drop it into your app

```kotlin
import ai.smallest.atomswidget.AtomsWidget

setContent {
    Box(Modifier.fillMaxSize()) {
        YourHostScreen()
        AtomsWidget(apiKey = API_KEY, agentId = AGENT_ID, label = "Ask AI")
    }
}
```

## Prerequisites

- Android Studio, SDK 35, JDK 17
- Smallest API key + agent ID (dashboard or via the Python setup script in [`react_native_voice_widget/scripts/setup_agent.py`](../react_native_voice_widget/scripts/setup_agent.py)). The MyClinic Receptionist agent pairs cleanly with the built-in host demo.

## Run

```bash
cd voice-agents/android_kotlin_voice_widget
cp local.properties.example local.properties
# Fill in: sdk.dir, ATOMS_API_KEY, ATOMS_AGENT_ID
./gradlew assembleDebug
adb install -r app/build/outputs/apk/debug/app-debug.apk
adb shell am start -n ai.smallest.atomswidget/.MainActivity
```

On the Pixel emulator: *Extended Controls → Microphone → Virtual microphone uses host audio input → ON* so the emulator picks up your Mac's mic.

## How it works

| File | Role |
|---|---|
| `Widget.kt` | `AtomsWidget` composable + sub-pieces (pill, transcript placeholder, status line, waveform, action row, mic button). `ModalBottomSheet` manages the sheet. |
| `MainActivity.kt` | Host demo (MyClinic reception dashboard) + embedded widget. |
| `AtomsClient.kt` | OkHttp WS client with auth hard-stop + backoff reconnect. |
| `AudioPlayer.kt` | AudioTrack with `USAGE_MEDIA` on a writer thread. |
| `MicCapture.kt` | AudioRecord `VOICE_COMMUNICATION` → base64 PCM16 chunks. |
| `SessionViewModel.kt` | `StateFlow<SessionState>`, wraps MODE_IN_COMMUNICATION around the session. |
| `Theme.kt` | Brand palette constants. |

## Brand palette

Every color comes from `Theme.kt` (`BrandColors.Teal`, `BrandColors.Surface`, etc.) — do not invent. Teal #43B6B6 is the primary; cream #FBFAF5 is the default surface; coral #FF5E5E is only for danger / mute state.

## Known limitations

- No transcript streaming yet — server emits `transcript` events; the Compose UI shows a placeholder. Porting the RN widget's transcript handling is straightforward.
- No settings picker (voice / speed / language). Use the dashboard or re-run `setup_agent.py`.
- Background mode tears the session down. A production widget needs a foreground service with `phoneCall` type (Android 14+).
- Emulator virtual mic needs the Extended-Controls toggle on Apple Silicon.

## Reference

- [React Native widget cookbook](../react_native_voice_widget/) — same pattern, earlier implementation with transcript + mute chunk-counter.
- [Android (Kotlin) integration guide](https://docs.smallest.ai/atoms/developer-guide/integrate/mobile/android-kotlin) — raw protocol reference.
