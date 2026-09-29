import SwiftUI

enum FanMotion {
    static let quick = Animation.easeInOut(duration: 0.22)
    static let content = Animation.easeInOut(duration: 0.34)
    static let page = Animation.easeOut(duration: 0.36)
    static let sheet = Animation.spring(response: 0.42, dampingFraction: 0.86)

    static func pageTransition(direction: PageDirection, reduceMotion: Bool) -> AnyTransition {
        guard !reduceMotion else { return .opacity }

        let distance: CGFloat = direction == .forward ? 24 : -24
        let insertion = AnyTransition.offset(x: distance)
            .combined(with: .opacity)
        let removal = AnyTransition.offset(x: -distance)
            .combined(with: .opacity)
        return .asymmetric(insertion: insertion, removal: removal)
    }
}

enum PageDirection {
    case forward
    case backward
}

struct FanPressStyle: ButtonStyle {
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .scaleEffect(configuration.isPressed && !reduceMotion ? 0.98 : 1)
            .opacity(configuration.isPressed && !reduceMotion ? 0.92 : 1)
            .animation(FanMotion.quick, value: configuration.isPressed)
    }
}
