import SwiftUI
import MapKit

struct TravelScreen: View {
    @State private var origin = ""
    @State private var destination = ""
    @State private var direction = "Outbound"
    @State private var showRoutes = false
    @State private var selectedMode: String?
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    private let modes: [(name: String, symbol: String, detail: String)] = [
        ("Transit", "tram.fill", "Bus · rail · walk"),
        ("Walk", "figure.walk", "On foot"),
        ("Cycle", "bicycle", "By bike"),
        ("Cab", "car.fill", "Direct ride")
    ]

    var body: some View {
        ZStack(alignment: .bottom) {
            VStack(spacing: 0) {
                TravelMapView()
                Color.clear.frame(height: showRoutes ? 540 : 316)
            }

            LinearGradient(colors: [FanStyle.background.opacity(0.85), .clear, .clear],
                           startPoint: .top, endPoint: .bottom)
                .ignoresSafeArea()
                .allowsHitTesting(false)

            VStack(alignment: .leading, spacing: 8) {
                Text("Where to…")
                    .font(.system(size: 36, weight: .bold, design: .rounded))
                    .tracking(-1.4)
                Label("Singapore route planning", systemImage: "map.fill")
                    .font(.caption.bold())
                    .foregroundStyle(FanStyle.muted)
                Spacer()
            }
            .padding(.horizontal, 24)
            .padding(.top, 25)
            .frame(maxWidth: .infinity)
            .allowsHitTesting(false)

            ScrollView {
                VStack(alignment: .leading, spacing: 15) {
                    Capsule()
                        .fill(FanStyle.muted.opacity(0.55))
                        .frame(width: 35, height: 4)
                        .frame(maxWidth: .infinity)
                        .padding(.bottom, 4)

                    HStack(spacing: 14) {
                        Image(systemName: "circle.dotted.circle.fill")
                            .foregroundStyle(FanStyle.teal)
                        TextField("From", text: $origin)
                            .textInputAutocapitalization(.words)
                    }
                    .padding(14)
                    .background(.white.opacity(0.07), in: RoundedRectangle(cornerRadius: 14))

                    HStack(spacing: 14) {
                        Image(systemName: "mappin.and.ellipse")
                            .foregroundStyle(FanStyle.teal)
                        TextField("Where to?", text: $destination)
                            .textInputAutocapitalization(.words)
                    }
                    .padding(14)
                    .background(.white.opacity(0.07), in: RoundedRectangle(cornerRadius: 14))

                    HStack(spacing: 10) {
                        ForEach(["Outbound", "Return"], id: \.self) { option in
                            Button {
                                withAnimation(reduceMotion ? nil : FanMotion.quick) { direction = option }
                            } label: {
                                Label(option, systemImage: option == "Outbound" ? "arrow.up.right" : "arrow.down.left")
                                    .font(.caption.bold())
                                    .frame(maxWidth: .infinity)
                                    .padding(12)
                                    .background(direction == option ? FanStyle.darkTeal : .white.opacity(0.07), in: Capsule())
                                    .overlay(Capsule().strokeBorder(direction == option ? FanStyle.teal : .clear))
                            }
                            .buttonStyle(FanPressStyle())
                        }
                    }

                    FanButton(title: showRoutes ? "Hide options" : "Travel options", symbol: "arrow.right") {
                        withAnimation(reduceMotion ? nil : FanMotion.sheet) { showRoutes.toggle() }
                    }

                    if showRoutes {
                        VStack(spacing: 15) {
                            ForEach(modes, id: \.name) { mode in
                                Button {
                                    withAnimation(reduceMotion ? nil : FanMotion.quick) { selectedMode = mode.name }
                                } label: {
                                    HStack(spacing: 14) {
                                        Image(systemName: mode.symbol)
                                            .font(.title3)
                                            .foregroundStyle(FanStyle.teal)
                                            .frame(width: 30)
                                        VStack(alignment: .leading, spacing: 3) {
                                            Text(mode.name).font(.subheadline.bold())
                                            Text(mode.detail).font(.caption).foregroundStyle(FanStyle.muted)
                                        }
                                        Spacer()
                                        Image(systemName: selectedMode == mode.name ? "checkmark.circle.fill" : "circle")
                                            .foregroundStyle(FanStyle.teal)
                                    }
                                    .padding(13)
                                    .background(.white.opacity(0.07), in: RoundedRectangle(cornerRadius: 14))
                                }
                                .buttonStyle(FanPressStyle())
                            }
                            Text("Live routes and tracking will be available when connected.")
                                .font(.caption)
                                .foregroundStyle(FanStyle.muted)
                        }
                        .transition(reduceMotion ? .opacity : .move(edge: .bottom).combined(with: .opacity))
                    }
                }
                .padding(.horizontal, 20)
                .padding(.top, 12)
                .padding(.bottom, 28)
                .frame(maxWidth: 520)
                .frame(maxWidth: .infinity)
            }
            .frame(maxHeight: showRoutes ? 540 : 316)
            .scrollDismissesKeyboard(.interactively)
            .scrollIndicators(.hidden)
            .background(FanStyle.background.opacity(0.97), in: UnevenRoundedRectangle(topLeadingRadius: 28, topTrailingRadius: 28))
            .overlay(alignment: .top) {
                UnevenRoundedRectangle(topLeadingRadius: 28, topTrailingRadius: 28)
                    .strokeBorder(FanStyle.teal.opacity(0.25), lineWidth: 1)
                    .allowsHitTesting(false)
            }
            .shadow(color: .black.opacity(0.5), radius: 18, y: -10)
        }
        .background(FanStyle.background)
    }
}

private struct TravelMapView: View {
    var body: some View {
        Map(initialPosition: .region(MKCoordinateRegion(
            center: CLLocationCoordinate2D(latitude: 1.2868, longitude: 103.8545),
            span: MKCoordinateSpan(latitudeDelta: 0.065, longitudeDelta: 0.065)
        )))
        .mapStyle(.standard(emphasis: .muted))
        .mapControlVisibility(.hidden)
    }
}
