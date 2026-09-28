import SwiftUI

struct ImpactScreen: View {
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
                        Image(systemName: "leaf.fill")
                            .font(.system(size: 34))
                            .foregroundStyle(FanStyle.teal)
                        Text("Your story starts here.")
                            .font(.system(size: 25, weight: .bold, design: .rounded))
                        Text("Your planting and journey estimates will appear here.")
                            .font(.subheadline)
                            .foregroundStyle(FanStyle.muted)
                    }
                    .padding(.vertical, 12)
                }

                HStack(spacing: 12) {
                    impactMetric("0", label: "JOURNEYS", symbol: "figure.walk")
                    impactMetric(String(format: "%.1f", demoState.totalEstimatedCarbonKg), label: "KG CO₂E EST.", symbol: "carbon.dioxide.cloud")
                }

                FeatureCard {
                    VStack(alignment: .leading, spacing: 9) {
                        Text("Together, we go further.")
                            .font(.title3.bold())
                        Text("Community journey estimates are coming soon.")
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
                        Text("Sourced team data, separate from fan estimates.")
                            .font(.subheadline)
                            .foregroundStyle(FanStyle.muted)
                    }
                }

                FanButton(title: "View activity history", symbol: "arrow.right") { open(.history) }
                    .padding(.bottom, 110)
            }
            .padding(.horizontal, 22)
            .frame(maxWidth: 520)
            .frame(maxWidth: .infinity)
        }
        .scrollIndicators(.hidden)
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
