import SwiftUI
import MapKit

struct TravelScreen: View {
    @State private var origin = ""
    @State private var destination = ""
    @State private var direction = "Outbound"
    @State private var showRoutes = false
    @State private var selectedMode: String?

    private let modes: [(name: String, symbol: String, detail: String)] = [
        ("Transit", "tram.fill", "Bus · rail · walk"),
        ("Walk", "figure.walk", "On foot"),
        ("Cycle", "bicycle", "By bike"),
        ("Cab", "car.fill", "Direct ride")
    ]

    var body: some View {
        ZStack(alignment: .bottom) {
            VStack(spacing: 0) {
                Map(initialPosition: .region(MKCoordinateRegion(
                    center: CLLocationCoordinate2D(latitude: 1.2868, longitude: 103.8545),
                    span: MKCoordinateSpan(latitudeDelta: 0.065, longitudeDelta: 0.065)
                )))
                .mapStyle(.standard(emphasis: .muted))
                .mapControlVisibility(.hidden)
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
                Label("Singapore · Map preview", systemImage: "map.fill")
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
                                withAnimation(.easeInOut(duration: 0.25)) { direction = option }
                            } label: {
                                Label(option, systemImage: option == "Outbound" ? "arrow.up.right" : "arrow.down.left")
                                    .font(.caption.bold())
                                    .frame(maxWidth: .infinity)
                                    .padding(12)
                                    .background(direction == option ? FanStyle.darkTeal : .white.opacity(0.07), in: Capsule())
                                    .overlay(Capsule().strokeBorder(direction == option ? FanStyle.teal : .clear))
                            }
                            .buttonStyle(.plain)
                        }
                    }

                    FanButton(title: showRoutes ? "Hide options" : "Travel options", symbol: "arrow.right") {
                        withAnimation(.easeInOut(duration: 0.35)) { showRoutes.toggle() }
                    }

                    if showRoutes {
                        ForEach(modes, id: \.name) { mode in
                            Button {
                                withAnimation(.easeInOut(duration: 0.2)) { selectedMode = mode.name }
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
                            .buttonStyle(.plain)
                        }
                        Text("Preview only · No live routes or tracking.")
                            .font(.caption).foregroundStyle(FanStyle.muted)
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
