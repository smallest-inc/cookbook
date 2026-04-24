import Foundation

/// Wraps URLSessionWebSocketTask with auth-aware reconnect and a typed event
/// callback. The event path runs off the URLSession delegate queue, so
/// consumers must hop to MainActor for UI updates.
final class AtomsClient: NSObject {
    struct Config {
        let apiKey: String
        let agentId: String
        let sampleRate: Int
        let onOpen:   () -> Void
        let onEvent:  (ServerEvent) -> Void
        let onClose:  (Int, String) -> Void
        let onFatalError: (SessionError) -> Void
    }

    enum ServerEvent {
        case sessionCreated(sessionId: String, callId: String)
        case outputAudioDelta(base64: String)
        case agentStartTalking
        case agentStopTalking
        case interruption
        case sessionClosed(reason: String?)
        case error(code: String, message: String)
        case unknown
    }

    private let config: Config
    private var task: URLSessionWebSocketTask?
    private var explicitlyClosed = false
    private var reconnectAttempt = 0
    private let backoffMillis = [500, 1_000, 2_000, 5_000, 15_000]
    private let maxReconnects = 5

    init(config: Config) {
        self.config = config
    }

    func start() {
        explicitlyClosed = false
        connect()
    }

    func sendMicChunk(_ base64Int16LE: String) {
        guard let task, task.state == .running else { return }
        let payload: [String: Any] = [
            "type":  "input_audio_buffer.append",
            "audio": base64Int16LE,
        ]
        guard let data = try? JSONSerialization.data(withJSONObject: payload) else { return }
        task.send(.data(data)) { _ in }
    }

    func close(reason: String = "client stop") {
        explicitlyClosed = true
        task?.cancel(with: .normalClosure, reason: reason.data(using: .utf8))
        task = nil
    }

    // MARK: - Private

    private func connect() {
        guard var components = URLComponents(string: "wss://api.smallest.ai/atoms/v1/agent/connect") else { return }
        components.queryItems = [
            URLQueryItem(name: "token",       value: config.apiKey),
            URLQueryItem(name: "agent_id",    value: config.agentId),
            URLQueryItem(name: "mode",        value: "webcall"),
            URLQueryItem(name: "sample_rate", value: String(config.sampleRate)),
        ]
        guard let url = components.url else { return }

        let session = URLSession(configuration: .default, delegate: self, delegateQueue: nil)
        task = session.webSocketTask(with: url)
        task?.resume()
        config.onOpen()
        listen()
    }

    private func listen() {
        task?.receive { [weak self] result in
            guard let self else { return }
            switch result {
            case .success(let message):
                switch message {
                case .string(let text):
                    self.dispatchText(text)
                case .data(let data):
                    if let text = String(data: data, encoding: .utf8) { self.dispatchText(text) }
                @unknown default:
                    break
                }
                self.listen()
            case .failure(let error):
                self.onFailure(error)
            }
        }
    }

    private func dispatchText(_ text: String) {
        guard
            let data = text.data(using: .utf8),
            let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
            let type = json["type"] as? String
        else { return }

        switch type {
        case "session.created":
            let sid = (json["session_id"] as? String) ?? ""
            let cid = (json["call_id"] as? String) ?? ""
            config.onEvent(.sessionCreated(sessionId: sid, callId: cid))
        case "output_audio.delta":
            if let b64 = json["audio"] as? String { config.onEvent(.outputAudioDelta(base64: b64)) }
        case "agent_start_talking":
            config.onEvent(.agentStartTalking)
        case "agent_stop_talking":
            config.onEvent(.agentStopTalking)
        case "interruption":
            config.onEvent(.interruption)
        case "session.closed":
            config.onEvent(.sessionClosed(reason: json["reason"] as? String))
        case "error":
            let code = (json["code"] as? String) ?? ""
            let msg  = (json["message"] as? String) ?? ""
            config.onEvent(.error(code: code, message: msg))
        default:
            config.onEvent(.unknown)
        }
    }

    private func onFailure(_ error: Error) {
        let urlError = error as? URLError
        let code = urlError?.code.rawValue ?? -1
        let wasClean = false
        config.onClose(code, urlError?.localizedDescription ?? "\(error)")

        if explicitlyClosed || wasClean { return }

        // Auth failures do not flow through URLError; the server emits an
        // `error` event before closing. Transient network errors retry.
        if reconnectAttempt >= maxReconnects {
            config.onFatalError(.init(kind: .network,
                                      message: "reconnect gave up after \(maxReconnects) attempts",
                                      retryable: true))
            return
        }
        let delay = backoffMillis[min(reconnectAttempt, backoffMillis.count - 1)]
        reconnectAttempt += 1
        DispatchQueue.global().asyncAfter(deadline: .now() + .milliseconds(delay)) { [weak self] in
            self?.connect()
        }
    }
}

extension AtomsClient: URLSessionWebSocketDelegate {
    func urlSession(_ session: URLSession,
                    webSocketTask: URLSessionWebSocketTask,
                    didOpenWithProtocol protocol: String?) {
        reconnectAttempt = 0
    }

    func urlSession(_ session: URLSession,
                    webSocketTask: URLSessionWebSocketTask,
                    didCloseWith closeCode: URLSessionWebSocketTask.CloseCode,
                    reason: Data?) {
        let reasonText = reason.flatMap { String(data: $0, encoding: .utf8) } ?? ""
        config.onClose(closeCode.rawValue, reasonText)
    }
}
