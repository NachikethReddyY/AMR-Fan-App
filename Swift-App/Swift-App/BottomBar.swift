import SwiftUI

struct BottomBar: View {
    @Binding var selectedTab: FanTab
    let openTravel: () -> Void
    let selectTab: (FanTab) -> Void

    var body: some View {
        HStack(spacing: 10) {
            HStack(spacing: 0) {
                ForEach([FanTab.home, .rewards, .impact]) { tab in
                    Button {
                        selectTab(tab)
                    } label: {
                        VStack(spacing: 3) {
                            Image(systemName: tab.symbol)
                                .font(.system(size: 19, weight: .semibold))
                            Text(tab.rawValue)
                                .font(.caption2.weight(.semibold))
                        }
                        .foregroundStyle(selectedTab == tab ? FanStyle.navigationTeal : Color.white.opacity(0.92))
                        .frame(maxWidth: .infinity)
                        .frame(minHeight: 56)
                        .background {
                            if selectedTab == tab {
                                Capsule()
                                    .fill(Color.black.opacity(0.30))
                                    .padding(4)
                            }
                        }
                    }
                    .buttonStyle(FanPressStyle())
                    .accessibilityLabel(tab.rawValue)
                    .accessibilityAddTraits(selectedTab == tab ? .isSelected : [])
                }
            }
            .background(Capsule().fill(.regularMaterial))
            .overlay(Capsule().stroke(Color.white.opacity(0.24), lineWidth: 1))

            Button(action: openTravel) {
                Image(systemName: FanTab.travel.symbol)
                    .font(.system(size: 20, weight: .semibold))
                    .foregroundStyle(selectedTab == .travel ? FanStyle.navigationTeal : Color.white.opacity(0.92))
                    .frame(width: 58, height: 58)
                    .background(Circle().fill(.regularMaterial))
                    .overlay {
                        Circle().stroke(
                            selectedTab == .travel ? FanStyle.navigationTeal.opacity(0.9) : Color.white.opacity(0.24),
                            lineWidth: selectedTab == .travel ? 2 : 1
                        )
                    }
            }
            .buttonStyle(FanPressStyle())
            .accessibilityLabel("Travel")
            .accessibilityAddTraits(selectedTab == .travel ? .isSelected : [])
        }
        .padding(.horizontal, 18)
        .padding(.vertical, 8)
        .shadow(color: .black.opacity(0.35), radius: 16, y: 6)
    }
}
