import SwiftUI

struct FirstRunOnboardingScreen: View {
    let complete: () -> Void
    @State private var step = 0
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    private let pages: [(symbol: String, title: String, detail: String)] = [
        ("house.fill", "Your home", "Follow Aston Martin and keep your fan activity in one place."),
        ("leaf.fill", "Travel with impact", "Explore lower-impact ways to reach race weekends and track your estimates."),
        ("gift.fill", "Earn your way in", "Collect points through fan activities and use them on rewards.")
    ]

    var body: some View {
        VStack(alignment: .leading, spacing: 18) {
            HStack {
                HStack(spacing: 6) {
                    ForEach(pages.indices, id: \.self) { index in
                        Capsule()
                            .fill(index == step ? FanStyle.teal : .white.opacity(0.2))
                            .frame(width: index == step ? 25 : 7, height: 7)
                    }
                }
                Spacer()
                Button("Skip", action: complete)
                    .font(.subheadline)
                    .foregroundStyle(FanStyle.muted)
            }

            VStack(alignment: .leading, spacing: 18) {
                Image(systemName: pages[step].symbol)
                    .font(.system(size: 35))
                    .foregroundStyle(FanStyle.teal)
                    .frame(height: 48)
                    .accessibilityHidden(true)

                Text(pages[step].title)
                    .font(.system(size: 30, weight: .bold, design: .rounded))

                Text(pages[step].detail)
                    .font(.body)
                    .foregroundStyle(FanStyle.muted)
                    .fixedSize(horizontal: false, vertical: true)
            }
            .id(step)
            .transition(reduceMotion ? .opacity : .push(from: .trailing))

            Spacer(minLength: 0)

            Button {
                if step == pages.count - 1 {
                    complete()
                } else {
                    withAnimation(reduceMotion ? nil : FanMotion.content) { step += 1 }
                }
            } label: {
                HStack {
                    Text(step == pages.count - 1 ? "Choose your driver" : "Next")
                    Spacer()
                    Image(systemName: "arrow.right")
                }
                .font(.headline)
                .foregroundStyle(.black)
                .padding(17)
                .background(FanStyle.teal, in: RoundedRectangle(cornerRadius: 15))
            }
            .buttonStyle(FanPressStyle())
        }
        .padding(25)
        .background(FanStyle.background.ignoresSafeArea())
        .preferredColorScheme(.dark)
    }
}

#Preview {
    FirstRunOnboardingScreen(complete: {})
}
