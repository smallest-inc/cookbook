import Foundation

enum SessionStatus: Equatable {
    case idle
    case connecting
    case joined
    case listening
    case narrating
    case error(String)

    var label: String {
        switch self {
        case .idle:         return "ready"
        case .connecting:   return "connecting"
        case .joined:       return "narrator joined"
        case .listening:    return "listening"
        case .narrating:    return "narrator speaking"
        case .error:        return "error"
        }
    }

    var inSession: Bool {
        switch self {
        case .idle, .error: return false
        default:            return true
        }
    }
}

struct SessionError: Equatable {
    enum Kind { case permission, missingConfig, network, auth, server, unknown }
    let kind: Kind
    let message: String
    let retryable: Bool
}
