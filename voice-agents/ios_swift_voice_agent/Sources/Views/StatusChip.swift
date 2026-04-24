import SwiftUI

struct StatusChip: View {
    let status: SessionStatus

    private var dotColor: Color {
        switch status {
        case .idle:         return Color.white.opacity(0.3)
        case .connecting:   return .orange
        case .joined, .listening: return .cyan
        case .narrating:    return .orange
        case .error:        return .red
        }
    }

    var body: some View {
        HStack(spacing: 8) {
            Circle().fill(dotColor).frame(width: 8, height: 8)
            Text(status.label)
                .font(.system(size: 11, weight: .semibold).smallCaps())
                .foregroundColor(.white)
        }
        .padding(.horizontal, 14).padding(.vertical, 8)
        .overlay(Capsule().stroke(Color.white.opacity(0.15)))
    }
}
