import SwiftUI

struct ImpactScreen: View {
    @EnvironmentObject private var backend: BackendSession
    let demoState: DemoFanState
    let open: (FanDestination) -> Void

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 20) {
                SectionHeader(title: "Impact.",
                              description: "Your journeys. Your difference.")
                    .padding(.top, 30)

                FeatureCard {
                    VStack(alignment: .leading, spacing: 15) {
                        Label(backend.impact == nil ? "DEMO DATA" : "BACKEND DATA", systemImage: "info.circle")
                            .font(.caption.bold())
                            .foregroundStyle(FanStyle.teal)
                        Image(systemName: "leaf.fill")
                            .font(.system(size: 34))
                            .foregroundStyle(FanStyle.teal)
                        Text(backend.impact == nil && demoState.plantedTrees.isEmpty ? "Your story starts here." : "Your impact is taking shape.")
                            .font(.system(size: 25, weight: .bold, design: .rounded))
                        Text("Verified journeys, Green Points activity, and plantings are separate from community and official AMR figures.")
                            .font(.subheadline)
                            .foregroundStyle(FanStyle.muted)
                    }
                    .padding(.vertical, 12)
                }

                HStack(spacing: 12) {
                    impactMetric(impactJourneyCount, label: "VERIFIED JOURNEYS", symbol: "figure.walk")
                    impactMetric(impactSavings, label: "KG CO₂E EST.", symbol: "carbon.dioxide.cloud")
                }

                FeatureCard {
                    VStack(alignment: .leading, spacing: 9) {
                        Text("Together, we go further.")
                            .font(.title3.bold())
                        Text(communityImpactDescription)
                            .font(.subheadline)
                            .foregroundStyle(FanStyle.muted)
                    }
                }

                FeatureCard {
                    VStack(alignment: .leading, spacing: 9) {
                        Label("TEAM REPORTS", systemImage: "doc.text")
                            .font(.caption.bold())
                            .foregroundStyle(FanStyle.teal)
                        Text("Official team figures")
                            .font(.title3.bold())
                        Text(officialDescription)
                            .font(.subheadline)
                            .foregroundStyle(FanStyle.muted)
                    }
                }

                FanButton(title: "View digital forest", symbol: "tree.fill") { open(.tree) }
                    .padding(.bottom, 110)
            }
            .padding(.horizontal, 22)
            .frame(maxWidth: 520)
            .frame(maxWidth: .infinity)
        }
        .scrollIndicators(.hidden)
        .task { await backend.loadImpact() }
    }

    private var impactJourneyCount: String {
        guard let total = backend.impact?.personal else { return "Unavailable" }
        return total.kind == "available" ? "\(total.journeyCount ?? 0)" : "Unavailable"
    }

    private var impactSavings: String {
        if let value = backend.impact?.personal.savingsKg, let number = Double(value) { return String(format: "%.1f", number) }
        if backend.isConnected { return "Unavailable" }
        return String(format: "%.1f", demoState.totalEstimatedCarbonKg)
    }

    private var communityImpactDescription: String {
        guard let total = backend.impact?.community else { return "Community totals are unavailable until an account is connected." }
        if total.kind == "available", let count = total.journeyCount { return "Community travel totals include \(count) qualifying journeys." }
        return "Community travel totals are unavailable: \((total.reasons ?? ["source unavailable"]).joined(separator: ", "))."
    }

    private var officialDescription: String {
        guard let impact = backend.impact else { return "Official AMR ESG figures will appear after admin report approval." }
        return impact.officialStatus == "available" ? "Official AMR ESG figures are available from approved reports." : "Official AMR ESG figures are unavailable until an approved report is published."
    }

    private func impactMetric(_ value: String, label: String, symbol: String) -> some View {
        FeatureCard {
            VStack(alignment: .leading, spacing: 9) {
                Image(systemName: symbol).foregroundStyle(FanStyle.teal)
                Text(value).font(.system(size: 38, weight: .bold, design: .rounded))
                Text(label).font(.system(size: 10, weight: .bold)).tracking(1)
                    .foregroundStyle(FanStyle.muted)
            }
        }
    }
}
