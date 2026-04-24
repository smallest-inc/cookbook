import SwiftUI

struct ErrorBanner: View {
    let error: SessionError?
    let onRetry: (() -> Void)?
    let onDismiss: () -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("AGENT REPORTED AN ERROR")
                .font(.system(size: 11, weight: .semibold).smallCaps())
                .foregroundColor(.red)
            Text(error?.message ?? "Unknown error.")
                .font(.callout)
                .foregroundColor(.white.opacity(0.85))
            HStack {
                Spacer()
                if let onRetry {
                    Button("Try again", action: onRetry)
                        .foregroundColor(.cyan)
                }
                Button("Dismiss", action: onDismiss)
                    .foregroundColor(.white.opacity(0.6))
            }
        }
        .padding()
        .overlay(RoundedRectangle(cornerRadius: 12).stroke(Color.red.opacity(0.4)))
        .padding(.horizontal)
    }
}
