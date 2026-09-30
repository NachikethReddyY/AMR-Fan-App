import SwiftUI

struct F1IntroScreen: View {
    let complete: () -> Void

    private enum Phase { case words, carRun, message }
    @State private var phase: Phase = .words
    @State private var showTo = false
    @State private var wordsVisible = false
    @State private var carProgress: CGFloat = 0
    @State private var wipeProgress: CGFloat = 0
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    var body: some View {
        GeometryReader { geometry in
            ZStack {
                FanStyle.background

                switch phase {
                case .words:
                    ZStack {
                        Text("WELCOME!")
                            .font(.system(size: 36, weight: .black).width(.expanded).italic())
                            .tracking(-1.5)
                            .opacity(showTo ? 0 : 1)
                            .scaleEffect(showTo ? 0.38 : 1)
                            .offset(x: showTo && !reduceMotion ? geometry.size.width * 0.35 : 0)
                        Text("to")
                            .font(.system(size: 64, weight: .black).width(.expanded).italic())
                            .opacity(showTo ? 1 : 0)
                            .scaleEffect(showTo || reduceMotion ? 1 : 2.4)
                    }
                    .padding(.horizontal, 22)
                    .opacity(wordsVisible ? 1 : 0)
                    .offset(x: wordsVisible || reduceMotion ? 0 : -geometry.size.width)
                case .carRun:
                    CarTrailFrame(progress: carProgress, size: geometry.size)
                case .message:
                    ZStack {
                        FanStyle.background
                        Text("Your fan experience awaits")
                            .font(.system(size: 31, weight: .black).width(.expanded).italic())
                            .accessibilityLabel("Your fan experience awaits")
                            .multilineTextAlignment(.center)
                            .padding(.horizontal, 28)
                        FanStyle.introGreen
                            .frame(width: geometry.size.width, height: geometry.size.height)
                            .offset(y: -geometry.size.height * wipeProgress)
                    }
                }
            }
            .frame(width: geometry.size.width, height: geometry.size.height)
            .clipped()
        }
        .ignoresSafeArea()
        .foregroundStyle(.white)
        .statusBarHidden()
        .task { await runSequence() }
    }

    private func runSequence() async {
        do {
            withAnimation(reduceMotion ? nil : .spring(duration: 0.65, bounce: 0.12)) {
                wordsVisible = true
            }
            try await pause(1_450)
            withAnimation(reduceMotion ? nil : .spring(duration: 0.55, bounce: 0.08)) {
                showTo = true
            }
            try await pause(950)
            withAnimation(reduceMotion ? nil : .easeOut(duration: 0.2)) {
                wordsVisible = false
            }
            try await pause(250)
            phase = .carRun
            // Mount the fully offscreen starting frame before starting the run.
            try await pause(100)
            withAnimation(reduceMotion ? nil : .timingCurve(0.38, 0.0, 0.75, 0.7, duration: 1.65)) {
                carProgress = 1
            }
            try await pause(reduceMotion ? 1_500 : 1_650)
            try await pause(450)
            phase = .message
            withAnimation(reduceMotion ? nil : .easeInOut(duration: 1.05)) {
                wipeProgress = 1
            }
            try await pause(reduceMotion ? 500 : 1_050)
            try await pause(1_650)
            complete()
        } catch {
            // A dismissed intro must not advance onboarding after cancellation.
        }
    }

    private func pause(_ milliseconds: UInt64) async throws {
        try await Task.sleep(nanoseconds: milliseconds * 1_000_000)
    }
}

/// One interpolated value positions both the car and the rectangular paint edge.
private struct CarTrailFrame: View, Animatable {
    var progress: CGFloat
    let size: CGSize

    var animatableData: CGFloat {
        get { progress }
        set { progress = newValue }
    }

    var body: some View {
        let carHeight = size.height * 0.32
        let startY = size.height + carHeight / 2 + 8
        let endY = -carHeight / 2 - 40
        let carY = startY + (endY - startY) * progress
        // The asset faces down. After rotation, the rear tires end at ~82%.
        let rearWheelY = carY + carHeight * 0.32
        let trailTop = min(size.height, max(0, rearWheelY))
        let trailHeight = size.height - trailTop
        let teamOpacity = min(1, max(0, (progress - 0.75) / 0.08))
        let carWidth = carHeight * 572 / 1328

        ZStack(alignment: .topLeading) {
            Rectangle()
                .fill(FanStyle.introGreen)
                .frame(width: size.width, height: trailHeight)
                .offset(y: trailTop)
                .accessibilityHidden(true)

            Image("AMR26Car")
                .resizable()
                .scaledToFit()
                .frame(width: carWidth, height: carHeight)
                .position(x: size.width / 2, y: carY)
                .accessibilityLabel("Aston Martin Formula One car")

            Text("ASTON MARTIN")
                .font(.system(size: 23, weight: .black).width(.expanded).italic())
                .tracking(1)
                .foregroundStyle(.white)
                .position(x: size.width / 2, y: size.height / 2)
                .opacity(teamOpacity)
        }
        .frame(width: size.width, height: size.height)
    }
}

#Preview {
    F1IntroScreen(complete: {})
}
