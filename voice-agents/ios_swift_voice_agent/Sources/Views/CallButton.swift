import SwiftUI

struct CallButton: View {
    enum Variant { case primary, danger }
    let label: String
    let variant: Variant
    let onTap: () -> Void

    var body: some View {
        Button(action: onTap) {
            Text(label)
                .font(.system(size: 16, weight: .semibold))
                .foregroundColor(.black)
                .padding(.horizontal, 32)
                .padding(.vertical, 14)
                .background(
                    Capsule().fill(variant == .primary ? Color.orange : Color.red)
                )
        }
        .buttonStyle(.plain)
    }
}
