# iOS Swift Voice Widget

Drop-in voice-agent widget for native iOS (SwiftUI) host apps. One view — `AtomsWidget(apiKey:, agentId:)` — renders a floating **Ask AI** pill, opens a bottom sheet on tap with a live voice session (status line, animated waveform, mic button). Host app keeps rendering underneath.

Mirrors the [React Native widget](../react_native_voice_widget/) and the [Android Kotlin widget](../android_kotlin_voice_widget/). Transport, audio session, and state pattern are parallel; only the UI layer is native SwiftUI.

## Drop it into your app

```swift
import SwiftUI

struct RootView: View {
    var body: some View {
        ZStack {
            YourHostScreen()
            AtomsWidget(apiKey: API_KEY, agentId: AGENT_ID, label: "Ask AI")
        }
    }
}
```

## Prerequisites

- Xcode 15+, iOS 16+ deployment target
- `xcodegen` (`brew install xcodegen`) to regenerate the `.xcodeproj` from `project.yml`
- Smallest API key + agent ID (create the MyClinic Receptionist via [`react_native_voice_widget/scripts/setup_agent.py`](../react_native_voice_widget/scripts/setup_agent.py) or any of your own dashboard agents)

## Run

```bash
cd voice-agents/ios_swift_voice_widget
xcodegen generate
open AtomsVoiceWidget.xcodeproj
```

In Xcode:
1. Signing & Capabilities → set your Team (Personal Team is fine)
2. Edit Scheme → Run → Arguments → Environment Variables → add:
   - `ATOMS_API_KEY = sk_...`
   - `ATOMS_AGENT_ID = 669...`
3. ▶ Run on a simulator or a physical device.

Validated with:

```bash
xcodebuild -project AtomsVoiceWidget.xcodeproj -scheme AtomsVoiceWidget \
  -configuration Debug -sdk iphonesimulator \
  -destination 'generic/platform=iOS Simulator' build
# → ** BUILD SUCCEEDED **
```

## How it works

| File | Role |
|---|---|
| `Sources/Widget/AtomsWidget.swift` | Public view + sheet wrapper + all the sub-pieces (status line, waveform, mic button, action row). |
| `Sources/App.swift` | Host demo (MyClinic dashboard) with the widget embedded. |
| `Sources/Clients/AtomsClient.swift` | `URLSessionWebSocketTask` wrapper with reconnect + typed events. |
| `Sources/Audio/AudioEngine.swift` | `AVAudioEngine` mic tap + `AVAudioPlayerNode` playback. |
| `Sources/ViewModels/SessionViewModel.swift` | `@MainActor ObservableObject`; `start(apiKey:, agentId:)` accepts widget props. |
| `Sources/Theme/BrandColors.swift` | Brand palette constants. |

## iOS audio session

`.playAndRecord` + `.default` mode + `.defaultToSpeaker`. Full-speaker volume, clean continuous playback. No hardware AEC by default — on hands-free the user should mute between turns (mic button) or wear headphones. See the [iOS Swift integration guide](https://docs.smallest.ai/atoms/developer-guide/integrate/mobile/ios-swift) for the three-way audio-session trade-off.

## iOS simulator caveat

Audio goes through the macOS CoreAudio resampler and sounds buzzy. This is an Apple simulator limitation, not an app bug. Validate audio quality on a physical device.

## Known limitations

- No transcript streaming in this widget yet — the RN widget wires `transcript` events, easy port to Swift when you want.
- No settings picker (voice / speed / language).
- Background mode tears the session down. Production needs VoIP entitlements + CallKit.

## Reference

- [React Native widget cookbook](../react_native_voice_widget/)
- [iOS (Swift) integration guide](https://docs.smallest.ai/atoms/developer-guide/integrate/mobile/ios-swift)
