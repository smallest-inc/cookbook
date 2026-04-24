import SwiftUI

struct WaveformBar: View {
    private static let bars = 28
    private static let minHeight: CGFloat = 2
    private static let maxHeight: CGFloat = 48

    let level: Float     // 0..1
    let color: Color
    let active: Bool

    @State private var heights: [CGFloat] = Array(repeating: 2, count: WaveformBar.bars)

    var body: some View {
        HStack(spacing: 3) {
            ForEach(0..<Self.bars, id: \.self) { i in
                RoundedRectangle(cornerRadius: 1.5)
                    .fill(active ? color.opacity(0.9) : Color.white.opacity(0.15))
                    .frame(width: 3, height: heights[i])
            }
        }
        .frame(height: Self.maxHeight)
        .onChange(of: level) { _ in push(level) }
        .onChange(of: active) { _ in if !active { push(0) } }
    }

    private func push(_ value: Float) {
        let clamped = max(0, min(1, value * 3.2))
        let target = Self.minHeight + CGFloat(clamped) * (Self.maxHeight - Self.minHeight)
        withAnimation(.easeOut(duration: 0.08)) {
            heights.removeFirst()
            heights.append(target)
        }
    }
}
