import SwiftUI

struct HomeScreen: View {
    let driver: Driver
    let demoState: DemoFanState
    let open: (FanDestination) -> Void
    @State private var appeared = false
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    private var greeting: String {
        let hour = Calendar.current.component(.hour, from: .now)
        return hour < 12 ? "Good Morning," : hour < 17 ? "Good Afternoon," : "Good Evening,"
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 0) {
                ZStack(alignment: .topLeading) {
                    Text(driver.number)
                        .font(.system(size: 370, weight: .black, design: .rounded))
                        .tracking(-38)
                        .foregroundStyle(FanStyle.teal.opacity(0.15))
                        .minimumScaleFactor(0.6)
                        .lineLimit(1)
                        .offset(x: -33, y: -87)
                        .accessibilityHidden(true)

                    VStack(alignment: .leading, spacing: 0) {
                        HStack(alignment: .top) {
                            VStack(alignment: .leading, spacing: 2) {
                                Text(greeting)
                                    .foregroundStyle(.white)
                                Text("\(driver.rawValue)!")
                                    .foregroundStyle(FanStyle.teal)
                                    .padding(.leading, 15)
                            }
                            .font(.system(size: 30, weight: .semibold, design: .rounded))
                            .tracking(-1.5)

                            Spacer()
                            Button { open(.profile) } label: {
                                CircleIcon(symbol: "person.crop.circle", size: 48)
                            }
                            .accessibilityLabel("Profile")
                        }
                        .padding(.top, 22)
                        .padding(.horizontal, 28)
                        .opacity(appeared ? 1 : 0)
                        .offset(y: appeared || reduceMotion ? 0 : 12)
                        .animation(reduceMotion ? nil : FanMotion.page, value: appeared)

                        HeroCards(demoState: demoState)
                            .padding(.top, 10)
                            .opacity(appeared ? 1 : 0)
                            .offset(y: appeared || reduceMotion ? 0 : 12)
                            .animation(reduceMotion ? nil : FanMotion.page.delay(0.06), value: appeared)

                        HStack {
                            quickAction("newspaper.fill", label: "News", page: .news)
                            Spacer()
                            quickAction("camera.fill", label: "Gallery", page: .gallery)
                            Spacer()
                            quickAction("flag.checkered", label: "Challenges", page: .challenges)
                        }
                        .padding(.horizontal, 30)
                        .padding(.top, 22)
                        .opacity(appeared ? 1 : 0)
                        .offset(y: appeared || reduceMotion ? 0 : 12)
                        .animation(reduceMotion ? nil : FanMotion.page.delay(0.12), value: appeared)
                    }
                }
                .frame(height: 394, alignment: .top)

                VStack(alignment: .leading, spacing: 17) {
                    Button { open(.quiz) } label: {
                        HStack(spacing: 15) {
                            Image(systemName: "brain.head.profile")
                                .font(.title2)
                                .foregroundStyle(.white)
                                .frame(width: 46, height: 46)
                                .background(.white.opacity(0.07), in: RoundedRectangle(cornerRadius: 14))
                            VStack(alignment: .leading, spacing: 4) {
                                Text("Race IQ").font(.headline)
                                Text("Play daily and earn race points.")
                                    .font(.caption).foregroundStyle(FanStyle.muted)
                            }
                            Spacer()
                            Image(systemName: "chevron.right")
                                .font(.caption.bold()).foregroundStyle(FanStyle.muted)
                        }
                        .padding(17)
                        .background(FanStyle.panel, in: RoundedRectangle(cornerRadius: 21))
                    }
                    .buttonStyle(FanPressStyle())
                }
                .padding(.horizontal, 22)
                .padding(.top, 35)
                .padding(.bottom, 110)
                .opacity(appeared ? 1 : 0)
                .offset(y: appeared || reduceMotion ? 0 : 12)
                .animation(reduceMotion ? nil : FanMotion.page.delay(0.18), value: appeared)
            }
            .frame(maxWidth: 520)
            .frame(maxWidth: .infinity)
        }
        .scrollIndicators(.hidden)
        .onAppear { appeared = true }
    }

    private func quickAction(_ symbol: String, label: String, page: FanDestination) -> some View {
        Button {
            open(page)
        } label: {
            VStack(spacing: 7) {
                CircleIcon(symbol: symbol, size: 66)
                Text(label)
                    .font(.system(size: 11, weight: .medium))
                    .foregroundStyle(FanStyle.muted)
            }
        }
        .buttonStyle(FanPressStyle())
        .accessibilityLabel(label)
    }
}

struct HeroCards: View {
    let demoState: DemoFanState

    var body: some View {
        GeometryReader { geometry in
            let width = geometry.size.width
            ZStack {
                metricCard(value: demoState.racePoints.formatted(), caption: "Race Points", symbol: "bolt.fill", isPoints: true)
                    .frame(width: width * 0.52, height: 151)
                    .rotationEffect(.degrees(-18))
                    .position(x: width * 0.78, y: 100)

                metricCard(value: "0", caption: "Days", symbol: "flame.fill", isPoints: false)
                    .frame(width: width * 0.52, height: 149)
                    .rotationEffect(.degrees(18))
                    .position(x: width * 0.22, y: 112)
            }
        }
        .frame(height: 196)
        .accessibilityElement(children: .combine)
    }

    private func metricCard(value: String, caption: String, symbol: String, isPoints: Bool) -> some View {
        VStack(spacing: 0) {
            if !isPoints {
                Image(systemName: symbol)
                    .font(.system(size: 28))
                    .foregroundStyle(FanStyle.streakGradient)
            }
            Text(value)
                .font(.system(size: isPoints ? 65 : 58, weight: .bold, design: .rounded))
                .foregroundStyle(LinearGradient(colors: [.white.opacity(0.97), FanStyle.muted, .white.opacity(0.82)], startPoint: .topLeading, endPoint: .bottomTrailing))
                .shadow(color: .white.opacity(0.12), radius: 3, y: -1)
                .minimumScaleFactor(0.5)
                .lineLimit(1)
            Text(caption)
                .font(.system(size: 15, weight: .semibold))
                .foregroundStyle(.white)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background {
            RoundedRectangle(cornerRadius: 17)
                .fill(LinearGradient(
                    colors: [Color(white: 0.29).opacity(0.4),
                             Color(white: 0.16).opacity(0.24)],
                    startPoint: .topLeading,
                    endPoint: .bottomTrailing
                ))
        }
        .clipShape(RoundedRectangle(cornerRadius: 17))
        .overlay(RoundedRectangle(cornerRadius: 17).strokeBorder(.white.opacity(0.28), lineWidth: 0.8))
        .shadow(color: .black.opacity(0.6), radius: 10, y: 7)
    }
}

struct CircleIcon: View {
    let symbol: String
    let size: CGFloat

    var body: some View {
        Image(systemName: symbol)
            .font(.system(size: size * 0.36, weight: .semibold))
            .foregroundStyle(.white)
            .frame(width: size, height: size)
            .background(LinearGradient(colors: [.white.opacity(0.18), .white.opacity(0.06)], startPoint: .top, endPoint: .bottom), in: Circle())
            .overlay(Circle().strokeBorder(.white.opacity(0.12), lineWidth: 0.7))
    }
}
