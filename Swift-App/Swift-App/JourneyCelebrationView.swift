import SwiftUI

/// Demo rewards shown after "Start navigation". The phone app calculates and
/// displays these values. It writes nothing to the journey or points ledger,
/// because awarding a journey needs validated start and arrival evidence.
enum JourneyCelebrationRewards {
    static let pointsPerKilogram = 10
    static let maximumPoints = 2000
    /// Accepted comparison for this demo: one lap of the Marina Bay Street
    /// Circuit is treated as 7 kg CO₂e for a Formula One car. This is a display
    /// constant, not a server calculation.
    static let kilogramsPerMarinaBayLap = 7.0

    static func points(savedKg: Double) -> Int {
        min(maximumPoints, Int((max(0, savedKg) * Double(pointsPerKilogram)).rounded()))
    }

    static func laps(savedKg: Double) -> Double {
        max(0, savedKg) / kilogramsPerMarinaBayLap
    }
}

/// What the celebration reports. A nil `savedKg` means no comparable car
/// baseline was available, so the summary says so instead of claiming a saving.
struct JourneyCelebrationSummary: Equatable {
    let points: Int
    let savedKg: Double?
    let routeTitle: String
}

/// Party-popper burst, then the race car crossing behind a green wipe, then the
/// reward summary on the green field. Reduce Motion skips straight to the
/// summary.
struct JourneyCelebrationView: View {
    let summary: JourneyCelebrationSummary
    let reduceMotion: Bool
    let continueAction: () -> Void

    private enum Phase { case burst, carRun, summary }

    @State private var phase: Phase = .burst
    @State private var burstProgress: CGFloat = 0
    @State private var carProgress: CGFloat = 0
    @State private var summaryVisible = false

    var body: some View {
        GeometryReader { geometry in
            ZStack {
                FanStyle.background

                if phase == .burst || phase == .carRun {
                    ConfettiBurst(progress: burstProgress)
                }
                if phase == .carRun {
                    CelebrationCarRun(progress: carProgress, size: geometry.size)
                }
                if phase == .summary {
                    summaryContent
                }
            }
            .frame(width: geometry.size.width, height: geometry.size.height)
            .clipped()
        }
        .ignoresSafeArea()
        .foregroundStyle(.white)
        .task { await runSequence() }
    }

    private var summaryContent: some View {
        VStack(spacing: 16) {
            Spacer(minLength: 0)
            VStack(spacing: 6) {
                Text("Journey complete")
                    .font(.system(size: 30, weight: .black).width(.expanded).italic())
                Text("\(summary.routeTitle) route")
                    .font(.subheadline)
                    .foregroundStyle(.white.opacity(0.85))
            }
            VStack(spacing: 12) {
                summaryRow("Points earned", "\(summary.points) pts", "star.fill")
                summaryRow("CO₂ saved", savedText, "leaf.fill")
            }
            .padding(18)
            .background(.black.opacity(0.22), in: RoundedRectangle(cornerRadius: 18))
            .padding(.horizontal, 22)
            Text(comparisonText)
                .font(.footnote)
                .foregroundStyle(.white.opacity(0.9))
                .multilineTextAlignment(.center)
                .fixedSize(horizontal: false, vertical: true)
                .padding(.horizontal, 26)
            Spacer(minLength: 0)
            FanButton(title: "Continue", symbol: "house.fill", action: continueAction)
                .padding(.horizontal, 24)
                .padding(.bottom, 26)
        }
        .opacity(summaryVisible ? 1 : 0)
        .offset(y: summaryVisible ? 0 : 16)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(FanStyle.introGreen)
        .accessibilityElement(children: .contain)
        .accessibilityLabel(
            "Journey complete. \(summary.points) points. \(savedText) saved. \(comparisonText)"
        )
    }

    private var savedText: String {
        guard let savedKg = summary.savedKg else { return "Unavailable" }
        return String(format: "%.2f kg CO₂e", savedKg)
    }

    private var comparisonText: String {
        guard let savedKg = summary.savedKg else {
            return "No carbon estimate was available for this trip."
        }
        guard savedKg > 0 else {
            return "Driving this trip saved no carbon. Transit, walking and cycling earn points."
        }
        let laps = JourneyCelebrationRewards.laps(savedKg: savedKg)
        let value = String(format: "%.2f", laps)
        guard laps >= 0.01 else {
            return "Your CO₂ saved is less than 0.01 laps of the Marina Bay Street Circuit."
        }
        return
            "Your CO₂ saved equals driving \(value) \(value == "1.00" ? "lap" : "laps") of the Marina Bay Street Circuit."
    }

    private func summaryRow(_ label: String, _ value: String, _ symbol: String) -> some View {
        HStack {
            Label(label, systemImage: symbol)
            Spacer()
            Text(value).font(.subheadline.bold())
        }
    }

    private func runSequence() async {
        guard !reduceMotion else {
            phase = .summary
            summaryVisible = true
            return
        }
        do {
            withAnimation(.easeOut(duration: 0.9)) { burstProgress = 1 }
            try await pause(780)
            phase = .carRun
            // Mount the fully offscreen starting frame before the run begins.
            try await pause(80)
            withAnimation(.timingCurve(0.38, 0.0, 0.75, 0.7, duration: 1.15)) {
                carProgress = 1
            }
            try await pause(1_270)
            phase = .summary
            withAnimation(.spring(response: 0.45, dampingFraction: 0.86)) {
                summaryVisible = true
            }
        } catch {
            // A dismissed celebration must still leave a usable summary behind.
            phase = .summary
            summaryVisible = true
        }
    }

    private func pause(_ milliseconds: UInt64) async throws {
        try await Task.sleep(nanoseconds: milliseconds * 1_000_000)
    }
}

/// The race car crossing left to right, painting the green field behind it. The
/// asset is a top-down car that faces down, so it is rotated to face right.
private struct CelebrationCarRun: View, Animatable {
    var progress: CGFloat
    let size: CGSize

    var animatableData: CGFloat {
        get { progress }
        set { progress = newValue }
    }

    var body: some View {
        let carLength = min(size.width * 0.46, 210)
        let carBody = carLength * 572 / 1328
        let startX = -carLength
        let endX = size.width + carLength
        let carX = startX + (endX - startX) * progress
        let carY = size.height * 0.42
        let wipeWidth = min(size.width, max(0, carX - carLength * 0.34))

        ZStack(alignment: .topLeading) {
            Rectangle()
                .fill(FanStyle.introGreen)
                .frame(width: wipeWidth, height: size.height)
                .accessibilityHidden(true)

            Image("AMR26Car")
                .resizable()
                .scaledToFit()
                .frame(width: carBody, height: carLength)
                .rotationEffect(.degrees(-90))
                .position(x: carX, y: carY)
                .accessibilityLabel("Aston Martin Formula One car")
        }
        .frame(width: size.width, height: size.height)
    }
}

/// Deterministic confetti pieces. The values are generated once so a re-render
/// cannot re-roll them mid-flight.
private struct ConfettiPiece {
    let angle: Double
    let distance: CGFloat
    let width: CGFloat
    let height: CGFloat
    let spin: Double
    let color: Color
}

private let confettiPieces: [ConfettiPiece] = {
    var seed: UInt64 = 0x9E37_79B9_7F4A_7C15
    func next() -> Double {
        seed = seed &* 6_364_136_223_846_793_005 &+ 1_442_695_040_888_963_407
        return Double(seed >> 11) / Double(1 << 53)
    }
    let colors: [Color] = [
        FanStyle.introGreen,
        FanStyle.teal,
        Color(red: 0.80, green: 0.95, blue: 0.30),
        Color(red: 0.96, green: 0.96, blue: 0.93),
    ]
    return (0..<30).map { index in
        // Spread the burst around the full circle, biased away from straight down.
        let angle = Double(index) / 30 * 2 * .pi + next() * 0.2
        return ConfettiPiece(
            angle: angle,
            distance: CGFloat(120 + next() * 260),
            width: CGFloat(7 + next() * 8),
            height: CGFloat(11 + next() * 12),
            spin: (next() - 0.5) * 720,
            color: colors[index % colors.count]
        )
    }
}()

private struct ConfettiBurst: View {
    var progress: CGFloat

    var body: some View {
        ZStack {
            Image(systemName: "party.popper.fill")
                .font(.system(size: 54, weight: .bold))
                .foregroundStyle(FanStyle.introGreen)
                .scaleEffect(0.6 + 0.4 * progress)
                .opacity(Double(max(0, 1 - progress * 1.15)))
                .accessibilityHidden(true)

            ForEach(Array(confettiPieces.enumerated()), id: \.offset) { _, piece in
                let travelled = piece.distance * progress
                RoundedRectangle(cornerRadius: 2)
                    .fill(piece.color)
                    .frame(width: piece.width, height: piece.height)
                    .rotationEffect(.degrees(piece.spin * Double(progress)))
                    .offset(
                        x: CGFloat(cos(piece.angle)) * travelled,
                        // Let the pieces fall as they slow down.
                        y: CGFloat(sin(piece.angle)) * travelled + 70 * progress * progress
                    )
                    .opacity(Double(max(0.22, 1 - progress * 0.9)))
                    .accessibilityHidden(true)
            }
        }
        .accessibilityHidden(true)
    }
}

#Preview {
    JourneyCelebrationView(
        summary: JourneyCelebrationSummary(points: 28, savedKg: 2.75, routeTitle: "Public transport"),
        reduceMotion: false,
        continueAction: {}
    )
}
