import SwiftUI
import Charts

private struct ReportSeriesPoint: Identifiable {
    let year: String
    let tonnes: Double
    var id: String { year }
}

private struct ReportMetric: Identifiable {
    let label: String
    let value: String
    let detail: String
    let page: String
    var id: String { label }
}

private enum MakeAMarkReport2025 {
    // Static snapshot from the supplied Make A Mark ESG Report 2025.
    static let footprint = [
        ReportSeriesPoint(year: "2023", tonnes: 97_216.47),
        ReportSeriesPoint(year: "2024", tonnes: 87_300.62),
        ReportSeriesPoint(year: "2025", tonnes: 85_974.41)
    ]

    static let metrics = [
        ReportMetric(label: "Travel and logistics avoided", value: "1,188 tCO₂e", detail: "Reported reduction through logistics efficiency and Sustainable Aviation Fuel.", page: "p. 9"),
        ReportMetric(label: "Carbon removed", value: "2,124 tCO₂e", detail: "Reported carbon removal in 2025.", page: "p. 26"),
        ReportMetric(label: "Event energy reduction", value: "90%", detail: "Reduction in event energy emissions compared with previous setups.", page: "p. 37")
    ]
}

private struct ImpactLapView: View {
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @State private var progress: CGFloat = 0
    let estimatedKilograms: Double

    private var equivalentLaps: Double { estimatedKilograms / 11.6 }

    private let points: [CGPoint] = [
        CGPoint(x: 0.92, y: 0.62), CGPoint(x: 0.88, y: 0.24),
        CGPoint(x: 0.78, y: 0.13), CGPoint(x: 0.64, y: 0.20),
        CGPoint(x: 0.53, y: 0.12), CGPoint(x: 0.41, y: 0.28),
        CGPoint(x: 0.29, y: 0.20), CGPoint(x: 0.16, y: 0.40),
        CGPoint(x: 0.08, y: 0.60), CGPoint(x: 0.15, y: 0.78),
        CGPoint(x: 0.31, y: 0.86), CGPoint(x: 0.44, y: 0.66),
        CGPoint(x: 0.58, y: 0.78), CGPoint(x: 0.75, y: 0.72),
        CGPoint(x: 0.91, y: 0.81), CGPoint(x: 0.92, y: 0.62)
    ]

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack {
                Text("Your travel in laps")
                    .font(.headline)
                Spacer()
                Button("Replay", systemImage: "arrow.clockwise", action: replay)
                    .labelStyle(.titleAndIcon)
                    .font(.subheadline.weight(.semibold))
                    .accessibilityHint("Replays the lap animation")
            }

            GeometryReader { geometry in
                let route = routePath(in: geometry.size)
                let car = carPosition(in: geometry.size)

                ZStack {
                    route.stroke(FanStyle.muted.opacity(0.35), style: StrokeStyle(lineWidth: 9, lineCap: .round, lineJoin: .round))
                    route.trim(from: 0, to: progress)
                        .stroke(FanStyle.teal, style: StrokeStyle(lineWidth: 9, lineCap: .round, lineJoin: .round))
                    Image(systemName: "car.side.fill")
                        .font(.system(size: 18, weight: .bold))
                        .foregroundStyle(FanStyle.teal)
                        .position(car.point)
                        .rotationEffect(.radians(car.angle))
                }
            }
            .frame(height: 120)
            .accessibilityElement(children: .ignore)
            .accessibilityLabel("Circuit lap animation")
            .accessibilityValue(reduceMotion ? "Complete" : "Replay to watch your travel trace the circuit")

            Text("\(String(format: "%.1f", equivalentLaps)) Marina Bay laps · based on estimated travel savings")
                .font(.caption)
                .foregroundStyle(FanStyle.muted)
                .monospacedDigit()
        }
        .padding(14)
        .background(FanStyle.panel, in: RoundedRectangle(cornerRadius: 4))
        .onAppear(perform: play)
    }

    private func replay() {
        progress = 0
        play()
    }

    private func play() {
        guard !reduceMotion else {
            progress = 1
            return
        }
        withAnimation(.easeInOut(duration: 11.3)) {
            progress = 1
        }
    }

    private func routePath(in size: CGSize) -> Path {
        Path { path in
            guard let first = points.first else { return }
            path.move(to: CGPoint(x: first.x * size.width, y: first.y * size.height))
            for point in points.dropFirst() {
                path.addLine(to: CGPoint(x: point.x * size.width, y: point.y * size.height))
            }
        }
    }

    private func carPosition(in size: CGSize) -> (point: CGPoint, angle: Double) {
        let segments = Array(zip(points, points.dropFirst()))
        let scaledProgress = min(max(Double(progress), 0), 1) * Double(segments.count)
        let index = min(Int(scaledProgress), segments.count - 1)
        let fraction = CGFloat(scaledProgress - Double(index))
        let (start, end) = segments[index]
        let dx = (end.x - start.x) * size.width
        let dy = (end.y - start.y) * size.height
        return (
            CGPoint(x: (start.x + (end.x - start.x) * fraction) * size.width,
                    y: (start.y + (end.y - start.y) * fraction) * size.height),
            Double(atan2(dy, dx))
        )
    }
}

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

                ImpactLapView(estimatedKilograms: Double(impactSavings) ?? 0)

                FeatureCard {
                    VStack(alignment: .leading, spacing: 9) {
                        Text("Together, we go further.")
                            .font(.title3.bold())
                        Text(communityImpactDescription)
                            .font(.subheadline)
                            .foregroundStyle(FanStyle.muted)
                    }
                }

                reportSnapshotCard

                FeatureCard {
                    VStack(alignment: .leading, spacing: 10) {
                        Label("YOUR CONTRIBUTION", systemImage: "figure.walk")
                            .font(.caption.bold())
                            .foregroundStyle(FanStyle.teal)
                        Text("Estimated CO₂ avoided")
                            .font(.title3.bold())
                        Text("\(impactSavings) kg CO₂e")
                            .font(.system(size: 28, weight: .bold, design: .rounded))
                            .foregroundStyle(FanStyle.teal)
                        Text("Each qualifying journey uses the single-occupant car baseline of 0.1901 kg CO₂ per vehicle-kilometre. Your total uses recorded journey evidence, not points or rewards.")
                            .font(.subheadline)
                            .foregroundStyle(FanStyle.muted)
                        Text("Baseline source: CAG surface-access CO₂ v1. Personal values remain estimates and are separate from the team report.")
                            .font(.caption)
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

    private var reportSnapshotCard: some View {
        FeatureCard {
            VStack(alignment: .leading, spacing: 14) {
                Label("MAKE A MARK ESG REPORT 2025", systemImage: "doc.text")
                    .font(.caption.bold())
                    .foregroundStyle(FanStyle.teal)
                Text("Team report snapshot")
                    .font(.title3.bold())
                Text("Market-based footprint with SAFc")
                    .font(.subheadline)
                    .foregroundStyle(FanStyle.muted)
                Text("85,974 tCO₂e")
                    .font(.system(size: 32, weight: .bold, design: .rounded))
                Chart(MakeAMarkReport2025.footprint) { point in
                    LineMark(x: .value("Year", point.year), y: .value("tCO₂e", point.tonnes))
                        .foregroundStyle(FanStyle.teal)
                    PointMark(x: .value("Year", point.year), y: .value("tCO₂e", point.tonnes))
                        .foregroundStyle(FanStyle.teal)
                }
                .chartYScale(domain: 80_000...100_000)
                .chartYAxis { AxisMarks(position: .leading, values: [80_000, 90_000, 100_000]) }
                .frame(height: 150)
                Text("2023–2025 values from the report appendix, p. 83. The report notes that baseline methodology was revised, so year-on-year values need that context.")
                    .font(.caption)
                    .foregroundStyle(FanStyle.muted)
                ForEach(MakeAMarkReport2025.metrics) { metric in
                    VStack(alignment: .leading, spacing: 4) {
                        HStack(alignment: .firstTextBaseline) {
                            Text(metric.label).font(.subheadline.bold())
                            Spacer()
                            Text(metric.value).font(.subheadline.bold()).foregroundStyle(FanStyle.teal)
                        }
                        Text("\(metric.detail) Source: report \(metric.page).")
                            .font(.caption)
                            .foregroundStyle(FanStyle.muted)
                    }
                }
            }
        }
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
