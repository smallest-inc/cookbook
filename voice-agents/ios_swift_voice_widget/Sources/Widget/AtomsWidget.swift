import SwiftUI

/// Drop-in voice-agent widget. Renders a floating "Ask AI" pill in the
/// corner; tapping opens a bottom sheet with a live voice session.
///
/// Consumer:
///   AtomsWidget(apiKey: KEY, agentId: ID)
///
/// Place it in the same ZStack as your host screen; the pill is absolutely
/// positioned so the host app continues to receive gestures.
struct AtomsWidget: View {
    let apiKey: String
    let agentId: String
    var label: String = "Ask AI"

    @StateObject private var session = SessionViewModel()
    @State private var open = false

    var body: some View {
        VStack {
            Spacer()
            HStack {
                Spacer()
                pill
                    .padding(.trailing, 20)
                    .padding(.bottom, 28)
            }
        }
        .ignoresSafeArea(edges: .bottom)
        .sheet(isPresented: $open, onDismiss: { session.stop() }) {
            WidgetSheet(session: session, onClose: { open = false })
                .presentationDetents([.fraction(0.55)])
                .presentationDragIndicator(.visible)
                .task { await session.start(apiKey: apiKey, agentId: agentId) }
        }
    }

    private var pill: some View {
        Button(action: { open = true }) {
            HStack(spacing: 10) {
                Circle().fill(BrandColors.teal).frame(width: 9, height: 9)
                Text(label)
                    .font(.system(size: 13, weight: .semibold))
                    .foregroundColor(BrandColors.textOnDark)
                    .kerning(0.2)
            }
            .padding(.horizontal, 18)
            .padding(.vertical, 12)
            .background(Capsule().fill(BrandColors.ink))
            .shadow(color: Color.black.opacity(0.2), radius: 10, x: 0, y: 4)
        }
        .buttonStyle(.plain)
    }
}

/// Inner body of the bottom sheet. Kept separate so the `.task` above can
/// own the session lifecycle and SwiftUI cleans up properly on dismiss.
struct WidgetSheet: View {
    @ObservedObject var session: SessionViewModel
    var onClose: () -> Void

    var body: some View {
        VStack(spacing: 18) {
            TranscriptPlaceholder()
            VStack(spacing: 14) {
                StatusLine(status: session.status)
                WaveformBars(level: activeLevel, active: waveformActive)
            }
            ActionRow(
                muted: session.muted,
                onMic: { session.toggleMute() },
                onClose: onClose
            )
            if let err = session.error {
                Text(err.message)
                    .font(.system(size: 12))
                    .foregroundColor(BrandColors.coral)
                    .multilineTextAlignment(.center)
            }
        }
        .padding(.horizontal, 20)
        .padding(.top, 14)
        .padding(.bottom, 24)
        .background(BrandColors.surface)
    }

    private var activeLevel: Float {
        session.status == .narrating ? session.agentLevel : session.micLevel
    }

    private var waveformActive: Bool {
        switch session.status {
        case .narrating: return true
        case .listening, .joined: return !session.muted
        default: return false
        }
    }
}

// ──────────────────────── subviews ────────────────────────

private struct TranscriptPlaceholder: View {
    var body: some View {
        Text("Speak after the assistant greets you. Transcript appears here.")
            .font(.system(size: 12, weight: .medium))
            .foregroundColor(BrandColors.textMuted)
            .multilineTextAlignment(.center)
            .frame(maxWidth: .infinity)
            .padding(.vertical, 14)
    }
}

private struct StatusLine: View {
    let status: SessionStatus
    var body: some View {
        HStack(spacing: 8) {
            Circle().fill(dot).frame(width: 8, height: 8)
            Text(label)
                .font(.system(size: 15, weight: .semibold))
                .foregroundColor(BrandColors.teal)
        }
    }
    private var label: String {
        switch status {
        case .idle:         return "Tap the mic to start"
        case .connecting:   return "Connecting…"
        case .joined:       return "Assistant joined"
        case .listening:    return "Listening"
        case .narrating:    return "Speaking"
        case .error:        return "Something went wrong"
        }
    }
    private var dot: Color {
        switch status {
        case .idle:         return BrandColors.divider
        case .connecting:   return BrandColors.gold
        case .joined, .listening, .narrating: return BrandColors.teal
        case .error:        return BrandColors.coral
        }
    }
}

/// 9-bar animated waveform with a center-weighted envelope so the whole
/// thing reads as one pulse instead of independent spikes.
private struct WaveformBars: View {
    let level: Float
    let active: Bool
    private let bars = 9
    private let minH: CGFloat = 4
    private let maxH: CGFloat = 26

    var body: some View {
        HStack(spacing: 4) {
            ForEach(0..<bars, id: \.self) { i in
                RoundedRectangle(cornerRadius: 2)
                    .fill(active ? BrandColors.teal : BrandColors.divider)
                    .frame(width: 3, height: height(for: i))
                    .animation(.easeOut(duration: 0.11), value: level)
            }
        }
        .frame(height: maxH + 4)
    }

    private func height(for i: Int) -> CGFloat {
        guard active else { return minH }
        let weight = 1 - abs(CGFloat(i) - CGFloat(bars - 1) / 2) / (CGFloat(bars - 1) / 2)
        let normalized = CGFloat(min(max(level * 3, 0), 1))
        let h = minH + (minH + weight * (maxH - minH)) * normalized + weight * 3
        return min(h, maxH)
    }
}

private struct ActionRow: View {
    let muted: Bool
    let onMic: () -> Void
    let onClose: () -> Void

    var body: some View {
        HStack {
            CircleIconButton(system: "keyboard", enabled: false, action: {})
            Spacer()
            MicButton(muted: muted, action: onMic)
            Spacer()
            CircleIconButton(system: "xmark", action: onClose)
        }
        .padding(.horizontal, 12)
    }
}

private struct CircleIconButton: View {
    let system: String
    var enabled: Bool = true
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            Image(systemName: system)
                .font(.system(size: 15, weight: .medium))
                .foregroundColor(enabled ? BrandColors.textSecondary : BrandColors.textMuted)
                .frame(width: 44, height: 44)
                .background(Circle().fill(BrandColors.surfaceAlt))
        }
        .buttonStyle(.plain)
        .disabled(!enabled)
    }
}

private struct MicButton: View {
    let muted: Bool
    let action: () -> Void

    @State private var pulseScale: CGFloat = 1
    @State private var pulseOpacity: Double = 0.45

    var body: some View {
        ZStack {
            if !muted {
                Circle()
                    .fill(BrandColors.teal)
                    .frame(width: 64, height: 64)
                    .scaleEffect(pulseScale)
                    .opacity(pulseOpacity)
                    .onAppear {
                        withAnimation(.easeInOut(duration: 0.9).repeatForever(autoreverses: true)) {
                            pulseScale = 1.35
                            pulseOpacity = 0
                        }
                    }
            }
            Button(action: action) {
                Image(systemName: muted ? "mic.slash.fill" : "mic.fill")
                    .font(.system(size: 22, weight: .semibold))
                    .foregroundColor(BrandColors.textOnDark)
                    .frame(width: 56, height: 56)
                    .background(Circle().fill(muted ? BrandColors.coral : BrandColors.teal))
                    .shadow(color: Color.black.opacity(0.18), radius: 8, x: 0, y: 4)
            }
            .buttonStyle(.plain)
        }
        .frame(width: 72, height: 72)
    }
}
