# Flutter Voice Widget

Drop-in voice-agent widget for existing Flutter apps. One `AtomsWidget` — stack it with your host screen and it renders a floating **Ask AI** pill bottom-right. Tap opens a modal bottom sheet with a live voice session.

Mirrors the [React Native](../react_native_voice_widget/), [iOS Swift](../ios_swift_voice_widget/), and [Android Kotlin](../android_kotlin_voice_widget/) widgets. Same protocol, same audio libraries as the Flutter reference cookbook.

## Drop it into your app

```dart
import 'widget/atoms_widget.dart';

Scaffold(
  body: Stack(fit: StackFit.expand, children: [
    const YourHostScreen(),
    AtomsWidget(apiKey: apiKey, agentId: agentId, label: 'Ask AI'),
  ]),
);
```

## Prerequisites

- Flutter SDK ≥ 3.22 (Dart ≥ 3.4)
- Xcode 15+ for iOS, Android Studio + SDK 35 for Android
- Smallest API key + agent ID

## Run

```bash
cd voice-agents/flutter_voice_widget
flutter create . --platforms=ios,android --project-name atoms_voice_widget --org ai.smallest  # only on fresh clone
flutter pub get
flutter run \
  --dart-define=ATOMS_API_KEY=sk_your_key \
  --dart-define=ATOMS_AGENT_ID=your_agent_id
```

Validated with `flutter analyze` → **No issues found.** on Flutter 3.32.5 / Dart 3.8.1.

## How it works

| File | Role |
|---|---|
| `lib/widget/atoms_widget.dart` | `AtomsWidget` public widget + `_Sheet`, `_Pill`, `_StatusLine`, `_Waveform`, `_ActionRow`, `_MicButton`. |
| `lib/main.dart` | Host demo (MyClinic dashboard) with the widget stacked. |
| `lib/atoms_client.dart` | `web_socket_channel` with typed events + reconnect. |
| `lib/audio/mic_capture.dart`, `pcm_playback.dart` | `mic_stream` + `flutter_pcm_sound`. |
| `lib/session_controller.dart` | `ValueNotifier<SessionState>` owning the session lifecycle. |
| `lib/theme/brand.dart` | Brand palette constants. |

## Known limitations

- `mic_stream` does not configure `AVAudioSession` on iOS — no hardware AEC. Add [`audio_session`](https://pub.dev/packages/audio_session) for voice-chat mode if you need it.
- No transcript handling (RN widget wires `transcript` events; straightforward port).
- No settings picker.
- Backgrounding tears the session down.
- `mic_stream` + `flutter_pcm_sound` are mobile-only (iOS + Android). Desktop needs `flutter_webrtc` or platform-channel bridges.

## Reference

- [React Native widget cookbook](../react_native_voice_widget/)
- [Flutter integration guide](https://docs.smallest.ai/atoms/developer-guide/integrate/mobile/flutter)
