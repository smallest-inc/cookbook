import SwiftUI

/// Agent config picker. Mirrors the React Native cookbook's settings sheet.
/// Runs the full 5-step draft → publish → activate REST flow on Apply.
struct SettingsSheet: View {
    @Binding var isPresented: Bool
    let apiKey: String
    let agentId: String

    @State private var snapshot: AtomsRest.AgentSnapshot?
    @State private var voiceId: String = ""
    @State private var speed: Double = 1.0
    @State private var language: String = "en"
    @State private var loading = true
    @State private var applying = false
    @State private var errorText: String?
    @State private var appliedOK = false

    private let voices: [(id: String, label: String)] = [
        ("magnus", "Magnus (warm British male)"),
        ("daniel", "Daniel (neutral male)"),
        ("emily",  "Emily (friendly female)"),
        ("sophia", "Sophia (professional female)"),
        ("arjun",  "Arjun (Indian English male)"),
        ("priya",  "Priya (Indian English female)"),
    ]
    private let speeds: [Double] = [0.85, 1.0, 1.15, 1.3]
    private let languages: [(code: String, label: String)] = [
        ("en",    "English"),
        ("hi",    "Hindi"),
        ("multi", "Multi (auto-detect)"),
    ]

    private var dirty: Bool {
        guard let s = snapshot else { return false }
        return voiceId != s.voiceId || speed != s.speed || language != s.language
    }

    var body: some View {
        NavigationStack {
            Group {
                if loading {
                    ProgressView("Loading current config…").foregroundColor(.white)
                } else if let snapshot {
                    ScrollView {
                        VStack(alignment: .leading, spacing: 20) {
                            Text(snapshot.name)
                                .font(.footnote)
                                .foregroundColor(.white.opacity(0.6))

                            Section(title: "Voice") {
                                ChipRow(options: voices.map { ($0.id, $0.label) },
                                        selection: $voiceId)
                                if !voices.contains(where: { $0.id == voiceId }) {
                                    Text("custom: \(voiceId)")
                                        .font(.footnote)
                                        .foregroundColor(.cyan)
                                }
                            }

                            Section(title: "Speed") {
                                ChipRow(options: speeds.map { (String($0), String(format: "%.2f×", $0)) },
                                        selection: Binding(
                                            get: { String(speed) },
                                            set: { speed = Double($0) ?? 1.0 }
                                        ))
                            }

                            Section(title: "Language") {
                                ChipRow(options: languages.map { ($0.code, $0.label) },
                                        selection: $language)
                            }

                            if let errorText {
                                Text(errorText).font(.caption).foregroundColor(.red)
                            }
                            if appliedOK {
                                Text("Saved. End the current session and begin again to hear the new config.")
                                    .font(.caption).foregroundColor(.cyan)
                            }

                            Button(action: apply) {
                                HStack {
                                    Spacer()
                                    if applying {
                                        ProgressView().tint(.black)
                                    } else {
                                        Text(dirty ? "Apply & publish" : "No changes")
                                            .fontWeight(.semibold)
                                            .foregroundColor(.black)
                                    }
                                    Spacer()
                                }
                                .padding(.vertical, 14)
                                .background(Capsule().fill(Color.orange.opacity((dirty && !applying) ? 1 : 0.4)))
                            }
                            .disabled(!dirty || applying)
                        }
                        .padding()
                    }
                } else if let errorText {
                    VStack(spacing: 12) {
                        Text(errorText).foregroundColor(.red)
                        Button("Close") { isPresented = false }
                    }
                }
            }
            .navigationTitle("Agent Settings")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Close") { isPresented = false }
                }
            }
            .task { await load() }
        }
        .preferredColorScheme(.dark)
    }

    // MARK: - Actions

    private func load() async {
        guard !apiKey.isEmpty, !agentId.isEmpty else {
            errorText = "Missing API key or agent id."
            loading = false
            return
        }
        loading = true
        appliedOK = false
        errorText = nil
        do {
            let s = try await AtomsRest.fetchAgent(apiKey: apiKey, agentId: agentId)
            self.snapshot = s
            self.voiceId = s.voiceId
            self.speed = s.speed
            self.language = s.language
        } catch {
            errorText = String(describing: error).prefix(240).description
        }
        loading = false
    }

    private func apply() {
        guard let snapshot, dirty else { return }
        applying = true
        errorText = nil
        appliedOK = false
        Task {
            do {
                _ = try await AtomsRest.updateAgentConfig(
                    apiKey: apiKey, agentId: agentId, current: snapshot,
                    patch: .init(voiceId: voiceId,
                                 voiceModel: nil,
                                 speed: speed,
                                 language: language)
                )
                self.snapshot = AtomsRest.AgentSnapshot(
                    name: snapshot.name,
                    voiceId: voiceId,
                    voiceModel: snapshot.voiceModel,
                    speed: speed,
                    language: language,
                    supportedLanguages: snapshot.supportedLanguages
                )
                appliedOK = true
            } catch {
                errorText = String(describing: error).prefix(240).description
            }
            applying = false
        }
    }
}

private struct Section<Content: View>: View {
    let title: String
    let content: () -> Content
    init(title: String, @ViewBuilder content: @escaping () -> Content) {
        self.title = title; self.content = content
    }
    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            Text(title)
                .font(.system(size: 11, weight: .semibold).smallCaps())
                .foregroundColor(.white.opacity(0.5))
            content()
        }
    }
}

private struct ChipRow: View {
    let options: [(id: String, label: String)]
    @Binding var selection: String
    var body: some View {
        let rows = [GridItem(.adaptive(minimum: 90), spacing: 8)]
        LazyVGrid(columns: rows, alignment: .leading, spacing: 8) {
            ForEach(options, id: \.id) { opt in
                let selected = opt.id == selection
                Button(action: { selection = opt.id }) {
                    Text(opt.label)
                        .font(.footnote.weight(selected ? .semibold : .regular))
                        .foregroundColor(selected ? .black : .white)
                        .padding(.horizontal, 12).padding(.vertical, 8)
                        .background(Capsule().fill(selected ? Color.cyan : Color.clear))
                        .overlay(Capsule().stroke(selected ? Color.cyan : Color.white.opacity(0.15)))
                }
                .buttonStyle(.plain)
            }
        }
    }
}
