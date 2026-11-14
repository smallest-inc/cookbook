import Foundation

/// Thin wrapper around the Atoms REST surface the app needs to update a live
/// agent's voice / speed / language. Full dance (v2 branches flow):
///   1. GET  /agent/{id}                              read current
///   2. GET  /agent/{id}/branches                     find the live branch
///   3. PUT  /agent/{id}/branches/{b}/draft           write new values into the open draft
///   4. POST /agent/{id}/branches/{b}/draft/publish   publish; the revision goes live
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
        case noBranch
        case noRevisionId
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
        let branchesJson = try await request(method: "GET",
                                             path: "/agent/\(agentId)/branches",
                                             apiKey: apiKey)
        let branchesData = (branchesJson["data"] as? [String: Any]) ?? branchesJson
        let branches = (branchesData["branches"] as? [[String: Any]]) ?? []
        // Pick the live branch; fall back to the default branch, then the first.
        let entry = branches.first { (($0["isLive"] ?? $0["is_live"]) as? Bool) == true }
            ?? branches.first { ((($0["branch"] as? [String: Any])?["isDefault"] ?? ($0["branch"] as? [String: Any])?["is_default"]) as? Bool) == true }
            ?? branches.first
        let branchObj = entry?["branch"] as? [String: Any]
        guard let branchId = (branchObj?["_id"] ?? branchObj?["id"]) as? String else {
            throw RestError.noBranch
        }

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
        // PUT creates the branch's open draft when there is none, otherwise
        // updates it in place.
        _ = try await request(method: "PUT",
                              path: "/agent/\(agentId)/branches/\(branchId)/draft",
                              apiKey: apiKey,
                              body: configBody)

        // Publishing the draft makes the new revision live; no activate step in v2.
        let publishJson = try await request(
            method: "POST",
            path: "/agent/\(agentId)/branches/\(branchId)/draft/publish",
            apiKey: apiKey,
            body: ["label": "ios-\(Int(Date().timeIntervalSince1970))"]
        )
        let publishData = (publishJson["data"] as? [String: Any]) ?? publishJson
        if let newRevision = (publishData["_id"] as? String) ?? (publishData["id"] as? String) {
            return newRevision
        }
        // Publishing runs an async security scan; poll until the draft closes.
        if publishData["state"] != nil {
            for _ in 0..<60 {
                try await Task.sleep(nanoseconds: 2_000_000_000)
                let branchJson = try await request(method: "GET",
                                                   path: "/agent/\(agentId)/branches/\(branchId)",
                                                   apiKey: apiKey)
                let data = (branchJson["data"] as? [String: Any]) ?? branchJson
                let branch = (data["branch"] as? [String: Any]) ?? data
                if branch["openDraftId"] == nil || branch["openDraftId"] is NSNull {
                    return (branch["headRevisionId"] as? String) ?? "published"
                }
            }
        }
        throw RestError.noRevisionId
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
