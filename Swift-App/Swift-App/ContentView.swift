import SwiftUI
import UIKit
import PhotosUI

private struct PendingPhoto: Identifiable {
    let id = UUID()
    let image: UIImage
    let capture: PhotoCapture
}

struct ContentView: View {
    @AppStorage("supportedDriver") private var supportedDriver = ""
    @AppStorage("hasCompletedAccountSetup") private var hasCompletedAccountSetup = false
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
    @State private var showGalleryPicker = false
    @State private var selectedGalleryItem: PhotosPickerItem?
    @State private var showFeatureTour = false
    @State private var showAuthenticationHandoff = false
    @State private var replayTourAfterDismiss = false
    @State private var demoState: DemoFanState
    @StateObject private var backend = BackendSession()
    @State private var tabDirection: PageDirection = .forward
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    private var driver: Driver? { Driver(rawValue: supportedDriver) }

    init() {
        let defaults = UserDefaults.standard
        var state = DemoFanState(greenPoints: defaults.integer(forKey: "demoGreenPoints"))
        state.currentStreak = defaults.integer(forKey: "demoCurrentStreak")
        state.lastActivityDay = defaults.string(forKey: "demoLastActivityDay")
        state.lastQuizRewardDay = defaults.string(forKey: "demoLastQuizRewardDay")
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
            } else if let driver, backend.isConnected {
                ZStack {
                    Group {
                        switch selectedTab {
                        case .home:
                            HomeScreen(driver: driver, demoState: demoState, open: openPage, openCamera: openCamera)
                        case .rewards:
                            RewardsScreen(driver: driver, demoState: $demoState, open: openPage)
                        case .impact:
                            ImpactScreen(demoState: demoState, open: openPage)
                        }
                    }
                    .id(selectedTab)
                    .transition(FanMotion.pageTransition(direction: tabDirection, reduceMotion: reduceMotion))
                }
                .frame(maxWidth: .infinity, maxHeight: .infinity)
                .overlay(alignment: .bottom) {
                    BottomBar(selectedTab: $selectedTab, openTravel: { pushedDestination = .travel }, selectTab: selectTab)
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
                }, openAccount: openAuthentication)
                .transition(.opacity)
            }
        }
        .toolbar(.hidden, for: .navigationBar)
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
        .task { await backend.resume() }
        .onChange(of: backend.isConnected) { _, isConnected in
            if isConnected {
                hasCompletedAccountSetup = true
            }
        }
        .onChange(of: demoState.greenPoints) { _, value in
            UserDefaults.standard.set(value, forKey: "demoGreenPoints")
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
        .alert("Authentication pages pending", isPresented: $showAuthenticationHandoff) {
            Button("Close", role: .cancel) { }
        } message: {
            Text("The real sign-in and sign-up screens from the separate auth thread should be presented here.")
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
            CameraPicker { image in
                capturedPhoto = PendingPhoto(image: image, capture: .camera)
                showCameraCapture = false
            }
            .ignoresSafeArea()
        }
        .photosPicker(isPresented: $showGalleryPicker, selection: $selectedGalleryItem, matching: .images)
        .task(id: selectedGalleryItem) {
            guard let selectedGalleryItem else { return }
            guard let data = try? await selectedGalleryItem.loadTransferable(type: Data.self),
                  let image = PhotoUploadEncoder.downsampledImage(data: data), !Task.isCancelled else { return }
            verificationPhoto = PendingPhoto(image: image, capture: .gallery)
        }
        .fullScreenCover(item: $verificationPhoto) { photo in
            SustainabilityCamScreen(
                initialImage: photo.image,
                initialCapture: photo.capture,
                backend: backend
            )
        }
    }

    private func selectTab(_ tab: FanTab) {
        guard tab != selectedTab else { return }
        tabDirection = tabIndex(tab) >= tabIndex(selectedTab) ? .forward : .backward
        withAnimation(reduceMotion ? nil : FanMotion.page) {
            selectedTab = tab
        }
    }

    private func tabIndex(_ tab: FanTab) -> Int {
        FanTab.allCases.firstIndex(of: tab) ?? 0
    }

    private func openPage(_ page: FanDestination) {
        if page == .offers {
            showShop = true
        } else if page == .travel || page == .tree {
            pushedDestination = page
        } else {
            destination = page
        }
    }

    private func openCamera() {
        capturedPhoto = nil
        if UIImagePickerController.isSourceTypeAvailable(.camera) {
            showCameraCapture = true
        } else {
            selectedGalleryItem = nil
            showGalleryPicker = true
        }
    }

    private func openAuthentication() {
        // TODO: Present the real sign-in/sign-up pages from the separate auth thread here.
        // That flow must establish BackendSession; its connected state persists the bypass.
        showAuthenticationHandoff = true
    }

    @ViewBuilder
    private func destinationView(for page: FanDestination) -> some View {
        switch page {
        case .profile:
            ProfileScreen(backend: backend, driver: driver ?? .alonso, changeDriver: { supportedDriver = "" },
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
