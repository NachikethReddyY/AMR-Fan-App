import SwiftUI

struct ContentView: View {
    @AppStorage("supportedDriver") private var supportedDriver = ""
    @AppStorage("hasSeenFeatureTour") private var hasSeenFeatureTour = false
    @State private var selectedTab: FanTab = .home
    @State private var destination: FanDestination?
    @State private var showShop = false
    @State private var showFeatureTour = false
    @State private var replayTourAfterDismiss = false

    private var driver: Driver? { Driver(rawValue: supportedDriver) }

    var body: some View {
        NavigationStack {
        ZStack {
            FanStyle.background.ignoresSafeArea()

            if let driver {
                ZStack {
                    switch selectedTab {
                    case .home:
                        HomeScreen(driver: driver, open: openPage)
                            .transition(.opacity)
                    case .rewards:
                        RewardsScreen(open: openPage)
                            .transition(.opacity)
                    case .impact:
                        ImpactScreen(open: openPage)
                            .transition(.opacity)
                    }
                }
                .frame(maxWidth: .infinity, maxHeight: .infinity)
                .animation(.easeInOut(duration: 0.22), value: selectedTab)
                .overlay(alignment: .bottom) {
                    BottomBar(selectedTab: $selectedTab, openTravel: { destination = .travel })
                }
                .transition(.opacity)
            } else {
                DriverSelectionScreen(select: { choice in
                    withAnimation(.easeInOut(duration: 0.45)) {
                        supportedDriver = choice.rawValue
                    }
                    if !hasSeenFeatureTour { showFeatureTour = true }
                }, openAccount: { destination = .account })
                .transition(.opacity)
            }
        }
        .toolbar(.hidden, for: .navigationBar)
        .navigationDestination(isPresented: $showShop) {
            ShopScreen()
        }
        }
        .preferredColorScheme(.dark)
        .onAppear {
            if driver != nil && !hasSeenFeatureTour { showFeatureTour = true }
        }
        .sheet(isPresented: $showFeatureTour, onDismiss: { hasSeenFeatureTour = true }) {
            FeatureTourScreen {
                hasSeenFeatureTour = true
                showFeatureTour = false
            }
            .preferredColorScheme(.dark)
        }
        .sheet(item: $destination, onDismiss: {
            if replayTourAfterDismiss {
                replayTourAfterDismiss = false
                showFeatureTour = true
            }
        }) { page in
            NavigationStack {
                destinationView(for: page)
                    .toolbar {
                        ToolbarItem(placement: .primaryAction) {
                            Button("Close", systemImage: "xmark") { destination = nil }
                                .labelStyle(.iconOnly)
                                .tint(.white)
                        }
                    }
            }
            .preferredColorScheme(.dark)
        }
    }

    private func openPage(_ page: FanDestination) {
        if page == .offers {
            showShop = true
        } else {
            destination = page
        }
    }

    @ViewBuilder
    private func destinationView(for page: FanDestination) -> some View {
        switch page {
        case .profile:
            ProfileScreen(driver: driver ?? .alonso, changeDriver: { supportedDriver = "" },
                          showTour: {
                              replayTourAfterDismiss = true
                              destination = nil
                          })
        case .account:
            AccountScreen()
        case .news:
            EditorialScreen(title: "News.", symbol: "newspaper.fill",
                            description: "Team stories are coming soon.")
        case .paddock:
            EditorialScreen(title: "The Paddock.", symbol: "sparkles.tv",
                            description: "Exclusive stories are coming soon.")
        case .gallery:
            EditorialScreen(title: "Gallery.", symbol: "camera.fill",
                            description: "Moments from the circuit.")
        case .travel:
            TravelScreen()
        case .challenges:
            ChallengesScreen()
        case .history:
            HistoryScreen()
        case .tree:
            TreeScreen()
        case .offers:
            ShopScreen()
        case .content:
            EditorialScreen(title: "Exclusive.", symbol: "play.rectangle.fill",
                            description: "Team stories, coming soon.")
        case .quiz:
            QuizScreen()
        }
    }
}

#Preview {
    ContentView()
}
