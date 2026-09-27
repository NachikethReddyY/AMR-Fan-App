import SwiftUI

struct BottomBar: View {
    @Binding var selectedTab: FanTab
    let openTravel: () -> Void

    var body: some View {
        HStack(spacing: 9) {
            HStack(spacing: 0) {
                ForEach(FanTab.allCases) { tab in
                    Button {
                        selectedTab = tab
                    } label: {
                        VStack(spacing: 2) {
                            Image(systemName: tab.symbol)
                                .font(.system(size: 23, weight: .bold))
                                .foregroundStyle(selectedTab == tab ? FanStyle.teal : .white.opacity(0.8))
                            Text(tab.rawValue)
                                .font(.system(size: 10, weight: .semibold))
                                .foregroundStyle(selectedTab == tab ? FanStyle.teal : .white.opacity(0.75))
                        }
                        .frame(maxWidth: .infinity)
                        .frame(height: 52)
                        .background(selectedTab == tab ? .white.opacity(0.13) : .clear, in: Capsule())
                    }
                    .buttonStyle(.plain)
                }
            }
            .padding(4)
            .background(Color(red: 0.14, green: 0.15, blue: 0.15).opacity(0.97), in: Capsule())
            .overlay(Capsule().strokeBorder(.white.opacity(0.2), lineWidth: 1))

            Button(action: openTravel) {
                Image(systemName: "paperplane.fill")
                    .font(.system(size: 26))
                    .foregroundStyle(.white)
                    .frame(width: 62, height: 62)
                    .background(Color(red: 0.14, green: 0.15, blue: 0.15).opacity(0.97), in: Circle())
                    .overlay(Circle().strokeBorder(.white.opacity(0.2), lineWidth: 1))
            }
            .accessibilityLabel("Plan a journey")
        }
        .padding(.horizontal, 20)
        .padding(.top, 8)
        .padding(.bottom, 8)
        .shadow(color: .black.opacity(0.55), radius: 18, y: 5)
    }
}
