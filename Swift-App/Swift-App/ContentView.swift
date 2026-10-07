import SwiftUI
import UIKit

private struct PendingPhoto: Identifiable {
    let id = UUID()
    let image: UIImage
    let capture: PhotoCapture
}

struct ContentView: View {
    @AppStorage("supportedDriver") private var supportedDriver = ""
    @AppStorage("hasCompletedAccountSetup") private var hasCompletedAccountSetup = false
    @AppStorage("profileSetupSkipped") private var profileSetupSkipped = ""
    @AppStorage("hasSeenFeatureTour") private var hasSeenFeatureTour = false
    @State private var introCompletedThisLaunch = false
    @State private var onboardingCompletedThisLaunch = false
    @State private var selectedTab: FanTab = .home
    @State private var destination: FanDestination?
    @State private var pushedDestination: FanDestination?
    @State private var showShop = false
    @State private var showCameraCapture = false
    @State private var capturedPhoto: PendingPhoto?
    @State private var verificationPhoto: PendingPhoto?
    @State private var retakeCameraAfterVerification = false
    @State private var showFeatureTour = false
    @State private var replayTourAfterDismiss = false
    @State private var demoState: DemoFanState
    @StateObject private var backend = BackendSession()
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    private var driver: Driver? { Driver(rawValue: supportedDriver) }

    init() {
        let defaults = UserDefaults.standard
        var state = DemoFanState(greenPoints: defaults.integer(forKey: "demoGreenPoints"))
        state.currentStreak = defaults.integer(forKey: "demoCurrentStreak")
        state.lastActivityDay = defaults.string(forKey: "demoLastActivityDay")
        state.lastQuizRewardDay = defaults.string(forKey: "demoLastQuizRewardDay")
        if let data = defaults.data(forKey: "demoSubmittedChallenges"),
           let submittedChallenges = try? JSONDecoder().decode([SubmittedChallenge].self, from: data) {
            state.submittedChallenges = submittedChallenges
        }
        _demoState = State(initialValue: state)
    }

    var body: some View {
        NavigationStack {
        ZStack {
            FanStyle.background.ignoresSafeArea()

            if !hasCompletedAccountSetup && !introCompletedThisLaunch {
                F1IntroScreen {
                    withAnimation(reduceMotion ? nil : FanMotion.page) {
                        introCompletedThisLaunch = true
                    }
                }
                .transition(.opacity)
            } else if !hasCompletedAccountSetup && !onboardingCompletedThisLaunch {
                FirstRunOnboardingScreen {
                    withAnimation(reduceMotion ? nil : FanMotion.page) {
                        onboardingCompletedThisLaunch = true
                    }
                }
                .transition(.opacity)
            } else if let driver, backend.isConnected, let profile = backend.realProfile, profile.needsProfileSetup, profileSetupSkipped != profile.id {
                ProfileSetupScreen(
                    profile: profile,
                    save: { name, email, birthday in
                        await backend.updateProfile(displayName: name.isEmpty ? nil : name, email: email.isEmpty ? nil : email, birthday: birthday.isEmpty ? nil : birthday)
                        return backend.errorMessage
                    },
                    skip: { profileSetupSkipped = profile.id }
                )
                .transition(.opacity)
            } else if let driver, backend.isConnected {
                TabView(selection: $selectedTab) {
                    HomeScreen(driver: driver, demoState: demoState, profile: backend.realProfile, open: openPage, openCamera: openCamera)
                        .tabItem { Label(FanTab.home.rawValue, systemImage: FanTab.home.symbol) }
                        .tag(FanTab.home)

                    RewardsScreen(driver: driver, demoState: $demoState, open: openPage)
                        .tabItem { Label(FanTab.rewards.rawValue, systemImage: FanTab.rewards.symbol) }
                        .tag(FanTab.rewards)

                    ImpactScreen(demoState: demoState, open: openPage)
                        .tabItem { Label(FanTab.impact.rawValue, systemImage: FanTab.impact.symbol) }
                        .tag(FanTab.impact)

                    TravelScreen(onExitToHome: { selectTab(.home) })
                        .tabItem { Label(FanTab.travel.rawValue, systemImage: FanTab.travel.symbol) }
                        .tag(FanTab.travel)
                }
                .tint(FanStyle.navigationTeal)
                .tabViewStyle(.page(indexDisplayMode: .never))
                .overlay(alignment: .bottom) {
                    if selectedTab != .travel {
                        BottomBar(
                            selectedTab: $selectedTab,
                            openTravel: {
                                withAnimation(reduceMotion ? nil : FanMotion.page) {
                                    selectedTab = .travel
                                }
                            },
                            selectTab: selectTab
                        )
                    }
                }
                .transition(.opacity)
            } else if driver != nil {
                LoginGateScreen(openAuthentication: openAuthentication)
                    .transition(.opacity)
            } else {
                DriverSelectionScreen(select: { choice in
                    withAnimation(reduceMotion ? nil : FanMotion.page) {
                        supportedDriver = choice.rawValue
                    }
                })
                .transition(.opacity)
            }
        }
        .toolbar(.hidden, for: .navigationBar)
        .toolbar(.hidden, for: .tabBar)
        .navigationDestination(isPresented: $showShop) {
            ShopScreen(driver: driver, demoState: $demoState, category: .all)
        }
        .navigationDestination(item: $pushedDestination) { page in
            destinationView(for: page)
                .toolbar(.visible, for: .navigationBar)
        }
        }
        .environmentObject(backend)
        .preferredColorScheme(.dark)
        .task {
            await backend.resume()
            if let balance = backend.realProfile?.balance { demoState.greenPoints = balance }
        }
        .onChange(of: backend.isConnected) { _, isConnected in
            if isConnected {
                hasCompletedAccountSetup = true
            }
        }
        .onChange(of: backend.realProfile?.balance) { _, balance in
            if let balance { demoState.greenPoints = balance }
        }
        .onChange(of: demoState.greenPoints) { _, value in
            UserDefaults.standard.set(value, forKey: "demoGreenPoints")
        }
        .onChange(of: demoState.submittedChallenges) { _, value in
            if let data = try? JSONEncoder().encode(value) {
                UserDefaults.standard.set(data, forKey: "demoSubmittedChallenges")
            }
        }
        .onChange(of: demoState.currentStreak) { _, value in
            UserDefaults.standard.set(value, forKey: "demoCurrentStreak")
        }
        .onChange(of: demoState.lastActivityDay ?? "") { _, value in
            UserDefaults.standard.set(value, forKey: "demoLastActivityDay")
        }
        .onChange(of: demoState.lastQuizRewardDay ?? "") { _, value in
            UserDefaults.standard.set(value, forKey: "demoLastQuizRewardDay")
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
        .fullScreenCover(isPresented: $showCameraCapture, onDismiss: {
            if let capturedPhoto {
                verificationPhoto = capturedPhoto
                self.capturedPhoto = nil
            }
        }) {
            CameraPicker { image, capture in
                capturedPhoto = PendingPhoto(image: image, capture: capture)
                showCameraCapture = false
            } onCancel: {
                showCameraCapture = false
            }
            .ignoresSafeArea()
        }
        .fullScreenCover(item: $verificationPhoto, onDismiss: {
            guard retakeCameraAfterVerification else { return }
            retakeCameraAfterVerification = false
            showCameraCapture = true
        }) { photo in
            SustainabilityCamScreen(
                initialImage: photo.image,
                initialCapture: photo.capture,
                backend: backend,
                onRetake: {
                    retakeCameraAfterVerification = true
                    verificationPhoto = nil
                }
            )
        }
    }

    private func openPage(_ page: FanDestination) {
        if page == .offers {
            showShop = true
        } else if page == .travel {
            withAnimation(reduceMotion ? nil : FanMotion.page) {
                selectedTab = .travel
            }
        } else if page == .tree {
            pushedDestination = page
        } else {
            destination = page
        }
    }

    private func selectTab(_ tab: FanTab) {
        withAnimation(reduceMotion ? nil : FanMotion.page) {
            selectedTab = tab
        }
    }

    private func openCamera() {
        capturedPhoto = nil
        showCameraCapture = true
    }

    private func openAuthentication() {
        destination = .account
    }

    @ViewBuilder
    private func destinationView(for page: FanDestination) -> some View {
        switch page {
        case .profile:
            ProfileScreen(backend: backend, driver: driver ?? .alonso, streak: demoState.currentStreak, greenPoints: demoState.greenPoints, changeDriver: { supportedDriver = "" },
                          showTour: {
                              replayTourAfterDismiss = true
                              destination = nil
                          })
        case .account:
            AccountScreen(backend: backend)
        case .news:
            NewsFeedScreen()
        case .paddock:
            EditorialScreen(title: "The Paddock.", symbol: "sparkles.tv",
                            description: "Exclusive stories are coming soon.")
        case .travel:
            TravelScreen()
        case .challenges:
            ChallengesScreen(demoState: $demoState)
        case .history:
            HistoryScreen()
        case .tree:
            TreeScreen(demoState: $demoState)
        case .offers:
            ShopScreen(driver: driver, demoState: $demoState, category: .all)
        case .caps:
            ShopScreen(driver: driver, demoState: $demoState, category: .caps)
        case .tshirts:
            ShopScreen(driver: driver, demoState: $demoState, category: .tshirts)
        case .outerwear:
            ShopScreen(driver: driver, demoState: $demoState, category: .outerwear)
        case .other:
            ShopScreen(driver: driver, demoState: $demoState, category: .other)
        case .content:
            EditorialScreen(title: "Exclusive.", symbol: "play.rectangle.fill",
                            description: "Team stories, coming soon.")
        case .quiz:
            QuizScreen(demoState: $demoState)
        }
    }
}

#Preview {
    ContentView()
}
