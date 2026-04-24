import AVFoundation
import Foundation
import Combine

@MainActor
final class SessionViewModel: ObservableObject {
    private let sampleRate: Double = 24_000

    @Published var status: SessionStatus = .idle
    @Published var error: SessionError?
    @Published var micLevel: Float = 0
    @Published var agentLevel: Float = 0
    @Published var micChunksSent: Int = 0
    @Published var muted: Bool = false

    private var client: AtomsClient?
    private var audioEngine: AudioEngine?

    private var apiKey: String = ""
    private var agentId: String = ""

    init() {
        self.apiKey  = Self.env("ATOMS_API_KEY")  ?? Self.env("SMALLEST_API_KEY") ?? ""
        self.agentId = Self.env("ATOMS_AGENT_ID") ?? Self.env("AGENT_ID") ?? ""
    }

    /// Widget entry point. Accepts creds as arguments so the consumer can
    /// pass them through props; falls back to the init-time environment
    /// lookup for the standalone reference-app path.
    func start(apiKey: String, agentId: String) async {
        self.apiKey = apiKey
        self.agentId = agentId
        await start()
    }

    func start() async {
        guard !apiKey.isEmpty, !agentId.isEmpty else {
            fail(.init(kind: .missingConfig,
                       message: "Set ATOMS_API_KEY and ATOMS_AGENT_ID in the Xcode scheme's environment variables.",
                       retryable: false))
            return
        }

        self.error = nil
        status = .connecting

        let granted = await Self.requestMicPermission()
        guard granted else {
            fail(.init(kind: .permission,
                       message: "Microphone permission denied.",
                       retryable: false))
            return
        }

        let engine = AudioEngine(options: .init(
            sampleRate: sampleRate,
            onChunk: { [weak self] b64, level in
                Task { @MainActor in
                    self?.client?.sendMicChunk(b64)
                    self?.micLevel = level
                    self?.micChunksSent += 1
                }
            },
            onError: { [weak self] message in
                Task { @MainActor in
                    self?.fail(.init(kind: .unknown, message: message, retryable: true))
                }
            }
        ))

        do {
            try engine.configureSession()
            try engine.start()
        } catch {
            fail(.init(kind: .unknown, message: "audio setup failed: \(error)", retryable: true))
            return
        }
        audioEngine = engine

        let client = AtomsClient(config: .init(
            apiKey: apiKey, agentId: agentId, sampleRate: Int(sampleRate),
            onOpen: {},
            onEvent: { [weak self] event in
                Task { @MainActor in self?.handleEvent(event) }
            },
            onClose: { [weak self] _, _ in
                Task { @MainActor in
                    // Engine handles its own teardown on VM.stop()
                    _ = self
                }
            },
            onFatalError: { [weak self] err in
                Task { @MainActor in self?.fail(err) }
            }
        ))
        self.client = client
        client.start()
    }

    func stop() {
        audioEngine?.stop()
        audioEngine = nil
        client?.close()
        client = nil
        micLevel = 0
        agentLevel = 0
        micChunksSent = 0
        muted = false
        status = .idle
    }

    func toggleMute() {
        muted.toggle()
        audioEngine?.setMuted(muted)
        if muted { micLevel = 0 }
    }

    // MARK: - Server events

    private func handleEvent(_ event: AtomsClient.ServerEvent) {
        switch event {
        case .sessionCreated:
            status = .joined
        case .outputAudioDelta(let b64):
            audioEngine?.enqueueBase64(b64)
            agentLevel = Self.rmsBase64(b64)
        case .agentStartTalking:
            status = .narrating
        case .agentStopTalking:
            status = .listening
            agentLevel = 0
        case .interruption:
            audioEngine?.flushPlayback()
            agentLevel = 0
        case .sessionClosed:
            stop()
        case .error(let code, let message):
            fail(.init(kind: .server,
                       message: "\(code): \(message)",
                       retryable: false))
        case .unknown:
            break
        }
    }

    private func fail(_ err: SessionError) {
        audioEngine?.stop()
        audioEngine = nil
        client?.close()
        client = nil
        error = err
        status = .error(err.message)
    }

    // MARK: - Helpers

    private static func env(_ name: String) -> String? {
        guard let v = ProcessInfo.processInfo.environment[name], !v.isEmpty else { return nil }
        return v
    }

    private static func requestMicPermission() async -> Bool {
        await withCheckedContinuation { cont in
            if #available(iOS 17, *) {
                AVAudioApplication.requestRecordPermission { cont.resume(returning: $0) }
            } else {
                AVAudioSession.sharedInstance().requestRecordPermission { cont.resume(returning: $0) }
            }
        }
    }

    private static func rmsBase64(_ b64: String) -> Float {
        guard let data = Data(base64Encoded: b64), data.count >= 2 else { return 0 }
        let count = data.count / MemoryLayout<Int16>.size
        guard count > 0 else { return 0 }
        return data.withUnsafeBytes { raw -> Float in
            guard let src = raw.bindMemory(to: Int16.self).baseAddress else { return 0 }
            var sum: Float = 0
            for i in 0..<count {
                let s = Float(src[i]) / 32768.0
                sum += s * s
            }
            return sqrtf(sum / Float(count))
        }
    }

    // MARK: - Config surface for settings sheet

    var apiKeyReadonly: String { apiKey }
    var agentIdReadonly: String { agentId }
}
