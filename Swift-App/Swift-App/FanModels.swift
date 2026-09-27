import SwiftUI

enum FanStyle {
    static let background = Color(red: 10 / 255, green: 10 / 255, blue: 10 / 255)
    static let panel = Color(red: 30 / 255, green: 32 / 255, blue: 32 / 255)
    static let teal = Color(red: 69 / 255, green: 152 / 255, blue: 143 / 255)
    static let darkTeal = Color(red: 34 / 255, green: 39 / 255, blue: 39 / 255)
    static let muted = Color(red: 0.63, green: 0.69, blue: 0.67)
    static let streakGradient = LinearGradient(
        colors: [.orange, .red.opacity(0.1)],
        startPoint: .topLeading,
        endPoint: .bottomTrailing
    )
}

enum Driver: String, CaseIterable, Identifiable {
    case alonso = "Alonso"
    case stroll = "Stroll"

    var id: String { rawValue }
    var number: String { self == .alonso ? "14" : "18" }
    var imageName: String { self == .alonso ? "AlonsoCard" : "StrollCard" }
    var firstName: String { self == .alonso ? "Fernando" : "Lance" }
}

enum FanTab: String, CaseIterable, Identifiable {
    case home = "Home"
    case rewards = "Rewards"
    case impact = "Impact"

    var id: String { rawValue }
    var symbol: String {
        switch self {
        case .home: "house.fill"
        case .rewards: "gift.fill"
        case .impact: "tree.fill"
        }
    }
}

enum FanDestination: String, Identifiable {
    case profile, account, news, paddock, gallery, travel, challenges, history, tree, offers, content, quiz

    var id: String { rawValue }
}
