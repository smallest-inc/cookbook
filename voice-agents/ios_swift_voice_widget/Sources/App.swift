import SwiftUI

@main
struct AtomsVoiceWidgetApp: App {
    // Paste your Smallest API key + agent id here for the demo. In a real
    // app pull these from a secure settings store — do not ship API keys
    // inside a binary.
    private let apiKey  = ProcessInfo.processInfo.environment["ATOMS_API_KEY"] ?? ""
    private let agentId = ProcessInfo.processInfo.environment["ATOMS_AGENT_ID"] ?? ""

    var body: some Scene {
        WindowGroup {
            ZStack {
                BrandColors.surface.ignoresSafeArea()
                HostDashboard()
                // Widget is a sibling of the host content; its floating pill is
                // absolutely positioned so host gestures still register.
                AtomsWidget(apiKey: apiKey, agentId: agentId, label: "Ask AI")
            }
            .preferredColorScheme(.light)
        }
    }
}

struct HostDashboard: View {
    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 24) {
                HeaderRow()
                SectionBlock(title: "TODAY · 24 APR") {
                    AppointmentRow(time: "09:00", name: "Ada Lovelace",
                                   reason: "Annual checkup", status: "Checked in")
                    AppointmentRow(time: "09:30", name: "Grace Hopper",
                                   reason: "Blood work review", status: "Arrived",
                                   highlighted: true)
                    AppointmentRow(time: "10:15", name: "Alan Turing",
                                   reason: "Cardiology follow-up", status: "Pending")
                    AppointmentRow(time: "11:00", name: "Marie Curie",
                                   reason: "Lab results", status: "Pending")
                }
                SectionBlock(title: "QUICK LINKS") {
                    LinkRow(icon: "calendar", title: "Full calendar")
                    LinkRow(icon: "person.2", title: "Patient directory")
                    LinkRow(icon: "chart.bar", title: "Today's metrics")
                    LinkRow(icon: "gearshape", title: "Settings")
                }
                Spacer().frame(height: 140)
            }
            .padding(.horizontal, 20)
            .padding(.vertical, 24)
        }
    }
}

private struct HeaderRow: View {
    var body: some View {
        HStack(alignment: .top) {
            VStack(alignment: .leading, spacing: 4) {
                Text("MYCLINIC · RECEPTION")
                    .font(.system(size: 11, weight: .semibold))
                    .foregroundColor(BrandColors.textMuted)
                    .kerning(1)
                Text("Good morning, Dr. Rao")
                    .font(.system(size: 22, weight: .medium))
                    .foregroundColor(BrandColors.ink)
            }
            Spacer()
            ZStack {
                Circle().fill(BrandColors.tealSoft).frame(width: 40, height: 40)
                Text("SR").font(.system(size: 13, weight: .semibold)).foregroundColor(BrandColors.teal)
            }
        }
    }
}

private struct SectionBlock<Content: View>: View {
    let title: String
    @ViewBuilder let content: () -> Content
    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            Text(title)
                .font(.system(size: 11, weight: .semibold))
                .foregroundColor(BrandColors.textMuted)
                .kerning(1)
            content()
        }
    }
}

private struct AppointmentRow: View {
    let time: String
    let name: String
    let reason: String
    let status: String
    var highlighted: Bool = false

    var body: some View {
        HStack(spacing: 14) {
            Text(time)
                .font(.system(size: 15, weight: .semibold))
                .foregroundColor(BrandColors.ink)
                .frame(width: 54, alignment: .leading)
            VStack(alignment: .leading, spacing: 2) {
                Text(name).font(.system(size: 15, weight: .semibold)).foregroundColor(BrandColors.ink)
                Text(reason).font(.system(size: 12)).foregroundColor(BrandColors.textMuted)
            }
            Spacer()
            Text(status)
                .font(.system(size: 11, weight: .medium))
                .foregroundColor(BrandColors.textSecondary)
                .padding(.horizontal, 10).padding(.vertical, 4)
                .background(Capsule().fill(highlighted ? BrandColors.gold : BrandColors.surface))
        }
        .padding(.horizontal, 16).padding(.vertical, 14)
        .background(RoundedRectangle(cornerRadius: 14)
            .fill(highlighted ? BrandColors.tealSoft : BrandColors.surfaceHighlight))
        .overlay(RoundedRectangle(cornerRadius: 14)
            .stroke(highlighted ? BrandColors.teal : BrandColors.divider, lineWidth: 0.5))
    }
}

private struct LinkRow: View {
    let icon: String
    let title: String
    var body: some View {
        HStack(spacing: 12) {
            Image(systemName: icon)
                .font(.system(size: 16, weight: .semibold))
                .foregroundColor(BrandColors.inkSoft)
                .frame(width: 28)
            Text(title).font(.system(size: 15, weight: .semibold)).foregroundColor(BrandColors.ink)
            Spacer()
            Image(systemName: "chevron.right")
                .font(.system(size: 14, weight: .semibold))
                .foregroundColor(BrandColors.textMuted)
        }
        .padding(.horizontal, 16).padding(.vertical, 14)
        .background(RoundedRectangle(cornerRadius: 12).fill(BrandColors.surfaceHighlight))
        .overlay(RoundedRectangle(cornerRadius: 12).stroke(BrandColors.divider, lineWidth: 0.5))
    }
}
