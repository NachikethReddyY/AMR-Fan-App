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
                OnboardingProgressBar(currentStep: step, totalSteps: pages.count)
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
                Text(step == pages.count - 1 ? "Choose your driver" : "Next")
                    .frame(maxWidth: .infinity)
                .font(.headline)
                .foregroundStyle(.white)
                .padding(.vertical, 17)
                .background(FanStyle.astonGreen, in: RoundedRectangle(cornerRadius: 2))
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
