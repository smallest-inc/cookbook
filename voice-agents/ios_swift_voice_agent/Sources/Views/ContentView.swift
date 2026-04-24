import SwiftUI

struct ContentView: View {
    @StateObject private var session = SessionViewModel()
    @State private var settingsOpen = false

    var body: some View {
        ZStack {
            Color.black.ignoresSafeArea()

            VStack {
                // Top slot — status chip during session, settings button when idle
                HStack {
                    Spacer()
                    if session.status.inSession {
                        StatusChip(status: session.status)
                    }
                    Spacer()
                }
                .overlay(alignment: .trailing) {
                    if !session.status.inSession {
                        Button("settings") { settingsOpen = true }
                            .font(.caption.weight(.semibold).smallCaps())
                            .foregroundColor(.white.opacity(0.6))
                            .padding(.horizontal, 12)
                            .padding(.vertical, 6)
                            .overlay(Capsule().stroke(Color.white.opacity(0.15)))
                            .padding(.trailing)
                    }
                }
                .padding(.top)

                Spacer()

                if session.status.inSession {
                    VStack(spacing: 32) {
                        LaneBlock(title: "narrator",
                                  level: session.agentLevel,
                                  color: .orange,
                                  active: session.status == .narrating)

                        LaneBlock(title: session.muted ? "you — muted" : "you",
                                  level: session.muted ? 0 : session.micLevel,
                                  color: .cyan,
                                  active: !session.muted) {
                            HStack(spacing: 10) {
                                if session.micChunksSent > 0 {
                                    HStack(spacing: 6) {
                                        Circle()
                                            .fill(session.muted
                                                  ? Color.red
                                                  : (session.micChunksSent % 2 == 0
                                                     ? Color.cyan
                                                     : Color.white.opacity(0.2)))
                                            .frame(width: 6, height: 6)
                                        Text(session.muted ? "muted" : "sending · \(session.micChunksSent)")
                                            .font(.system(size: 10).smallCaps())
                                            .foregroundColor(.white.opacity(0.5))
                                    }
                                    .padding(.horizontal, 8).padding(.vertical, 3)
                                    .overlay(Capsule().stroke(Color.white.opacity(0.15)))
                                }
                                Button(session.muted ? "unmute" : "mute") {
                                    session.toggleMute()
                                }
                                .font(.system(size: 10, weight: .semibold).smallCaps())
                                .foregroundColor(session.muted ? .black : .white)
                                .padding(.horizontal, 10).padding(.vertical, 4)
                                .background(
                                    Capsule().fill(session.muted ? Color.red : Color.clear)
                                )
                                .overlay(
                                    Capsule().stroke(
                                        session.muted ? Color.red : Color.white.opacity(0.15)
                                    )
                                )
                            }
                        }
                    }
                } else if case .error = session.status {
                    ErrorBanner(error: session.error,
                                onRetry: session.error?.retryable == true ? { Task { await session.start() } } : nil,
                                onDismiss: { session.stop() })
                } else {
                    VStack(spacing: 8) {
                        Text("AtomsVoiceAgent")
                            .font(.system(.largeTitle, design: .serif))
                            .foregroundColor(.white)
                        Text("a voice session")
                            .font(.system(.callout, design: .serif).italic())
                            .foregroundColor(.white.opacity(0.5))
                    }
                }

                Spacer()

                CallButton(
                    label: session.status.inSession
                        ? "End session"
                        : (session.error != nil ? "Try again" : "Begin session"),
                    variant: session.status.inSession ? .danger : .primary
                ) {
                    if session.status.inSession {
                        session.stop()
                    } else {
                        Task { await session.start() }
                    }
                }
                .padding(.bottom, 32)
            }
            .padding(.horizontal, 24)
        }
        .sheet(isPresented: $settingsOpen) {
            SettingsSheet(isPresented: $settingsOpen,
                          apiKey: session.apiKeyReadonly,
                          agentId: session.agentIdReadonly)
        }
    }
}

private struct LaneBlock<Footer: View>: View {
    let title: String
    let level: Float
    let color: Color
    let active: Bool
    let footer: () -> Footer

    init(title: String, level: Float, color: Color, active: Bool,
         @ViewBuilder footer: @escaping () -> Footer = { EmptyView() }) {
        self.title = title
        self.level = level
        self.color = color
        self.active = active
        self.footer = footer
    }

    var body: some View {
        VStack(spacing: 8) {
            WaveformBar(level: level, color: color, active: active)
            HStack(spacing: 10) {
                Text(title)
                    .font(.system(size: 11, weight: .semibold).smallCaps())
                    .foregroundColor(.white.opacity(0.5))
                footer()
            }
        }
    }
}
