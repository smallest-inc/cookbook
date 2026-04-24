import Foundation

/// Thin wrapper around the Atoms REST surface the app needs to update a live
/// agent's voice / speed / language. Full dance:
///   1. GET   /agent/{id}                       read current
///   2. GET   /agent/{id}/versions?limit=1       find source version
///   3. POST  /agent/{id}/drafts                 open draft
///   4. PATCH /agent/{id}/drafts/{d}/config      write new values
///   5. POST  /agent/{id}/drafts/{d}/publish     publish as new version
///   6. PATCH /agent/{id}/versions/{v}/activate  make it live
enum AtomsRest {
    private static let base = "https://api.smallest.ai/atoms/v1"

    struct AgentSnapshot {
        var name: String
        var voiceId: String
        var voiceModel: String
        var speed: Double
        var language: String
        var supportedLanguages: [String]
    }

    struct UpdateInput {
        var voiceId: String?
        var voiceModel: String?
        var speed: Double?
        var language: String?
    }

    enum RestError: Error {
        case http(status: Int, body: String)
        case parse
        case noSourceVersion
        case noDraftId
        case noVersionId
    }

    static func fetchAgent(apiKey: String, agentId: String) async throws -> AgentSnapshot {
        let json = try await request(method: "GET", path: "/agent/\(agentId)", apiKey: apiKey)
        let data = (json["data"] as? [String: Any]) ?? json
        let synth = (data["synthesizer"] as? [String: Any]) ?? [:]
        let voiceConfig = (synth["voiceConfig"] as? [String: Any]) ?? [:]
        let language = (data["language"] as? [String: Any]) ?? [:]
        return AgentSnapshot(
            name: (data["name"] as? String) ?? "",
            voiceId: (voiceConfig["voiceId"] as? String) ?? "",
            voiceModel: (voiceConfig["model"] as? String) ?? "waves_lightning_v3_1",
            speed: (synth["speed"] as? Double) ?? 1.0,
            language: (language["default"] as? String) ?? "en",
            supportedLanguages: (language["supported"] as? [String]) ?? ["en"]
        )
    }

    @discardableResult
    static func updateAgentConfig(apiKey: String, agentId: String,
                                  current: AgentSnapshot, patch: UpdateInput) async throws -> String {
        let versionsJson = try await request(method: "GET",
                                             path: "/agent/\(agentId)/versions?limit=1",
                                             apiKey: apiKey)
        let versionsData = (versionsJson["data"] as? [String: Any]) ?? versionsJson
        let versions = (versionsData["versions"] as? [[String: Any]]) ?? []
        guard let sourceVersion = versions.first?["_id"] as? String else {
            throw RestError.noSourceVersion
        }

        let draftJson = try await request(
            method: "POST",
            path: "/agent/\(agentId)/drafts",
            apiKey: apiKey,
            body: [
                "draftName": "live-config-\(Int(Date().timeIntervalSince1970))",
                "sourceVersionId": sourceVersion,
            ]
        )
        let draftData = (draftJson["data"] as? [String: Any]) ?? draftJson
        guard let draftId = draftData["draftId"] as? String else { throw RestError.noDraftId }

        let nextVoiceId     = patch.voiceId    ?? current.voiceId
        let nextVoiceModel  = patch.voiceModel ?? current.voiceModel
        let nextSpeed       = patch.speed      ?? current.speed
        let nextLanguage    = patch.language   ?? current.language

        var supported = current.supportedLanguages
        if !supported.contains(nextLanguage) { supported.append(nextLanguage) }

        let configBody: [String: Any] = [
            "language": [
                "default":   nextLanguage,
                "supported": supported,
                "switching": ["isEnabled": false],
            ],
            "synthesizer": [
                "voiceConfig": ["model": nextVoiceModel, "voiceId": nextVoiceId],
                "speed":       nextSpeed,
            ],
        ]
        _ = try await request(method: "PATCH",
                              path: "/agent/\(agentId)/drafts/\(draftId)/config",
                              apiKey: apiKey,
                              body: configBody)

        let publishJson = try await request(
            method: "POST",
            path: "/agent/\(agentId)/drafts/\(draftId)/publish",
            apiKey: apiKey,
            body: ["label": "ios-\(Int(Date().timeIntervalSince1970))"]
        )
        let publishData = (publishJson["data"] as? [String: Any]) ?? publishJson
        guard let newVersion = publishData["_id"] as? String else { throw RestError.noVersionId }

        _ = try await request(method: "PATCH",
                              path: "/agent/\(agentId)/versions/\(newVersion)/activate",
                              apiKey: apiKey)
        return newVersion
    }

    // MARK: - Private

    private static func request(method: String, path: String, apiKey: String,
                                body: [String: Any]? = nil) async throws -> [String: Any] {
        guard let url = URL(string: base + path) else { throw RestError.parse }
        var req = URLRequest(url: url)
        req.httpMethod = method
        req.addValue("Bearer \(apiKey)", forHTTPHeaderField: "Authorization")
        req.addValue("application/json", forHTTPHeaderField: "Content-Type")
        req.addValue("application/json", forHTTPHeaderField: "Accept")
        if let body {
            req.httpBody = try JSONSerialization.data(withJSONObject: body)
        }
        let (data, response) = try await URLSession.shared.data(for: req)
        let status = (response as? HTTPURLResponse)?.statusCode ?? 0
        guard (200..<300).contains(status) else {
            throw RestError.http(status: status, body: String(data: data, encoding: .utf8) ?? "")
        }
        if data.isEmpty { return [:] }
        guard let json = try JSONSerialization.jsonObject(with: data) as? [String: Any] else {
            throw RestError.parse
        }
        return json
    }
}
