import SwiftUI

struct OnboardingProgressBar: View {
    let currentStep: Int
    let totalSteps: Int

    var body: some View {
        HStack(spacing: 5) {
            ForEach(0..<totalSteps, id: \.self) { index in
                Capsule()
                    .fill(index <= currentStep ? FanStyle.astonGreen : .white.opacity(0.2))
                    .frame(maxWidth: .infinity)
            }
        }
        .frame(width: 112, height: 5)
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("Onboarding progress")
        .accessibilityValue("Step \(currentStep + 1) of \(totalSteps)")
    }
}

struct SectionHeader: View {
    let title: String
    let description: String

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            Text(title)
                .font(.system(size: 38, weight: .bold, design: .rounded))
                .tracking(-1.6)
                .foregroundStyle(.white)
            Text(description)
                .font(.subheadline)
                .foregroundStyle(FanStyle.muted)
                .fixedSize(horizontal: false, vertical: true)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }
}

struct FeatureCard<Content: View>: View {
    let content: Content

    init(@ViewBuilder content: () -> Content) {
        self.content = content()
    }

    var body: some View {
        content
            .padding(20)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(FanStyle.panel, in: RoundedRectangle(cornerRadius: 22))
            .overlay(RoundedRectangle(cornerRadius: 22).strokeBorder(.white.opacity(0.06)))
    }
}

struct FanButton: View {
    let title: String
    let symbol: String
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            HStack {
                Text(title)
                Spacer()
                Image(systemName: symbol)
                    .foregroundStyle(.white)
            }
            .font(.system(size: 15, weight: .bold))
            .foregroundStyle(.white)
            .padding(18)
            .background(FanStyle.darkTeal, in: RoundedRectangle(cornerRadius: 16))
            .overlay(RoundedRectangle(cornerRadius: 16).strokeBorder(FanStyle.teal.opacity(0.5)))
        }
        .buttonStyle(FanPressStyle())
    }
}
