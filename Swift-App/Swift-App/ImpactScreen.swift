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

private struct MonthlyLapsPoint: Identifiable {
    let month: String
    let laps: Int
    let total: Int
    var id: String { month }
}

private struct WeeklyLapsPoint: Identifiable {
    let week: String
    let laps: Int
    var id: String { week }
}

private enum ImpactView: String, CaseIterable, Identifiable {
    case you = "You"
    case fans = "Fans"
    case team = "AMF1"
    var id: String { rawValue }
}

private func point(_ x: CGFloat, _ y: CGFloat) -> CGPoint {
    CGPoint(x: x, y: y)
}

private struct TrackSegment {
    let start: CGPoint
    let control1: CGPoint
    let control2: CGPoint
    let end: CGPoint

    func point(at t: CGFloat) -> CGPoint {
        let u = 1 - t
        return CGPoint(
            x: u * u * u * start.x + 3 * u * u * t * control1.x + 3 * u * t * t * control2.x + t * t * t * end.x,
            y: u * u * u * start.y + 3 * u * u * t * control1.y + 3 * u * t * t * control2.y + t * t * t * end.y
        )
    }

    func derivative(at t: CGFloat) -> CGPoint {
        let u = 1 - t
        return CGPoint(
            x: 3 * u * u * (control1.x - start.x) + 6 * u * t * (control2.x - control1.x) + 3 * t * t * (end.x - control2.x),
            y: 3 * u * u * (control1.y - start.y) + 6 * u * t * (control2.y - control1.y) + 3 * t * t * (end.y - control2.y)
        )
    }

    func length(in rect: CGRect, to endT: CGFloat = 1) -> CGFloat {
        let samples = 16
        var total: CGFloat = 0
        var previous = point(at: 0)
        for index in 1...samples {
            let current = point(at: endT * CGFloat(index) / CGFloat(samples))
            let dx = (current.x - previous.x) * rect.width
            let dy = (current.y - previous.y) * rect.height
            total += hypot(dx, dy)
            previous = current
        }
        return total
    }
}

private struct ImpactLapView: View {
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @State private var progress: CGFloat = 0
    let estimatedKilograms: Double

    private var targetProgress: CGFloat {
        CGFloat(min(max(estimatedKilograms / 11.6, 0), 1))
    }

    // This is the exact cubic centerline from Singapore_street_circuit.svg,
    // normalized against that SVG's view box. Canvas draws this geometry and
    // the car samples the same geometry, so they cannot drift apart.
    private let trackSegments: [TrackSegment] = [
        TrackSegment(start: point(0.8459818, 0.0104683), control1: point(0.8377574, 0.0114783), control2: point(0.8293160, 0.0148596), end: point(0.8265638, 0.0441250)),
        TrackSegment(start: point(0.8265638, 0.0441250), control1: point(0.8237976, 0.0735379), control2: point(0.8189892, 0.1114149), end: point(0.8243696, 0.1402917)),
        TrackSegment(start: point(0.8243696, 0.1402917), control1: point(0.8301644, 0.1713926), control2: point(0.8641441, 0.3101091), end: point(0.8672374, 0.3401858)),
        TrackSegment(start: point(0.8672374, 0.3401858), control1: point(0.8703173, 0.3701308), control2: point(0.8617294, 0.4218309), end: point(0.8382889, 0.4228824)),
        TrackSegment(start: point(0.8382889, 0.4228824), control1: point(0.8136714, 0.4239866), control2: point(0.6960463, 0.4139815), end: point(0.6676744, 0.4121665)),
        TrackSegment(start: point(0.6676744, 0.4121665), control1: point(0.6363834, 0.4101648), control2: point(0.5594752, 0.4153581), end: point(0.5292182, 0.3882849)),
        TrackSegment(start: point(0.5292182, 0.3882849), control1: point(0.4994046, 0.3616084), control2: point(0.3918480, 0.2632056), end: point(0.3738275, 0.2451116)),
        TrackSegment(start: point(0.3738275, 0.2451116), control1: point(0.3563072, 0.2275200), control2: point(0.3382331, 0.2090408), end: point(0.3302404, 0.2190861)),
        TrackSegment(start: point(0.3302404, 0.2190861), control1: point(0.3219526, 0.2295025), control2: point(0.3053693, 0.2750696), end: point(0.3011965, 0.2853077)),
        TrackSegment(start: point(0.3011965, 0.2853077), control1: point(0.2970238, 0.2955458), control2: point(0.2746631, 0.3548961), end: point(0.2643076, 0.3774303)),
        TrackSegment(start: point(0.2643076, 0.3774303), control1: point(0.2573782, 0.3925088), control2: point(0.2500009, 0.3888334), end: point(0.2466697, 0.3872568)),
        TrackSegment(start: point(0.2466697, 0.3872568), control1: point(0.2358614, 0.3821414), control2: point(0.2098307, 0.3406084), end: point(0.1823330, 0.2931446)),
        TrackSegment(start: point(0.1823330, 0.2931446), control1: point(0.1543239, 0.2447980), control2: point(0.1392322, 0.2720085), end: point(0.1311731, 0.2929498)),
        TrackSegment(start: point(0.1311731, 0.2929498), control1: point(0.1250280, 0.3089180), control2: point(0.0120833, 0.6102686), end: point(0.0081013, 0.6239620)),
        TrackSegment(start: point(0.0081013, 0.6239620), control1: point(0.0036834, 0.6391546), control2: point(0.0100342, 0.6482868), end: point(0.0105409, 0.6554856)),
        TrackSegment(start: point(0.0105409, 0.6554856), control1: point(0.0109342, 0.6610716), control2: point(0.0072301, 0.6697169), end: point(0.0074392, 0.6778764)),
        TrackSegment(start: point(0.0074392, 0.6778764), control1: point(0.0076010, 0.6841901), control2: point(0.0156368, 0.6948689), end: point(0.0246332, 0.7082340)),
        TrackSegment(start: point(0.0246332, 0.7082340), control1: point(0.0336296, 0.7215991), control2: point(0.0527218, 0.7476670), end: point(0.0576043, 0.7593305)),
        TrackSegment(start: point(0.0576043, 0.7593305), control1: point(0.0627538, 0.7716321), control2: point(0.0582854, 0.7990570), end: point(0.0589255, 0.8218134)),
        TrackSegment(start: point(0.0589255, 0.8218134), control1: point(0.0594619, 0.8408810), control2: point(0.0677699, 0.8481699), end: point(0.0826317, 0.8678064)),
        TrackSegment(start: point(0.0826317, 0.8678064), control1: point(0.0987253, 0.8890705), control2: point(0.1129393, 0.9031631), end: point(0.1250418, 0.9163189)),
        TrackSegment(start: point(0.1250418, 0.9163189), control1: point(0.1379051, 0.9303015), control2: point(0.1433819, 0.9629823), end: point(0.1523361, 0.9760854)),
        TrackSegment(start: point(0.1523361, 0.9760854), control1: point(0.1618397, 0.9899923), control2: point(0.1757387, 1.0070796), end: point(0.1830774, 0.9495595)),
        TrackSegment(start: point(0.1830774, 0.9495595), control1: point(0.1902354, 0.8934562), control2: point(0.2016468, 0.7231781), end: point(0.2074189, 0.6711363)),
        TrackSegment(start: point(0.2074189, 0.6711363), control1: point(0.2132454, 0.6186051), control2: point(0.2431650, 0.4906540), end: point(0.2530373, 0.4581100)),
        TrackSegment(start: point(0.2530373, 0.4581100), control1: point(0.2635935, 0.4233114), control2: point(0.2722382, 0.4260661), end: point(0.2939403, 0.4570189)),
        TrackSegment(start: point(0.2939403, 0.4570189), control1: point(0.3150090, 0.4870682), control2: point(0.3694454, 0.5543282), end: point(0.3870782, 0.5761887)),
        TrackSegment(start: point(0.3870782, 0.5761887), control1: point(0.4041408, 0.5973423), control2: point(0.4349574, 0.5910691), end: point(0.4524157, 0.5965251)),
        TrackSegment(start: point(0.4524157, 0.5965251), control1: point(0.4687730, 0.6016370), control2: point(0.4652787, 0.6273142), end: point(0.4687389, 0.6596746)),
        TrackSegment(start: point(0.4687389, 0.6596746), control1: point(0.4728283, 0.6979197), control2: point(0.5149267, 0.6861707), end: point(0.5274067, 0.6861967)),
        TrackSegment(start: point(0.5274067, 0.6861967), control1: point(0.5408221, 0.6862247), control2: point(0.5849777, 0.6954363), end: point(0.5985755, 0.6938487)),
        TrackSegment(start: point(0.5985755, 0.6938487), control1: point(0.6120411, 0.6922766), control2: point(0.6105139, 0.6071462), end: point(0.6307603, 0.6057979)),
        TrackSegment(start: point(0.6307603, 0.6057979), control1: point(0.6509905, 0.6044507), control2: point(0.7056749, 0.6206540), end: point(0.7158702, 0.6241439)),
        TrackSegment(start: point(0.7158702, 0.6241439), control1: point(0.7261726, 0.6276705), control2: point(0.7307061, 0.6465561), end: point(0.7332931, 0.6775979)),
        TrackSegment(start: point(0.7332931, 0.6775979), control1: point(0.7359557, 0.7095485), control2: point(0.7715728, 0.7043560), end: point(0.8081214, 0.7080982)),
        TrackSegment(start: point(0.8081214, 0.7080982), control1: point(0.8446700, 0.7118404), control2: point(0.8744423, 0.7118290), end: point(0.9016119, 0.7166177)),
        TrackSegment(start: point(0.9016119, 0.7166177), control1: point(0.9287099, 0.7213937), control2: point(0.9275550, 0.7160575), end: point(0.9393701, 0.6979659)),
        TrackSegment(start: point(0.9393701, 0.6979659), control1: point(0.9455721, 0.6884580), control2: point(0.9679743, 0.6567031), end: point(0.9720456, 0.6431984)),
        TrackSegment(start: point(0.9720456, 0.6431984), control1: point(0.9761170, 0.6296936), control2: point(0.9748160, 0.6178032), end: point(0.9736645, 0.6073592)),
        TrackSegment(start: point(0.9736645, 0.6073592), control1: point(0.9714606, 0.5873691), control2: point(0.9505352, 0.3622081), end: point(0.9438234, 0.2787917)),
        TrackSegment(start: point(0.9438234, 0.2787917), control1: point(0.9371210, 0.1954952), control2: point(0.9368111, 0.0937665), end: point(0.9265866, 0.0802949)),
        TrackSegment(start: point(0.9265866, 0.0802949), control1: point(0.9146151, 0.0645213), control2: point(0.8851014, 0.0774570), end: point(0.8674481, 0.0435757)),
        TrackSegment(start: point(0.8674481, 0.0435757), control1: point(0.8508899, 0.0117963), control2: point(0.8547913, 0.0093865), end: point(0.8459818, 0.0104683))
    ]

    private var equivalentLaps: Double { estimatedKilograms / 11.6 }

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack {
                Text("Your travel in laps")
                    .font(.headline)
                Spacer()
                Button("Replay", systemImage: "arrow.clockwise", action: replay)
                    .font(.subheadline.weight(.semibold))
                    .accessibilityHint("Replays the lap animation")
            }

            GeometryReader { geometry in
                let car = carPosition(in: geometry.size)
                ZStack {
                    let mapFrame = mapRect(in: geometry.size)
                    Image("SingaporeStreetCircuit")
                        .resizable()
                        .renderingMode(.template)
                        .scaledToFit()
                        .foregroundStyle(FanStyle.muted)
                        .opacity(0.72)
                        .frame(width: mapFrame.width, height: mapFrame.height)
                        .position(x: mapFrame.midX, y: mapFrame.midY)
                        .accessibilityHidden(true)
                    Canvas { context, size in
                        let route = routePath(in: size)
                        let map = mapRect(in: size)
                        let lineWidth = max(2, map.width * 8.098 / 618.46674)
                        let style = StrokeStyle(lineWidth: lineWidth, lineCap: .round, lineJoin: .round)
                        context.stroke(route, with: .color(FanStyle.muted.opacity(0.72)), style: style)
                        context.stroke(route.trimmedPath(from: 0, to: progress), with: .color(FanStyle.teal), style: style)
                        let carShape = carPath(center: car.point, angle: car.angle)
                        context.fill(carShape, with: .color(FanStyle.teal))
                        context.stroke(carShape, with: .color(FanStyle.background), style: StrokeStyle(lineWidth: 1.2))
                    }
                    .accessibilityHidden(true)
                }
            }
            .frame(height: 120)
            .accessibilityElement(children: .ignore)
            .accessibilityLabel("Circuit lap animation")
            .accessibilityValue(reduceMotion ? "Complete" : "Replay to watch your travel trace the circuit")

            lapCountView
        }
        .padding(14)
        .background(FanStyle.panel, in: RoundedRectangle(cornerRadius: 4))
        .onAppear(perform: play)
    }

    private var lapCountView: some View {
        VStack(alignment: .leading, spacing: 2) {
            HStack(alignment: .firstTextBaseline, spacing: 7) {
                Text(String(format: "%.1f", equivalentLaps))
                    .font(.system(size: 28, weight: .bold, design: .rounded))
                    .foregroundStyle(FanStyle.teal)
                    .monospacedDigit()
                Text("Marina Bay laps")
                    .font(.subheadline.weight(.semibold))
                    .foregroundStyle(.white)
            }
            Text("Based on estimated travel savings")
                .font(.caption)
                .foregroundStyle(FanStyle.muted)
        }
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
            progress = targetProgress
        }
    }

    private func mapRect(in size: CGSize) -> CGRect {
        let aspect = 618.46674 / 394.15955
        let width = min(size.width, size.height * aspect)
        let height = width / aspect
        return CGRect(x: (size.width - width) / 2, y: (size.height - height) / 2, width: width, height: height)
    }

    private func routePath(in size: CGSize) -> Path {
        let rect = mapRect(in: size)
        func scaled(_ point: CGPoint) -> CGPoint {
            CGPoint(x: rect.minX + point.x * rect.width, y: rect.minY + point.y * rect.height)
        }
        return Path { path in
            guard let first = trackSegments.first else { return }
            path.move(to: scaled(first.start))
            for segment in trackSegments {
                path.addCurve(to: scaled(segment.end), control1: scaled(segment.control1), control2: scaled(segment.control2))
            }
            path.closeSubpath()
        }
    }

    private func carPath(center: CGPoint, angle: Double) -> Path {
        var path = Path()
        path.move(to: CGPoint(x: -9, y: 2))
        path.addLine(to: CGPoint(x: -5, y: -3))
        path.addLine(to: CGPoint(x: 2, y: -4))
        path.addLine(to: CGPoint(x: 8, y: -1))
        path.addLine(to: CGPoint(x: 9, y: 2))
        path.addLine(to: CGPoint(x: -9, y: 2))
        path.closeSubpath()
        return path
            .applying(CGAffineTransform(rotationAngle: angle))
            .applying(CGAffineTransform(translationX: center.x, y: center.y))
    }

    private func carPosition(in size: CGSize) -> (point: CGPoint, angle: Double) {
        let rect = mapRect(in: size)
        let lengths = trackSegments.map { $0.length(in: rect) }
        let distance = min(max(progress, 0), 1) * lengths.reduce(0, +)
        var remaining = distance
        for (index, segment) in trackSegments.enumerated() {
            let segmentLength = lengths[index]
            guard remaining > segmentLength, index < trackSegments.count - 1 else {
                var low: CGFloat = 0
                var high: CGFloat = 1
                for _ in 0..<10 {
                    let middle = (low + high) / 2
                    if segment.length(in: rect, to: middle) < remaining {
                        low = middle
                    } else {
                        high = middle
                    }
                }
                let t = (low + high) / 2
                let normalized = segment.point(at: t)
                let tangent = segment.derivative(at: t)
                return (
                    CGPoint(x: rect.minX + normalized.x * rect.width, y: rect.minY + normalized.y * rect.height),
                    Double(atan2(tangent.y * rect.height, tangent.x * rect.width))
                )
            }
            remaining -= segmentLength
        }
        return (CGPoint(x: rect.midX, y: rect.midY), 0)
    }
}

struct ImpactScreen: View {
    @EnvironmentObject private var backend: BackendSession
    let demoState: DemoFanState
    let open: (FanDestination) -> Void
    @State private var selectedView: ImpactView = .you

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 14) {
                SectionHeader(title: "Impact.", description: "Your travel, all fans, and the team, in laps.")
                    .padding(.top, 30)

                impactTabs

                switch selectedView {
                case .you:
                    youView
                case .fans:
                    fansView
                case .team:
                    teamView
                }

                FanButton(title: "View digital forest", symbol: "tree.fill") { open(.tree) }
                    .padding(.top, 4)
                    .padding(.bottom, 110)
            }
            .padding(.horizontal, 22)
            .frame(maxWidth: 520)
            .frame(maxWidth: .infinity)
        }
        .scrollIndicators(.hidden)
        .task {
            await backend.loadImpact()
            await backend.loadHistory()
        }
    }

    private var impactTabs: some View {
        HStack(spacing: 4) {
            ForEach(ImpactView.allCases) { view in
                Button(view.rawValue) {
                    selectedView = view
                }
                .font(.subheadline.weight(.bold))
                .foregroundStyle(selectedView == view ? FanStyle.background : FanStyle.muted)
                .frame(maxWidth: .infinity, minHeight: 44)
                .background(selectedView == view ? FanStyle.teal : FanStyle.panel, in: RoundedRectangle(cornerRadius: 4))
                .accessibilityAddTraits(selectedView == view ? .isSelected : [])
            }
        }
        .accessibilityElement(children: .contain)
        .accessibilityLabel("Impact views")
    }

    private var youView: some View {
        VStack(alignment: .leading, spacing: 14) {
            FeatureCard {
                VStack(alignment: .leading, spacing: 8) {
                    Label("YOUR LIFETIME TRAVEL", systemImage: "figure.walk")
                        .font(.caption.bold())
                        .foregroundStyle(FanStyle.teal)
                    Text("\(impactSavings) kg")
                        .font(.system(size: 38, weight: .bold, design: .rounded))
                    Text("CO₂ avoided vs driving alone")
                        .font(.subheadline)
                        .foregroundStyle(FanStyle.muted)
                    Text("Your travel is estimated separately from official AMF1 figures.")
                        .font(.caption)
                        .foregroundStyle(FanStyle.muted)
                }
            }

            ImpactLapView(estimatedKilograms: Double(impactSavings) ?? 0)

            statGrid([
                (impactActivityCount, "verified activities"),
                (impactPoints, "Green Points")
            ])

            FeatureCard {
                VStack(alignment: .leading, spacing: 9) {
                    Text("Your part in the team effort")
                        .font(.caption.bold())
                        .foregroundStyle(FanStyle.teal)
                    Text("1 in 9,281")
                        .font(.title2.bold())
                    Text("9,281 fans travelling like you would match AMF1's 2025 SAF freight saving (1,188 t).")
                        .font(.subheadline)
                        .foregroundStyle(FanStyle.muted)
                    comparisonRow("You", "\(impactLaps) laps", width: impactLapsWidth, highlighted: true)
                    comparisonRow("All fans", "3,621", width: 0.71)
                    comparisonRow("AMF1 SAF", "102,414", width: 1.0)
                    Text("Marina Bay laps, log scale.")
                        .font(.caption)
                        .foregroundStyle(FanStyle.muted)
                    callout("Your 128 kg equals 12 minutes of the team's staff commuting emissions. All fans together: 2.7 days.")
                }
            }

            FeatureCard {
                VStack(alignment: .leading, spacing: 10) {
                    HStack {
                        Text("Laps by month").font(.headline)
                        Spacer()
                        Text("running total").font(.caption).foregroundStyle(FanStyle.muted)
                    }
                    Chart(monthlyLaps) { point in
                        BarMark(x: .value("Month", point.month), y: .value("Laps", point.laps))
                            .foregroundStyle(point.month == "Oct" ? FanStyle.teal : FanStyle.darkTeal)
                        LineMark(x: .value("Month", point.month), y: .value("Total", point.total))
                            .foregroundStyle(FanStyle.teal)
                    }
                    .chartYAxis(.hidden)
                    .frame(height: 130)
                }
            }
        }
    }

    private var fansView: some View {
        VStack(alignment: .leading, spacing: 14) {
            FeatureCard {
                VStack(alignment: .leading, spacing: 8) {
                    Label("ALL FANS, LIFETIME", systemImage: "person.3.fill")
                        .font(.caption.bold())
                        .foregroundStyle(FanStyle.teal)
                    Text("3,621 laps")
                        .font(.system(size: 34, weight: .bold, design: .rounded))
                    Text("of Marina Bay, together")
                    Text("42 t CO₂ avoided · 2,310 fans · 58 full Singapore GPs")
                        .font(.caption)
                        .foregroundStyle(FanStyle.muted)
                }
            }

            FeatureCard {
                VStack(alignment: .leading, spacing: 9) {
                    Text("Fans vs team moves")
                        .font(.caption.bold())
                        .foregroundStyle(FanStyle.teal)
                    Text("Fans already beat the EV switch")
                        .font(.headline)
                    Text("2025 team savings next to what fans have avoided.")
                        .font(.subheadline)
                        .foregroundStyle(FanStyle.muted)
                    comparisonRow("Team EV cars", "25 t", width: 0.13)
                    comparisonRow("All fans", "42 t", width: 0.22, highlighted: true)
                    comparisonRow("Fewer flights", "193 t", width: 1.0)
                    Text("Next target: match the team's flight cuts. 151 t to go.")
                        .font(.caption)
                        .foregroundStyle(FanStyle.muted)
                }
            }

            FeatureCard {
                VStack(alignment: .leading, spacing: 9) {
                    Text("Toward the team's SAF saving")
                        .font(.headline)
                    Text("Each square is 1% of 1,188 t.")
                        .font(.caption)
                        .foregroundStyle(FanStyle.muted)
                    LazyVGrid(columns: Array(repeating: GridItem(.flexible(), spacing: 2), count: 10), spacing: 2) {
                        ForEach(0..<100, id: \.self) { index in
                            Rectangle()
                                .fill(index < 3 ? FanStyle.teal : FanStyle.darkTeal)
                                .frame(height: 12)
                        }
                    }
                    Text("Fans so far: 3.5% · Your 128 kg: 0.3% of that")
                        .font(.caption)
                        .foregroundStyle(FanStyle.muted)
                }
            }

            FeatureCard {
                VStack(alignment: .leading, spacing: 9) {
                    HStack {
                        Text("Laps per week").font(.headline)
                        Spacer()
                        Text("Aug to Oct").font(.caption).foregroundStyle(FanStyle.muted)
                    }
                    Chart(weeklyLaps) { point in
                        AreaMark(x: .value("Week", point.week), y: .value("Laps", point.laps))
                            .foregroundStyle(FanStyle.teal.opacity(0.16))
                        LineMark(x: .value("Week", point.week), y: .value("Laps", point.laps))
                            .foregroundStyle(FanStyle.teal)
                    }
                    .chartYAxis(.hidden)
                    .frame(height: 120)
                    Text("Singapore GP week · 412 laps")
                        .font(.caption)
                        .foregroundStyle(FanStyle.muted)
                }
            }

            FeatureCard {
                VStack(alignment: .leading, spacing: 9) {
                    Text("How fans travel").font(.headline)
                    comparisonRow("MRT", "55%", width: 0.55)
                    comparisonRow("Bus", "29%", width: 0.29)
                    comparisonRow("Walk/cycle", "16%", width: 0.16)
                }
            }
        }
    }

    private var teamView: some View {
        VStack(alignment: .leading, spacing: 14) {
            FeatureCard {
                VStack(alignment: .leading, spacing: 8) {
                    Label("AMF1 IN 2025 · OFFICIAL", systemImage: "doc.text")
                        .font(.caption.bold())
                        .foregroundStyle(FanStyle.teal)
                    Text("85,974 tCO₂e")
                        .font(.system(size: 34, weight: .bold, design: .rounded))
                    Text("Market-based footprint · net zero target 2050")
                        .font(.subheadline)
                        .foregroundStyle(FanStyle.muted)
                }
            }

            statGrid([
                ("85,974", "tCO₂e footprint"),
                ("2050", "net zero target"),
                ("2,124", "tCO₂e removed"),
                ("32%", "AMR25 circularity")
            ])

            FeatureCard {
                VStack(alignment: .leading, spacing: 10) {
                    Text("Follow the carbon")
                        .font(.caption.bold())
                        .foregroundStyle(FanStyle.teal)
                    Text("81% comes from the supply chain")
                        .font(.headline)
                    HStack(spacing: 18) {
                        ZStack {
                            Circle().stroke(FanStyle.darkTeal, lineWidth: 18)
                            Circle().trim(from: 0, to: 0.81).stroke(FanStyle.teal, style: StrokeStyle(lineWidth: 18, lineCap: .butt)).rotationEffect(.degrees(-90))
                            Text("81%").font(.headline.bold())
                        }
                        .frame(width: 100, height: 100)
                        VStack(alignment: .leading, spacing: 6) {
                            legendRow("Supply chain", "69,837 t")
                            legendRow("Staff commuting", "5,717 t")
                            legendRow("Freight", "5,560 t")
                            legendRow("Business travel", "6%")
                        }
                    }
                    callout("Most carbon is made before the car leaves the factory, in parts and materials. Commuting is the slice your kind of travel looks like.")
                }
            }

            FeatureCard {
                VStack(alignment: .leading, spacing: 9) {
                    Text("Target chase").font(.caption.bold()).foregroundStyle(FanStyle.teal)
                    Text("On the way to the 2030 line").font(.headline)
                    Chart(MakeAMarkReport2025.footprint) { point in
                        LineMark(x: .value("Year", point.year), y: .value("tCO₂e", point.tonnes))
                            .foregroundStyle(FanStyle.teal)
                        PointMark(x: .value("Year", point.year), y: .value("tCO₂e", point.tonnes))
                            .foregroundStyle(FanStyle.teal)
                    }
                    .chartYScale(domain: 80_000...100_000)
                    .chartYAxis(.hidden)
                    .frame(height: 130)
                    comparisonRow("Scope 1+2", "−74%", width: 0.74)
                    comparisonRow("Scope 3", "−14%", width: 0.14)
                    Text("tCO₂e, without SAF certificates. Team figures are separate from fan estimates.")
                        .font(.caption)
                        .foregroundStyle(FanStyle.muted)
                }
            }

            FeatureCard {
                VStack(alignment: .leading, spacing: 8) {
                    Text("2025 moves, in Silverstone laps")
                        .font(.caption.bold()).foregroundStyle(FanStyle.teal)
                    comparisonRow("SAF freight", "88,153", width: 1.0)
                    comparisonRow("No paper cups", "37,950", width: 0.43)
                    comparisonRow("Fewer flights", "14,320", width: 0.16)
                    comparisonRow("EV pool cars", "1,855", width: 0.02)
                    comparisonRow("All fans", "3,116", width: 0.04, highlighted: true)
                    Text("First two figures are the report's own. Other figures use the same rate, 13.5 kg per lap.")
                        .font(.caption)
                        .foregroundStyle(FanStyle.muted)
                }
            }

            FeatureCard {
                VStack(alignment: .leading, spacing: 8) {
                    Text("Removing the rest").font(.caption.bold()).foregroundStyle(FanStyle.teal)
                    Text("2,124 t removed, 137% of Scope 1+2").font(.headline)
                    legendRow("Ethiopia", "community woodland")
                    legendRow("Kenya", "mangrove restoration")
                    legendRow("USA", "CO₂ locked in concrete")
                    Text("Campus: 122% biodiversity net gain, 72,000 m² wild meadow.")
                        .font(.caption).foregroundStyle(FanStyle.muted)
                }
            }

            reportSnapshotCard

            FeatureCard {
                VStack(alignment: .leading, spacing: 8) {
                    Text("Decoder").font(.caption.bold()).foregroundStyle(FanStyle.teal)
                    DisclosureGroup("Scope 1, 2, 3") {
                        Text("1: fuel the team burns. 2: electricity it buys. 3: everything else, from parts to flights and commuting.")
                            .font(.caption).foregroundStyle(FanStyle.muted).padding(.top, 4)
                    }
                    DisclosureGroup("SAF certificates") {
                        Text("The team pays for sustainable fuel that enters the aviation system and claims the saving, without its own plane using that exact fuel.")
                            .font(.caption).foregroundStyle(FanStyle.muted).padding(.top, 4)
                    }
                    DisclosureGroup("Why your km count differently") {
                        Text("Your savings are app estimates against driving alone. Team figures are an assured annual report. We compare them for scale, never add them up.")
                            .font(.caption).foregroundStyle(FanStyle.muted).padding(.top, 4)
                    }
                }
            }

            Text("Team figures: Make A Mark ESG Report 2025, 1 Jan to 31 Dec 2025, limited assurance (ISO 14064-3).")
                .font(.caption2)
                .foregroundStyle(FanStyle.muted)
        }
    }

    private var reportSnapshotCard: some View {
        FeatureCard {
            VStack(alignment: .leading, spacing: 12) {
                Label("MAKE A MARK ESG REPORT 2025", systemImage: "doc.text")
                    .font(.caption.bold())
                    .foregroundStyle(FanStyle.teal)
                Text("Team report snapshot").font(.title3.bold())
                Text("Market-based footprint with SAFc")
                    .font(.subheadline).foregroundStyle(FanStyle.muted)
                Chart(MakeAMarkReport2025.footprint) { point in
                    LineMark(x: .value("Year", point.year), y: .value("tCO₂e", point.tonnes))
                        .foregroundStyle(FanStyle.teal)
                    PointMark(x: .value("Year", point.year), y: .value("tCO₂e", point.tonnes))
                        .foregroundStyle(FanStyle.teal)
                }
                .chartYScale(domain: 80_000...100_000)
                .chartYAxis(.hidden)
                .frame(height: 130)
                ForEach(MakeAMarkReport2025.metrics) { metric in
                    HStack(alignment: .firstTextBaseline) {
                        VStack(alignment: .leading, spacing: 3) {
                            Text(metric.label).font(.subheadline.bold())
                            Text("\(metric.detail) Source: report \(metric.page).")
                                .font(.caption).foregroundStyle(FanStyle.muted)
                        }
                        Spacer()
                        Text(metric.value).font(.subheadline.bold()).foregroundStyle(FanStyle.teal)
                    }
                }
            }
        }
    }

    private func statGrid(_ values: [(String, String)]) -> some View {
        LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: 8) {
            ForEach(Array(values.enumerated()), id: \.offset) { _, value in
                FeatureCard {
                    VStack(alignment: .leading, spacing: 5) {
                        Text(value.0).font(.title3.bold().monospacedDigit())
                        Text(value.1).font(.caption).foregroundStyle(FanStyle.muted)
                    }
                }
            }
        }
    }

    private func comparisonRow(_ label: String, _ value: String, width: CGFloat, highlighted: Bool = false) -> some View {
        HStack(spacing: 8) {
            Text(label).font(.caption).frame(width: 92, alignment: .leading)
            GeometryReader { geometry in
                Capsule()
                    .fill(FanStyle.darkTeal)
                    .overlay(alignment: .leading) {
                        Capsule().fill(highlighted ? FanStyle.teal : FanStyle.navigationTeal)
                            .frame(width: geometry.size.width * min(max(width, 0), 1))
                    }
            }
            .frame(height: 9)
            Text(value).font(.caption.bold().monospacedDigit()).frame(width: 62, alignment: .trailing)
        }
        .frame(minHeight: 28)
    }

    private func legendRow(_ label: String, _ value: String) -> some View {
        HStack {
            Text(label).font(.caption).foregroundStyle(FanStyle.muted)
            Spacer()
            Text(value).font(.caption.bold())
        }
    }

    private func callout(_ text: String) -> some View {
        Text(text)
            .font(.caption)
            .foregroundStyle(FanStyle.muted)
            .padding(10)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(FanStyle.darkTeal, in: RoundedRectangle(cornerRadius: 3))
    }

    private var impactActivityCount: String {
        guard let participation = backend.impact?.personalParticipation,
              participation.kind == "available"
        else { return "0" }
        return "\(participation.activityCount ?? 0)"
    }

    private var impactPoints: String {
        guard let profile = backend.realProfile else { return "0" }
        return "\(profile.balance)"
    }

    private var impactSavings: String {
        if let value = backend.impact?.personal.savingsKg, let number = Double(value) { return String(format: "%.2f", number) }
        if let savedKg = backend.routeSummary?.savedKg, savedKg > 0 { return String(format: "%.2f", savedKg) }
        let routeKilograms = Double(backend.history?.entries.filter { $0.kind == "route_completion" }.reduce(0) { $0 + $1.delta } ?? 0) / 50
        if routeKilograms > 0 { return String(format: "%.2f", routeKilograms) }
        if backend.isConnected { return "0.00" }
        return String(format: "%.2f", demoState.totalEstimatedCarbonKg)
    }

    private var impactLaps: String {
        let kilograms = Double(impactSavings) ?? 0
        return String(format: "%.0f", kilograms / 11.6)
    }

    private var impactLapsWidth: CGFloat {
        let kilograms = Double(impactSavings) ?? 0
        return min(max((kilograms / 11.6) / 102_414, 0), 1)
    }

    private var monthlyLaps: [MonthlyLapsPoint] {
        [
            MonthlyLapsPoint(month: "May", laps: 14, total: 14),
            MonthlyLapsPoint(month: "Jun", laps: 24, total: 38),
            MonthlyLapsPoint(month: "Jul", laps: 19, total: 57),
            MonthlyLapsPoint(month: "Aug", laps: 34, total: 91),
            MonthlyLapsPoint(month: "Sep", laps: 44, total: 135),
            MonthlyLapsPoint(month: "Oct", laps: 20, total: 155)
        ]
    }

    private var weeklyLaps: [WeeklyLapsPoint] {
        [
            WeeklyLapsPoint(week: "1", laps: 80),
            WeeklyLapsPoint(week: "2", laps: 96),
            WeeklyLapsPoint(week: "3", laps: 115),
            WeeklyLapsPoint(week: "4", laps: 126),
            WeeklyLapsPoint(week: "5", laps: 150),
            WeeklyLapsPoint(week: "6", laps: 412),
            WeeklyLapsPoint(week: "7", laps: 178),
            WeeklyLapsPoint(week: "8", laps: 210),
            WeeklyLapsPoint(week: "9", laps: 226),
            WeeklyLapsPoint(week: "10", laps: 245)
        ]
    }
}
