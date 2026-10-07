import SwiftUI
import MapKit
import Observation

struct TravelScreen: View {
    var onExitToHome: (() -> Void)?
    @State private var originText = ""
    @State private var destinationText = ""
    @State private var origin: MKMapItem?
    @State private var destination: MKMapItem?
    @State private var selectedMode: TravelMode = .transit
    @State private var route: MKRoute?
    @State private var transitTravelTime: TimeInterval?
    @State private var mapPosition: MapCameraPosition = .region(Self.defaultRegion)
    @State private var isCalculatingRoute = false
    @State private var routeError: String?
    @State private var searchModel = PlaceSearchModel()
    @State private var routeRequestID = UUID()
    @State private var plannerState: PlannerState = .collapsed
    @State private var isPlannerPresented = true
    @State private var currentSheetHeight: CGFloat?
    @State private var dragStartSheetHeight: CGFloat?
    @State private var mapHasLoaded = false
    @State private var hasUserMovedMap = false
    @State private var lastViewportState: PlannerState?
    @State private var isApplyingCamera = false
    @State private var cameraAdjustmentTask: Task<Void, Never>?
    @State private var renderedSheetHeight: CGFloat = 190
    @State private var viewportHeight: CGFloat = 1
    @State private var bottomSafeAreaInset: CGFloat = 0
    @State private var compactContentHeight: CGFloat = 120
    @FocusState private var focusedField: PlaceSearchModel.Field?
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @EnvironmentObject private var backend: BackendSession
    @State private var backendRoutes: [BackendRouteOption] = []
    @State private var backendEstimates: [BackendRouteEstimate] = []
    @State private var routeRecommendation: BackendRouteRecommendation?
    @State private var jevRank: BackendJevRank?
    @State private var selectedRouteOptionID: String?
    @State private var selectedBackendRouteID: String?
    @State private var transportPlan: BackendTransportPlan?
    @State private var guidance = NavigationGuidance()
    @State private var showJourneyCompletion = false
    @State private var completionIsDemo = false
    @State private var celebration: JourneyCelebrationSummary?
    @State private var routeRewardRequestID: UUID?
    @State private var routeTask: Task<Void, Never>?

    private static let defaultRegion = MKCoordinateRegion(
        center: CLLocationCoordinate2D(latitude: 1.2868, longitude: 103.8545),
        span: MKCoordinateSpan(latitudeDelta: 0.065, longitudeDelta: 0.065)
    )

    var body: some View {
        ZStack {
            TravelMapView(
                origin: origin,
                destination: destination,
                route: route,
                transportRoute: transportPlan?.routes.first(where: { $0.id == selectedBackendRouteID }) ?? transportPlan?.routes.first,
                mapPosition: $mapPosition,
                onCameraChangeEnded: handleMapCameraChangeEnded
            )

            LinearGradient(
                colors: [FanStyle.background.opacity(0.85), .clear, .clear],
                startPoint: .top,
                endPoint: .bottom
            )
            .ignoresSafeArea()
            .allowsHitTesting(false)

            if mapHasLoaded && (origin == nil || destination == nil) {
                VStack(alignment: .leading, spacing: 8) {
                    Text("Plan your journey")
                        .font(.system(size: 36, weight: .bold, design: .rounded))
                        .tracking(-1.4)
                    Label("Choose where to go", systemImage: "map.fill")
                        .font(.caption.bold())
                        .foregroundStyle(FanStyle.muted)
                    Spacer()
                }
                .padding(.horizontal, 24)
                .padding(.top, onExitToHome == nil ? 25 : 112)
                .frame(maxWidth: .infinity)
                .allowsHitTesting(false)
            }

            if mapHasLoaded, let exit = onExitToHome {
                VStack {
                    Button {
                        exit()
                    } label: {
                        Label("Home", systemImage: "chevron.left")
                            .font(.subheadline.bold())
                            .padding(.horizontal, 14)
                            .padding(.vertical, 8)
                            .background(.black.opacity(0.55), in: Capsule())
                            .overlay(Capsule().stroke(Color.white.opacity(0.24), lineWidth: 1))
                    }
                    .buttonStyle(FanPressStyle())
                    .accessibilityLabel("Back to Home")
                    .padding(.leading, 16)
                    .padding(.top, 64)
                    Spacer()
                }
                .frame(maxWidth: .infinity, alignment: .leading)
            }
        }
        .background(FanStyle.background.ignoresSafeArea())
        .overlay(alignment: .bottom) {
            GeometryReader { geometry in
                let compactHeight = compactContentHeight + 52 + geometry.safeAreaInsets.bottom + 16
                let expandedHeight = max(geometry.size.height - 20, compactHeight)
                let restingHeight = plannerState == .collapsed ? compactHeight : expandedHeight
                let displayedHeight = min(
                    max(currentSheetHeight ?? restingHeight, compactHeight),
                    expandedHeight
                )

                VStack(spacing: 0) {
                    Spacer(minLength: 0)
                    plannerSheet
                        .frame(width: geometry.size.width)
                        .frame(height: displayedHeight, alignment: .top)
                        .onChange(of: displayedHeight) { _, height in
                            renderedSheetHeight = height
                        }
                        .clipShape(
                            UnevenRoundedRectangle(
                                topLeadingRadius: 28,
                                topTrailingRadius: 28
                            )
                        )
                }
                .frame(width: geometry.size.width, height: geometry.size.height)
                .onAppear {
                    viewportHeight = geometry.size.height
                    bottomSafeAreaInset = geometry.safeAreaInsets.bottom
                }
                .onChange(of: geometry.size.height) { _, height in
                    viewportHeight = height
                }
                .onChange(of: geometry.safeAreaInsets.bottom) { _, inset in
                    bottomSafeAreaInset = inset
                }
            }
            .ignoresSafeArea(.container, edges: .bottom)
            .allowsHitTesting(isPlannerPresented)
            .opacity(mapHasLoaded ? 1 : 0)
        }
        .overlay {
            if !mapHasLoaded {
                FanStyle.background
                    .ignoresSafeArea()
            }
        }
        .onChange(of: focusedField) { _, field in
            if let field {
                searchModel.activate(field, query: field == .origin ? originText : destinationText)
            } else {
                searchModel.clear()
            }
        }
        .onChange(of: guidance.state) { _, state in
            if state == .arrived {
                completionIsDemo = false
                withAnimation(reduceMotion ? .easeOut(duration: 0.2) : .spring(response: 0.45, dampingFraction: 0.82)) {
                    showJourneyCompletion = true
                }
            }
        }
        .overlay {
            if showJourneyCompletion {
                JourneyCompletionView(
                    pointsText: transportPlan?.awardEligible == true ? "Pending assessment" : "Not credited",
                    savedText: avoidedKilograms.map { formatKg($0, gas: "CO₂e") } ?? "Unavailable",
                    routeTitle: selectedMode.title,
                    isDemo: completionIsDemo,
                    reduceMotion: reduceMotion,
                    continueAction: {
                        showJourneyCompletion = false
                        completionIsDemo = false
                        guidance.stop()
                        onExitToHome?()
                    }
                )
                .transition(.opacity)
            }
        }
        .overlay {
            if let celebration {
                JourneyCelebrationView(summary: celebration, reduceMotion: reduceMotion) {
                    self.celebration = nil
                    routeRewardRequestID = nil
                    guidance.stop()
                    onExitToHome?()
                }
                .transition(.opacity)
            }
        }
        .onDisappear {
            cameraAdjustmentTask?.cancel()
            guidance.stop()
        }
    }

    private var plannerSheet: some View {
        VStack(spacing: 0) {
            VStack(spacing: 8) {
                Capsule()
                    .fill(FanStyle.muted.opacity(0.65))
                    .frame(width: 40, height: 5)
                Color.clear.frame(height: 8)
            }
            .frame(maxWidth: .infinity)
            .frame(height: 52)
            .contentShape(Rectangle())
            .onTapGesture { transitionToPlannerState(plannerState == .collapsed ? .expanded : .collapsed) }

            Group {
                if plannerState == .collapsed {
                    compactPlanner
                        .transition(.identity)
                } else {
                    expandedPlanner
                        .transition(.identity)
                }
            }
            .frame(maxWidth: .infinity, alignment: .top)
            .transaction { transaction in
                transaction.animation = nil
            }
        }
        .safeAreaPadding(.bottom, 16)
        .background(FanStyle.background)
        .highPriorityGesture(panelDragGesture, including: .subviews)
    }

    private var panelDragGesture: some Gesture {
        DragGesture(minimumDistance: 4, coordinateSpace: .global)
            .onChanged { value in
                if dragStartSheetHeight == nil {
                    cameraAdjustmentTask?.cancel()
                    dragStartSheetHeight = currentSheetHeight ?? detentHeight(for: plannerState)
                }

                guard let dragStartSheetHeight else { return }
                var transaction = Transaction()
                transaction.animation = nil
                withTransaction(transaction) {
                    currentSheetHeight = clampedSheetHeight(dragStartSheetHeight - value.translation.height)
                }
            }
            .onEnded { value in
                let currentHeight = currentSheetHeight ?? detentHeight(for: plannerState)
                dragStartSheetHeight = nil
                let predictedTranslation = value.predictedEndTranslation.height
                let remainingTranslation = predictedTranslation - value.translation.height
                let predictedHeight = clampedSheetHeight(currentHeight - remainingTranslation)
                let midpoint = (detentHeight(for: .collapsed) + detentHeight(for: .expanded)) / 2
                let targetState: PlannerState = predictedHeight > midpoint ? .expanded : .collapsed
                transitionToPlannerState(targetState)
            }
    }

    private func setPlannerState(_ state: PlannerState) {
        guard plannerState != state else { return }
        plannerState = state
    }

    private func transitionToPlannerState(_ state: PlannerState) {
        guard plannerState != state || currentSheetHeight != detentHeight(for: state) else { return }

        if state == .collapsed {
            focusedField = nil
        }

        withAnimation(sheetAnimation) {
            currentSheetHeight = detentHeight(for: state)
            setPlannerState(state)
        }
        scheduleMapViewportAdjustment(for: state)
    }

    private func detentHeight(for state: PlannerState) -> CGFloat {
        let compactHeight = compactContentHeight + 52 + bottomSafeAreaInset + 16
        let expandedHeight = max(viewportHeight - 20, compactHeight)
        return state == .collapsed ? compactHeight : expandedHeight
    }

    private var sheetAnimation: Animation {
        reduceMotion
            ? .easeOut(duration: 0.16)
            : .interactiveSpring(response: 0.28, dampingFraction: 0.92)
    }

    private func clampedSheetHeight(_ height: CGFloat) -> CGFloat {
        min(max(height, detentHeight(for: .collapsed)), detentHeight(for: .expanded))
    }

    private func scheduleMapViewportAdjustment(for state: PlannerState) {
        cameraAdjustmentTask?.cancel()
        cameraAdjustmentTask = Task { @MainActor in
            try? await Task.sleep(for: .milliseconds(reduceMotion ? 170 : 520))
            guard !Task.isCancelled,
                  plannerState == state,
                  dragStartSheetHeight == nil,
                  currentSheetHeight == detentHeight(for: state) else { return }
            adjustMapViewport(for: state)
        }
    }

    private func adjustMapViewport(for state: PlannerState) {
        guard mapHasLoaded, !hasUserMovedMap, lastViewportState != state else { return }
        guard let route else {
            lastViewportState = state
            return
        }

        isApplyingCamera = true
        mapPosition = routeMapPosition(route, for: state)
        lastViewportState = state
    }

    private func handleMapCameraChangeEnded() {
        if !mapHasLoaded {
            mapHasLoaded = true
        } else if isApplyingCamera {
            isApplyingCamera = false
        } else {
            hasUserMovedMap = true
        }
    }

    private func routeMapPosition(_ route: MKRoute, for state: PlannerState) -> MapCameraPosition {
        let bounds = route.polyline.boundingMapRect
        let horizontalPadding = max(bounds.width * 0.25, 1_000)
        let visibleHeight = max(viewportHeight - renderedSheetHeight - bottomSafeAreaInset, viewportHeight * 0.35)
        let visibleHeightRatio = max(visibleHeight / max(viewportHeight, 1), 0.35)
        let verticalMultiplier = state == .expanded ? 1 / visibleHeightRatio : 1.35
        let verticalPadding = max(bounds.height * 0.2, 1_000)
        return .rect(MKMapRect(
            x: bounds.minX - horizontalPadding,
            y: bounds.minY - verticalPadding,
            width: bounds.width + horizontalPadding * 2,
            height: bounds.height * verticalMultiplier + verticalPadding * 2
        ))
    }

    private var compactPlanner: some View {
        VStack(alignment: .leading, spacing: 14) {
            HStack {
                VStack(alignment: .leading, spacing: 4) {
                    Text(origin != nil && destination != nil ? "Your route" : "Plan a route")
                        .font(.headline)
                    Text(origin != nil && destination != nil
                         ? "\(originText) → \(destinationText)"
                         : "Search for a starting place and destination")
                        .font(.caption)
                        .foregroundStyle(FanStyle.muted)
                        .lineLimit(1)
                }
                Spacer()
                Button {
                    transitionToPlannerState(.expanded)
                } label: {
                    Label("Edit", systemImage: "chevron.up")
                        .font(.subheadline.bold())
                }
                .buttonStyle(FanPressStyle())
                .accessibilityLabel("Expand route planner")
            }

            if let route {
                compactRoute(travelTime: route.expectedTravelTime, co2Text: selectedRouteCo2Text)
            } else if let transitTravelTime {
                compactRoute(travelTime: transitTravelTime, co2Text: selectedRouteCo2Text)
            } else {
                Button {
                    transitionToPlannerState(.expanded)
                } label: {
                    Label(routeError == nil ? "Choose a place" : "Route unavailable · Change mode", systemImage: "magnifyingglass")
                        .frame(maxWidth: .infinity)
                        .padding(12)
                        .background(FanStyle.darkTeal, in: Capsule())
                }
                .buttonStyle(FanPressStyle())
            }
        }
        .padding(.horizontal, 20)
        .padding(.top, 24)
        .background {
            GeometryReader { geometry in
                Color.clear
                    .onAppear {
                        if geometry.size.height > 0 {
                            compactContentHeight = geometry.size.height
                        }
                    }
                    .onChange(of: geometry.size.height) { _, height in
                        if height > 0, compactContentHeight != height {
                            compactContentHeight = height
                            if plannerState == .collapsed && dragStartSheetHeight == nil {
                                withAnimation(sheetAnimation) {
                                    currentSheetHeight = detentHeight(for: .collapsed)
                                }
                            }
                        }
                    }
            }
        }
    }

    private func compactRoute(travelTime: TimeInterval, co2Text: String?) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack(spacing: 12) {
                VStack(alignment: .leading, spacing: 2) {
                    Label("\(selectedMode.title) · \(travelTime.formattedDuration)", systemImage: selectedMode.symbol)
                        .font(.subheadline)
                        .lineLimit(1)
                    if let co2Text {
                        Text(co2Text)
                            .font(.caption)
                            .foregroundStyle(FanStyle.muted)
                    }
                }
                Spacer(minLength: 0)
                Button("Navigate", systemImage: "location.north.fill") {
                    startInAppNavigation()
                }
                .font(.subheadline.bold())
                .buttonStyle(FanPressStyle())
                .accessibilityHint("Starts guidance when a transport route is available")
            }
            if let routeError, guidance.state == .idle {
                Label(routeError, systemImage: "info.circle")
                    .font(.caption)
                    .foregroundStyle(.orange)
                    .fixedSize(horizontal: false, vertical: true)
            }
        }
        .padding(12)
        .background(.white.opacity(0.07), in: RoundedRectangle(cornerRadius: 14))
    }

    private func co2Estimate(for routeId: String) -> (kind: String, text: String, value: Double)? {
        guard let item = backendEstimates.first(where: { $0.routeId == routeId }) else { return nil }
        switch item.estimate.kind {
        case "estimated_co2":
            guard let kg = item.estimate.kg else { return nil }
            return (item.estimate.kind, formatKg(kg, gas: "CO₂"), kg)
        case "estimated":
            guard let kg = item.estimate.kgCo2e else { return nil }
            return (item.estimate.kind, formatKg(kg, gas: "CO₂e"), kg)
        default:
            return nil
        }
    }

    private func co2UnavailableReason(for routeId: String) -> String? {
        guard let item = backendEstimates.first(where: { $0.routeId == routeId }),
            item.estimate.kind == "unavailable",
            let reason = item.estimate.reason else { return nil }
        return reason.replacingOccurrences(of: "_", with: " ")
    }

    private func formatKg(_ value: Double, gas: String) -> String {
        value < 1
            ? String(format: "%.2f kg %@", value, gas)
            : String(format: "%.1f kg %@", value, gas)
    }

    private var lowestCo2RouteID: String? {
        let available = backendRoutes.compactMap { route -> (String, Double)? in
            guard let estimate = co2Estimate(for: route.id) else { return nil }
            return (route.id, estimate.value)
        }
        let kinds = Set(backendRoutes.compactMap { co2Estimate(for: $0.id)?.kind })
        guard kinds.count == 1, let best = available.min(by: { $0.1 < $1.1 }) else { return nil }
        return best.0
    }

    private var selectedRouteCo2Text: String? {
        guard let id = selectedRouteOptionID else { return nil }
        return co2Estimate(for: id)?.text
    }

    private func transitCo2Text(for routeId: String) -> String? {
        transitCo2Value(for: routeId)?.text
    }

    private func transitCo2Value(for routeId: String) -> (text: String, value: Double)? {
        guard let item = transportPlan?.estimates?.first(where: { $0.routeId == routeId }) else { return nil }
        switch item.estimate.kind {
        case "estimated_co2":
            guard let kg = item.estimate.kg else { return nil }
            return (formatKg(kg, gas: "CO₂"), kg)
        case "estimated":
            guard let kg = item.estimate.kgCo2e else { return nil }
            return (formatKg(kg, gas: "CO₂e"), kg)
        default:
            return nil
        }
    }

    private func transitCo2UnavailableReason(for routeId: String) -> String? {        guard let item = transportPlan?.estimates?.first(where: { $0.routeId == routeId }),
            item.estimate.kind == "unavailable",
            let reason = item.estimate.reason else { return nil }
        return reason.replacingOccurrences(of: "_", with: " ")
    }

    private enum TransitSort: String, CaseIterable {
        case suggested, fastest, greenest, simplest
    }

    @State private var transitSort: TransitSort = .suggested

    /// List filter driven by the mode tiles; nil shows everything. Tapping
    /// the active tile again clears back to all. The tile highlight keeps
    /// meaning map mode, which is unchanged by clearing.
    @State private var modeFilter: TravelMode? = nil

    private func queryModes(for filter: TravelMode) -> [String] {
        switch filter {
        case .transit: return ["bus", "train"]
        case .walking: return ["walk"]
        case .cycling: return ["cycle"]
        case .car: return ["car"]
        }
    }

    private func transportModes(for filter: TravelMode) -> [String] {
        switch filter {
        case .transit: return ["train", "bus", "transit"]
        case .walking: return ["walk"]
        case .cycling: return []
        case .car: return ["car"]
        }
    }

    private var filteredBackendRoutes: [BackendRouteOption] {
        guard let filter = modeFilter else { return backendRoutes }
        let modes = queryModes(for: filter)
        return backendRoutes.filter { modes.contains($0.mode) }
    }

    private var sortedTransportRoutes: [BackendTransportRoute] {        guard let routes = transportPlan?.routes else { return [] }
        let base: [BackendTransportRoute]
        if let filter = modeFilter {
            let modes = transportModes(for: filter)
            base = routes.filter { modes.contains($0.mode) }
        } else {
            base = routes
        }
        switch transitSort {
        case .suggested:
            return base
        case .fastest:
            return base.sorted { $0.durationSeconds < $1.durationSeconds }
        case .greenest:
            // Options without an estimate sink instead of hiding.
            return base.sorted {
                (transitCo2Value(for: $0.id)?.value ?? .infinity) <
                (transitCo2Value(for: $1.id)?.value ?? .infinity)
            }
        case .simplest:
            return base.sorted {
                if $0.transfers != $1.transfers { return $0.transfers < $1.transfers }
                return $0.durationSeconds < $1.durationSeconds
            }
        }
    }

    /// One-line walking and transfer summary so fans see the full door-to-door
    /// shape without expanding. Transfers count rides, not walk segments.
    private func transitSummary(for option: BackendTransportRoute) -> String {
        let walkMinutes = Int(option.legs.filter { $0.kind == "walk" }.reduce(0.0) { $0 + $1.durationSeconds } / 60)
        let rides = option.legs.filter { $0.kind == "ride" || $0.kind == "drive" }.count
        let transfers = max(0, rides - 1)
        var parts: [String] = []
        if walkMinutes > 0 { parts.append("\(walkMinutes) min walk") }
        if transfers > 0 { parts.append("\(transfers) transfer\(transfers == 1 ? "" : "s")") }
        if parts.isEmpty { parts.append("Direct ride") }
        return parts.joined(separator: " · ")
    }

    private var recommendedTransitRouteID: String? {
        // A live Jev rank carries the badge. Otherwise the deterministic pick
        // shows only when it carries an estimate, never a fastest fallback.
        if let jev = transportPlan?.jev, jev.kind == "ranked",
            let top = jev.orderedRouteIds?.first,
            transportPlan?.routes.contains(where: { $0.id == top }) == true,
            transitCo2Text(for: top) != nil {
            return top
        }
        guard transportPlan?.recommendation.kind == "recommended",
            let id = transportPlan?.recommendation.routeId,
            transportPlan?.routes.contains(where: { $0.id == id }) == true,
            // Only badge an emissions-informed pick, never a fastest fallback.
            transitCo2Text(for: id) != nil else { return nil }
        return id
    }

    private var hasTransitEstimates: Bool {
        guard let routes = transportPlan?.routes else { return false }
        return routes.contains { transitCo2Text(for: $0.id) != nil }
    }

    private var recommendedRouteID: String? {
        // A live Jev rank balances time, emissions and points itself, so its
        // top pick carries the badge. Otherwise the deterministic pick shows
        // only when it actually saves over driving.
        if let jev = jevRank, jev.kind == "ranked",
            let top = jev.orderedRouteIds?.first,
            backendRoutes.contains(where: { $0.id == top }) {
            return isDirtierThanTransit(top) ? nil : top
        }
        guard let recommendation = routeRecommendation else { return nil }
        guard recommendation.kind == "recommended" || recommendation.kind == "recommended_co2" else { return nil }
        // A pick that saves nothing over driving is not worth a badge.
        let avoided = recommendation.avoidedKgCo2e ?? recommendation.avoidedKg ?? 0
        guard avoided > 0 else { return nil }
        guard let id = recommendation.route?.id, backendRoutes.contains(where: { $0.id == id }) else { return nil }
        return isDirtierThanTransit(id) ? nil : id
    }

    /// True when a transit option on screen is strictly greener than the
    /// given query pick: the badge must not endorse the dirtier option.
    private func isDirtierThanTransit(_ routeId: String) -> Bool {
        guard let pickKg = co2Estimate(for: routeId)?.value,
            let routes = transportPlan?.routes else { return false }
        return routes.contains {
            guard let kg = transitCo2Value(for: $0.id)?.value else { return false }
            return kg < pickKg
        }
    }

    private var routeRecommendationAvoidedText: String? {
        if let avoided = routeRecommendation?.avoidedKgCo2e {
            return formatKg(avoided, gas: "CO₂e")
        }
        if let avoided = routeRecommendation?.avoidedKg {
            return formatKg(avoided, gas: "CO₂")
        }
        return nil
    }

    private var recommendationAvoidedText: String? {
        guard recommendedRouteID != nil else { return nil }
        if let avoided = routeRecommendation?.avoidedKgCo2e {
            return "Saves \(formatKg(avoided, gas: "CO₂e")) vs driving"
        }
        if let avoided = routeRecommendation?.avoidedKg {
            return "Saves \(formatKg(avoided, gas: "CO₂")) vs driving"
        }
        return nil
    }

    private var expandedPlanner: some View {
        ScrollView(.vertical) {
            VStack(alignment: .leading, spacing: 15) {
                HStack(alignment: .center, spacing: 10) {
                    Button {
                        focusedField = nil
                        transitionToPlannerState(.collapsed)
                    } label: {
                        Image(systemName: "chevron.left")
                            .font(.headline)
                            .foregroundStyle(.white)
                            .frame(width: 32, height: 32)
                    }
                    .buttonStyle(FanPressStyle())
                    .accessibilityLabel("Collapse route planner")

                    VStack(spacing: 0) {
                        HStack(spacing: 12) {
                            Image(systemName: "circle")
                                .foregroundStyle(FanStyle.teal)
                                .frame(width: 22)
                            TextField("Choose starting point", text: placeText(for: .origin))
                                .textInputAutocapitalization(.words)
                                .autocorrectionDisabled()
                                .focused($focusedField, equals: .origin)
                            if !originText.isEmpty {
                                Button { clearEndpoint(.origin) } label: {
                                    Image(systemName: "xmark.circle.fill")
                                        .foregroundStyle(FanStyle.muted)
                                }
                                .buttonStyle(.plain)
                                .accessibilityLabel("Clear starting point")
                            }
                        }
                        .padding(14)

                        Divider().overlay(.white.opacity(0.08)).padding(.leading, 48)

                        HStack(spacing: 12) {
                            Image(systemName: "mappin")
                                .foregroundStyle(FanStyle.teal)
                                .frame(width: 22)
                            TextField("Choose destination", text: placeText(for: .destination))
                                .textInputAutocapitalization(.words)
                                .autocorrectionDisabled()
                                .focused($focusedField, equals: .destination)
                            if !destinationText.isEmpty {
                                Button { clearEndpoint(.destination) } label: {
                                    Image(systemName: "xmark.circle.fill")
                                        .foregroundStyle(FanStyle.muted)
                                }
                                .buttonStyle(.plain)
                                .accessibilityLabel("Clear destination")
                            }
                        }
                        .padding(14)
                    }
                    .background(.white.opacity(0.07), in: RoundedRectangle(cornerRadius: 14))
                    .overlay(
                        RoundedRectangle(cornerRadius: 14)
                            .strokeBorder(focusedField == nil ? .clear : FanStyle.teal, lineWidth: 1)
                    )

                    Button {
                        swapEndpoints()
                    } label: {
                        Image(systemName: "arrow.up.arrow.down")
                            .font(.subheadline.bold())
                            .foregroundStyle(.white)
                            .frame(width: 36, height: 36)
                            .background(.white.opacity(0.07), in: Circle())
                    }
                    .buttonStyle(FanPressStyle())
                    .accessibilityLabel("Swap starting point and destination")
                    .disabled(originText.isEmpty && destinationText.isEmpty)
                }

                if focusedField != nil && searchModel.completions.isEmpty &&
                    (focusedField == .origin ? originText : destinationText).count >= 2 {
                    Text("Searching for places…")
                        .font(.caption)
                        .foregroundStyle(FanStyle.muted)
                }

                if !searchModel.completions.isEmpty {
                    SearchSuggestionsView(completions: searchModel.completions) { completion in
                        Task { await select(completion) }
                    }
                }

                if canSearchEnteredPlaces {
                    Button {
                        Task { await searchEnteredPlaces() }
                    } label: {
                        Label("Find route", systemImage: "magnifyingglass")
                            .font(.subheadline.bold())
                            .frame(maxWidth: .infinity)
                            .padding(14)
                            .background(FanStyle.darkTeal, in: RoundedRectangle(cornerRadius: 14))
                    }
                    .buttonStyle(FanPressStyle())
                }

                if origin != nil && destination != nil {
                    Button {
                        focusedField = nil
                        transitionToPlannerState(.collapsed)
                    } label: {
                        Label("Show route", systemImage: "map")
                            .font(.subheadline.bold())
                    }
                    .buttonStyle(FanPressStyle())

                    Text("Ways to get there")
                        .font(.headline)
                        .padding(.top, 4)

                    TravelModePicker(selectedMode: $selectedMode) {
                        modeFilter = (modeFilter == selectedMode) ? nil : selectedMode
                        transitionToPlannerState(.expanded)
                        scheduleRoute(for: selectedMode)
                    }

                    if let transportPlan {
                        VStack(alignment: .leading, spacing: 8) {
                            Text("Transit options").font(.subheadline.bold())
                            Picker("Sort transit options", selection: $transitSort) {
                                Text("Suggested").tag(TransitSort.suggested)
                                Text("Fastest").tag(TransitSort.fastest)
                                Text("Greenest").tag(TransitSort.greenest)
                                Text("Simplest").tag(TransitSort.simplest)
                            }
                            .pickerStyle(.segmented)
                            .accessibilityLabel("Sort transit options")
                            if sortedTransportRoutes.isEmpty, let filter = modeFilter,
                                !transportPlan.routes.isEmpty {
                                Text("No \(filter.shortTitle.lowercased()) options right now.")
                                    .font(.caption)
                                    .foregroundStyle(FanStyle.muted)
                            }
                            ForEach(sortedTransportRoutes) { option in
                                Button {
                                    selectedBackendRouteID = option.id
                                    selectedRouteOptionID = option.id
                                } label: {
                                    HStack {
                                        VStack(alignment: .leading, spacing: 2) {
                                            HStack(spacing: 8) {
                                                Text(option.displayTitle)
                                                if option.id == recommendedTransitRouteID {
                                                    Text("RECOMMENDED")
                                                        .font(.caption2.bold())
                                                        .padding(.horizontal, 8)
                                                        .padding(.vertical, 3)
                                                        .foregroundStyle(FanStyle.teal)
                                                        .overlay(Capsule().stroke(FanStyle.teal, lineWidth: 1))
                                                }
                                            }
                                            Text(transitSummary(for: option))
                                                .font(.caption)
                                                .foregroundStyle(FanStyle.muted)
                                        }
                                        Spacer()
                                        VStack(alignment: .trailing, spacing: 2) {
                                            Text("\(Int(option.durationSeconds / 60)) min")
                                            if let co2 = transitCo2Text(for: option.id) {
                                                Text(co2)
                                                    .font(.subheadline.weight(.semibold))
                                                if let points = provisionalTransitPoints(for: option.id) {
                                                    Text("+\(points) pts provisional")
                                                        .font(.caption)
                                                        .foregroundStyle(FanStyle.teal)
                                                }
                                            } else {
                                                Text(transitCo2UnavailableReason(for: option.id).map { "CO₂ unavailable · \($0)" } ?? "CO₂ unavailable")
                                                    .font(.caption)
                                                    .foregroundStyle(FanStyle.muted)
                                            }
                                        }
                                    }
                                    .font(.subheadline)
                                    .foregroundStyle(.white)
                                    .padding(12)
                                    .background(selectedBackendRouteID == option.id ? FanStyle.darkTeal : FanStyle.panel, in: RoundedRectangle(cornerRadius: 10))
                                }
                                .buttonStyle(.plain)
                                if selectedBackendRouteID == option.id, option.legs.count > 1 {
                                    ForEach(option.legs) { leg in
                                        Text("\(leg.mode.capitalized) · \(Int(leg.durationSeconds / 60)) min · \(leg.description)")
                                            .font(.caption)
                                            .foregroundStyle(FanStyle.muted)
                                    }
                                }
                            }
                            ForEach(transportPlan.unavailable, id: \.mode) { item in
                                Text("\(item.mode.capitalized): \(item.reason.replacingOccurrences(of: "_", with: " "))")
                                    .font(.caption)
                                    .foregroundStyle(FanStyle.muted)
                            }
                            Text(hasTransitEstimates ? "Transit CO₂ is estimated from provider distances by the route service." : "CO₂ estimates are unavailable for transit options.")
                                .font(.caption)
                                .foregroundStyle(FanStyle.muted)
                        }
                    }

                    if !backendRoutes.isEmpty {
                        VStack(alignment: .leading, spacing: 8) {
                            Text("Other routes").font(.subheadline.bold())
                            if filteredBackendRoutes.isEmpty, let filter = modeFilter {
                                Text("No \(filter.shortTitle.lowercased()) options right now.")
                                    .font(.caption)
                                    .foregroundStyle(FanStyle.muted)
                            }
                            ForEach(filteredBackendRoutes) { option in
                                Button {
                                    selectedBackendRouteID = option.id
                                    selectedRouteOptionID = option.id
                                } label: {
                                    HStack {
                                        VStack(alignment: .leading, spacing: 2) {
                                            HStack(spacing: 8) {
                                                Text(option.mode.capitalized)
                                                if option.id == lowestCo2RouteID {
                                                    Text("LOWEST CO₂")
                                                        .font(.caption2.bold())
                                                        .padding(.horizontal, 8)
                                                        .padding(.vertical, 3)
                                                        .background(FanStyle.teal, in: Capsule())
                                                        .foregroundStyle(FanStyle.background)
                                                }
                                                if option.id == recommendedRouteID {
                                                    Text("RECOMMENDED")
                                                        .font(.caption2.bold())
                                                        .padding(.horizontal, 8)
                                                        .padding(.vertical, 3)
                                                        .foregroundStyle(FanStyle.teal)
                                                        .overlay(Capsule().stroke(FanStyle.teal, lineWidth: 1))
                                                }
                                            }
                                            if option.id == recommendedRouteID, let avoided = recommendationAvoidedText {
                                                Text(avoided)
                                                    .font(.caption)
                                                    .foregroundStyle(FanStyle.teal)
                                            }
                                        }
                                        Spacer()
                                        VStack(alignment: .trailing, spacing: 2) {
                                            if let seconds = option.durationSeconds {
                                                Text("\(Int(seconds / 60)) min")
                                            }
                                            if let co2 = co2Estimate(for: option.id) {
                                                Text(co2.text)
                                                    .font(.subheadline.weight(.semibold))
                                                if let points = provisionalRoutePoints(for: option.id) {
                                                    Text("+\(points) pts provisional")
                                                        .font(.caption)
                                                        .foregroundStyle(FanStyle.teal)
                                                }
                                            } else {
                                                Text(co2UnavailableReason(for: option.id).map { "CO₂ unavailable · \($0)" } ?? "CO₂ unavailable")
                                                    .font(.caption)
                                                    .foregroundStyle(FanStyle.muted)
                                            }
                                        }
                                    }
                                    .font(.subheadline)
                                    .foregroundStyle(.white)
                                    .padding(12)
                                    .background(selectedBackendRouteID == option.id ? FanStyle.darkTeal : FanStyle.panel, in: RoundedRectangle(cornerRadius: 10))
                                }
                                .buttonStyle(.plain)
                                if selectedBackendRouteID == option.id, option.legs.count > 1 {
                                    ForEach(option.legs) { leg in
                                        Text("\(leg.mode.capitalized) · \(Int(leg.durationSeconds / 60)) min · \(leg.description)")
                                            .font(.caption)
                                            .foregroundStyle(FanStyle.muted)
                                    }
                                }
                            }
                        }
                    }

                    if isCalculatingRoute {
                        HStack(spacing: 10) {
                            ProgressView().tint(FanStyle.teal)
                            Text("Finding the best available route…")
                                .font(.subheadline)
                                .foregroundStyle(FanStyle.muted)
                        }
                        .frame(maxWidth: .infinity, alignment: .leading)
                    } else if let route {
                        RouteSummary(
                            mode: selectedMode,
                            travelTime: route.expectedTravelTime,
                            distance: route.distance
                        )

                        FanButton(title: "Start navigation", symbol: "location.north.fill") {
                            startInAppNavigation()
                        }
                    } else if let transitTravelTime {
                        RouteSummary(
                            mode: selectedMode,
                            travelTime: transitTravelTime,
                            distance: nil
                        )

                        FanButton(title: "Start navigation", symbol: "location.north.fill") {
                            startInAppNavigation()
                        }
                    }

                    if guidance.state != .idle {
                        navigationGuidanceCard
                    }

                    if let routeError {
                        Text(routeError)
                            .font(.caption)
                            .foregroundStyle(.orange)
                            .fixedSize(horizontal: false, vertical: true)
                    }
                } else {
                    Text("Select a result for both places to see available travel modes.")
                        .font(.caption)
                        .foregroundStyle(FanStyle.muted)
                        .fixedSize(horizontal: false, vertical: true)
                }
            }
            .padding(.horizontal, 20)
            .padding(.top, 12)
            .padding(.bottom, 28)
            .frame(maxWidth: .infinity)
        }
        .scrollIndicators(.hidden)
        .scrollDismissesKeyboard(.interactively)
        .frame(maxHeight: .infinity, alignment: .top)
        .background(FanStyle.background)
    }

    private func placeText(for field: PlaceSearchModel.Field) -> Binding<String> {
        Binding(
            get: { field == .origin ? originText : destinationText },
            set: { value in
                routeRequestID = UUID()
                route = nil
                transitTravelTime = nil
                routeError = nil
                isCalculatingRoute = false
                if field == .origin {
                    originText = value
                    origin = nil
                } else {
                    destinationText = value
                    destination = nil
                }
                searchModel.update(query: value, field: field)
            }
        )
    }

    private func clearEndpoint(_ field: PlaceSearchModel.Field) {
        routeRequestID = UUID()
        route = nil
        transitTravelTime = nil
        routeError = nil
        isCalculatingRoute = false
        if field == .origin {
            originText = ""
            origin = nil
        } else {
            destinationText = ""
            destination = nil
        }
        searchModel.clear()
    }

    private func swapEndpoints() {
        (originText, destinationText) = (destinationText, originText)
        let item = origin
        origin = destination
        destination = item
        route = nil
        transitTravelTime = nil
        routeError = nil
        searchModel.clear()
        focusedField = nil
        if origin != nil && destination != nil {
            scheduleRoute(for: selectedMode)
        }
    }

    private var canSearchEnteredPlaces: Bool {
        let hasOriginText = originText.trimmingCharacters(in: .whitespacesAndNewlines).count >= 2
        let hasDestinationText = destinationText.trimmingCharacters(in: .whitespacesAndNewlines).count >= 2
        return hasOriginText && hasDestinationText && (origin == nil || destination == nil)
    }

    private func searchEnteredPlaces() async {
        focusedField = nil
        searchModel.clear()
        routeError = nil

        do {
            if origin == nil {
                origin = try await searchModel.resolve(query: originText)
                originText = origin?.displayName ?? originText
            }
            if destination == nil {
                destination = try await searchModel.resolve(query: destinationText)
                destinationText = destination?.displayName ?? destinationText
            }
            scheduleRoute(for: selectedMode)
        } catch {
            routeError = "We could not find one of those places. Choose a suggestion or try a more specific search."
        }
    }

    private func select(_ completion: MKLocalSearchCompletion) async {
        let field = searchModel.activeField
        searchModel.clear()
        focusedField = nil

        do {
            let item = try await searchModel.resolve(completion)
            switch field {
            case .origin:
                origin = item
                originText = item.displayName
            case .destination:
                destination = item
                destinationText = item.displayName
            case .none:
                break
            }
            if origin != nil && destination != nil {
                scheduleRoute(for: selectedMode)
            }
        } catch {
            routeError = "That place could not be selected. Try another result."
        }
    }

    private func calculateRoute(for mode: TravelMode) async {
        guard let origin, let destination else { return }

        let requestID = UUID()
        routeRequestID = requestID
        routeError = nil
        isCalculatingRoute = true
        route = nil
        transitTravelTime = nil

        let request = MKDirections.Request()
        request.source = origin
        request.destination = destination
        request.transportType = mode.transportType

        do {
            if backend.isConnected {
                do {
                    let response = try await withOneRetry {
                        try await backend.routes(origin: origin.displayName, destination: destination.displayName)
                    }
                    guard requestID == routeRequestID else { return }
                    if response.result.kind == "unavailable" {
                        backendRoutes = []
                        backendEstimates = []
                        routeRecommendation = nil
                        jevRank = nil
                        selectedBackendRouteID = nil
                        selectedRouteOptionID = nil
                        routeError = "More route choices are unavailable right now. Showing the map route instead."
                    } else {
                        backendRoutes = response.result.routes ?? []
                        backendEstimates = response.estimates
                        routeRecommendation = response.recommendation
                        jevRank = response.jev
                        selectedBackendRouteID = backendRoutes.first?.id
                        selectedRouteOptionID = backendRoutes.first?.id
                    }
                } catch {
                    guard requestID == routeRequestID else { return }
                    backendRoutes = []
                    backendEstimates = []
                    routeRecommendation = nil
                    jevRank = nil
                    selectedBackendRouteID = nil
                    selectedRouteOptionID = nil
                    routeError = "More route choices are unavailable right now. Showing the map route instead."
                }
            }
            let plan = await fetchPlan(from: origin, to: destination)
            guard requestID == routeRequestID else { return }
            transportPlan = plan
            if let plan {
                let initialRouteID = plan.recommendation.routeId ?? plan.routes.first?.id
                selectedBackendRouteID = initialRouteID
                selectedRouteOptionID = initialRouteID
            }
            let directions = MKDirections(request: request)
            if mode == .transit {
                // Prefer a real Apple transit path for the map line. When Apple
                // has no transit path, keep the ETA time label and markers only.
                do {
                    let response = try await directions.calculate()
                    guard requestID == routeRequestID else { return }
                    guard let route = response.routes.first else {
                        throw RouteError.noRoute
                    }
                    self.route = route
                    transitTravelTime = route.expectedTravelTime
                    lastViewportState = nil
                } catch {
                    guard requestID == routeRequestID else { return }
                    let eta = try await directions.calculateETA()
                    guard requestID == routeRequestID else { return }
                    transitTravelTime = eta.expectedTravelTime
                }
            } else {
                let response = try await directions.calculate()
                guard requestID == routeRequestID else { return }
                guard let route = response.routes.first else {
                    throw RouteError.noRoute
                }
                self.route = route
                lastViewportState = nil
            }
            transitionToPlannerState(.collapsed)
            scheduleMapViewportAdjustment(for: .collapsed)
        } catch {
            guard requestID == routeRequestID else { return }
            routeError = mode == .transit
                ? "Public transport is not available for this pair of places right now. Try walking, cycling, or car."
                : "No \(mode.title.lowercased()) route was found for these places."
        }

        if requestID == routeRequestID { isCalculatingRoute = false }
    }

    private var navigationGuidanceCard: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("AMR navigation").font(.subheadline.bold())
            if let route = guidance.route, let step = route.legs[safe: guidance.stepIndex] {
                Text("Step \(guidance.stepIndex + 1) of \(route.legs.count): \(step.instruction ?? step.description)")
                    .font(.headline)
                Text("\(step.from) → \(step.to) · \(Int(step.durationSeconds / 60)) min")
                    .font(.caption)
                    .foregroundStyle(FanStyle.muted)
            }
            switch guidance.state {
            case .requesting: Text("Requesting location access…")
            case .active: Text("GPS active. The next step advances when you reach the stop.")
            case .offRoute: Text("You appear off route. Return to the displayed step to continue.").foregroundStyle(.orange)
            case .arrived: Text("You arrived. Journey tracking is still active.")
            case .denied: Text("Location access is needed for automatic guidance. You can still browse routes.").foregroundStyle(.orange)
            case .idle: EmptyView()
            }
            Button("Stop navigation") { guidance.stop() }
                .buttonStyle(FanPressStyle())
        }
        .padding(14)
        .background(.white.opacity(0.07), in: RoundedRectangle(cornerRadius: 14))
    }

    /// Cancels any in-flight route request before starting another one. The route
    /// provider serves one plan at a time and rejects an overlapping request.
    private func scheduleRoute(for mode: TravelMode) {
        routeTask?.cancel()
        routeTask = Task { await calculateRoute(for: mode) }
    }

    /// The provider serves one plan at a time and drops single modes
    /// transiently, so a plan that failed to arrive or arrived empty gets two
    /// more tries. Keeping the last empty plan lets the caller report which
    /// modes were unavailable.
    private func fetchPlan(from origin: MKMapItem, to destination: MKMapItem) async -> BackendTransportPlan? {
        let from = BackendTransportCoordinate(latitude: origin.coordinate.latitude, longitude: origin.coordinate.longitude)
        let to = BackendTransportCoordinate(latitude: destination.coordinate.latitude, longitude: destination.coordinate.longitude)
        var lastPlan: BackendTransportPlan?
        for attempt in 0..<3 {
            if attempt > 0 {
                try? await Task.sleep(nanoseconds: 650_000_000)
                guard !Task.isCancelled else { return lastPlan }
            }
            guard let plan = try? await backend.transportPlan(origin: from, destination: to) else { continue }
            if !plan.routes.isEmpty { return plan }
            lastPlan = plan
        }
        return lastPlan
    }

    /// One bounded retry for a request the provider can fail transiently.
    private func withOneRetry<T>(_ work: () async throws -> T) async throws -> T {
        do {
            return try await work()
        } catch {
            guard !Task.isCancelled else { throw error }
            try? await Task.sleep(nanoseconds: 350_000_000)
            guard !Task.isCancelled else { throw error }
            return try await work()
        }
    }

    private func planCo2Kilograms(for routeId: String) -> Double? {
        guard let item = transportPlan?.estimates?.first(where: { $0.routeId == routeId }) else { return nil }
        switch item.estimate.kind {
        case "estimated_co2": return item.estimate.kg
        case "estimated": return item.estimate.kgCo2e
        default: return nil
        }
    }

    private func provisionalPoints(for avoidedKilograms: Double?) -> Int? {
        guard let avoidedKilograms, avoidedKilograms > 0 else { return nil }
        return min(2_000, Int((avoidedKilograms * 50).rounded(.down)))
    }

    private func provisionalTransitPoints(for routeId: String) -> Int? {
        guard let car = transportPlan?.routes
            .filter({ $0.mode == "car" })
            .compactMap({ planCo2Kilograms(for: $0.id) })
            .min(),
            let route = planCo2Kilograms(for: routeId) else { return nil }
        return provisionalPoints(for: max(0, car - route))
    }

    private func provisionalRoutePoints(for routeId: String) -> Int? {
        guard let car = backendRoutes
            .filter({ $0.mode == "car" })
            .compactMap({ co2Estimate(for: $0.id)?.value })
            .min(),
            let route = co2Estimate(for: routeId)?.value else { return nil }
        return provisionalPoints(for: max(0, car - route))
    }

    /// Plan modes that stand for the tab the user picked.
    private func planModes(for mode: TravelMode) -> Set<String> {
        switch mode {
        case .car: ["car"]
        case .walking: ["walk"]
        case .cycling: ["cycle", "bike"]
        case .transit: ["transit", "train", "bus"]
        }
    }

    private var selectedPlanRouteID: String? {
        guard let plan = transportPlan else { return nil }
        let modes = planModes(for: selectedMode)
        // The plan's own recommendation can name a route outside the tab the
        // user picked, so only trust it when it belongs to that tab.
        if let id = selectedBackendRouteID,
            let route = plan.routes.first(where: { $0.id == id }),
            modes.contains(route.mode)
        {
            return id
        }
        return plan.routes
            .filter { modes.contains($0.mode) }
            .compactMap { route in planCo2Kilograms(for: route.id).map { (route.id, $0) } }
            .min { $0.1 < $1.1 }?
            .0
    }

    private var carBaselineKilograms: Double? {
        transportPlan?.routes
            .filter { $0.mode == "car" }
            .compactMap { planCo2Kilograms(for: $0.id) }
            .min()
    }

    private var chosenRouteKilograms: Double? {
        selectedPlanRouteID.flatMap(planCo2Kilograms(for:))
    }

    /// Carbon the started trip avoids against driving the same plan. Returns nil
    /// when this plan has no car baseline or no route for the chosen tab, so the
    /// summary can say so instead of claiming a saving it cannot support.
    private var avoidedKilograms: Double? {
        guard let car = carBaselineKilograms, let chosen = chosenRouteKilograms else { return nil }
        return max(0, car - chosen)
    }

    private func startInAppNavigation() {
        routeError = nil
        guidance.stop()
        guard let saved = avoidedKilograms,
              let routeID = selectedPlanRouteID
        else {
            routeError = "Points are unavailable because this route has no verified carbon estimate."
            return
        }
        let requestID = routeRewardRequestID ?? UUID()
        routeRewardRequestID = requestID
        let distanceMeters = transportPlan?.routes.first(where: { $0.id == routeID })?.distanceMeters
            ?? backendRoutes.first(where: { $0.id == routeID })?.distanceMeters
        Task { @MainActor in
            do {
                let reward = try await backend.awardRouteReward(
                    savedKg: saved,
                    distanceMeters: distanceMeters,
                    routeId: routeID,
                    requestId: requestID
                )
                let summary = JourneyCelebrationSummary(
                    points: reward.points,
                    savedKg: saved,
                    routeTitle: selectedMode.title
                )
                withAnimation(reduceMotion ? .easeOut(duration: 0.2) : .easeInOut(duration: 0.25)) {
                    celebration = summary
                }
            } catch {
                routeRewardRequestID = nil
                routeError = error.localizedDescription
            }
        }
    }
}

private struct JourneyCompletionView: View {
    let pointsText: String
    let savedText: String
    let routeTitle: String
    let isDemo: Bool
    let reduceMotion: Bool
    let continueAction: () -> Void

    @State private var carOffset: CGFloat = -260
    @State private var carScale = 0.82
    @State private var burstVisible = false

    private let burstPositions: [(CGFloat, CGFloat, String)] = [
        (-112, -170, "sparkles"), (0, -214, "sun.max.fill"), (112, -166, "sparkles"),
        (-150, -60, "star.fill"), (150, -58, "star.fill")
    ]

    var body: some View {
        ZStack {
            FanStyle.background.ignoresSafeArea()
            ForEach(Array(burstPositions.enumerated()), id: \.offset) { _, position in
                Image(systemName: position.2)
                    .font(.system(size: 26, weight: .bold))
                    .foregroundStyle(FanStyle.teal)
                    .offset(x: position.0, y: position.1)
                    .scaleEffect(burstVisible ? 1 : 0.35)
                    .opacity(burstVisible ? 1 : 0)
            }
            VStack(spacing: 22) {
                Spacer()
                ZStack {
                    Circle()
                        .fill(FanStyle.teal.opacity(0.16))
                        .frame(width: 148, height: 148)
                    Image(systemName: "car.side.fill")
                        .font(.system(size: 58, weight: .bold))
                        .foregroundStyle(FanStyle.teal)
                        .scaleEffect(carScale)
                        .offset(x: carOffset)
                }
                Text(isDemo ? "Demo journey complete" : "Journey complete")
                    .font(.system(size: 32, weight: .bold, design: .rounded))
                Text(isDemo ? "Preview only. No journey or points were written." : "Your \(routeTitle.lowercased()) route is recorded.")
                    .font(.subheadline)
                    .foregroundStyle(FanStyle.muted)
                VStack(spacing: 12) {
                    completionRow("Points", pointsText, "star.fill")
                    completionRow("CO₂ avoided", savedText, "leaf.fill")
                }
                .padding(18)
                .background(.white.opacity(0.07), in: RoundedRectangle(cornerRadius: 18))
                Spacer()
                FanButton(title: "Continue to Home", symbol: "house.fill", action: continueAction)
                    .padding(.horizontal, 24)
                    .padding(.bottom, 26)
            }
            .padding(.horizontal, 22)
        }
        .onAppear {
            if reduceMotion {
                carOffset = 0
                carScale = 1
                burstVisible = true
            } else {
                withAnimation(.easeOut(duration: 0.7)) {
                    carOffset = 0
                    carScale = 1
                }
                withAnimation(.spring(response: 0.55, dampingFraction: 0.72).delay(0.55)) {
                    burstVisible = true
                }
            }
        }
        .accessibilityElement(children: .contain)
        .accessibilityLabel("Journey complete. Points \(pointsText). Carbon avoided \(savedText).")
    }

    private func completionRow(_ label: String, _ value: String, _ symbol: String) -> some View {
        HStack {
            Label(label, systemImage: symbol)
            Spacer()
            Text(value).font(.subheadline.bold()).foregroundStyle(FanStyle.teal)
        }
    }
}

private extension Array {
    subscript(safe index: Index) -> Element? {
        indices.contains(index) ? self[index] : nil
    }
}

private struct SearchSuggestionsView: View {
    let completions: [MKLocalSearchCompletion]
    let select: (MKLocalSearchCompletion) -> Void

    var body: some View {
        VStack(spacing: 0) {
            ForEach(Array(completions.enumerated()), id: \.offset) { _, completion in
                Button {
                    select(completion)
                } label: {
                    HStack(spacing: 14) {
                        Image(systemName: "mappin")
                            .foregroundStyle(FanStyle.muted)
                            .frame(width: 24)
                        VStack(alignment: .leading, spacing: 3) {
                            Text(completion.title)
                                .font(.subheadline)
                                .foregroundStyle(.white)
                            if !completion.subtitle.isEmpty {
                                Text(completion.subtitle)
                                    .font(.caption)
                                    .foregroundStyle(FanStyle.muted)
                            }
                        }
                        Spacer(minLength: 8)
                        Image(systemName: "arrow.up.left")
                            .foregroundStyle(FanStyle.muted)
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .padding(.vertical, 12)
                    .padding(.horizontal, 14)
                }
                .buttonStyle(.plain)

                if completion !== completions.last {
                    Divider().overlay(.white.opacity(0.08)).padding(.leading, 52)
                }
            }
        }
        .background(.white.opacity(0.05), in: RoundedRectangle(cornerRadius: 14))
    }
}

private struct TravelModePicker: View {
    @Binding var selectedMode: TravelMode
    let select: () -> Void

    var body: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 8) {
                ForEach(TravelMode.allCases) { mode in
                    Button {
                        selectedMode = mode
                        select()
                    } label: {
                        VStack(spacing: 4) {
                            Image(systemName: mode.symbol)
                                .font(.system(size: 20, weight: .semibold))
                            Text(mode.shortTitle)
                                .font(.caption2.bold())
                                .lineLimit(1)
                        }
                        .foregroundStyle(selectedMode == mode ? FanStyle.background : .white)
                        .frame(width: 68, height: 58)
                        .background(
                            selectedMode == mode ? FanStyle.teal : .white.opacity(0.07),
                            in: RoundedRectangle(cornerRadius: 14)
                        )
                    }
                    .buttonStyle(FanPressStyle())
                    .accessibilityLabel(mode.title)
                    .accessibilityAddTraits(selectedMode == mode ? .isSelected : [])
                }
            }
            .padding(.vertical, 2)
        }
    }
}

private struct RouteSummary: View {
    let mode: TravelMode
    let travelTime: TimeInterval
    let distance: CLLocationDistance?

    var body: some View {
        HStack(spacing: 14) {
            Image(systemName: mode.symbol)
                .font(.title3)
                .foregroundStyle(FanStyle.teal)
                .frame(width: 32)
            VStack(alignment: .leading, spacing: 3) {
                Text(mode.title)
                    .font(.subheadline.bold())
                Text(summary)
                    .font(.caption)
                    .foregroundStyle(FanStyle.muted)
            }
            Spacer()
            Image(systemName: "checkmark.circle.fill")
                .foregroundStyle(FanStyle.teal)
        }
        .padding(14)
        .background(.white.opacity(0.07), in: RoundedRectangle(cornerRadius: 14))
    }

    private var summary: String {
        if let distance {
            return "\(travelTime.formattedDuration) · \(distance.formattedDistance)"
        }
        return "\(travelTime.formattedDuration) · route preview"
    }
}

private struct TravelMapView: View {
    let origin: MKMapItem?
    let destination: MKMapItem?
    let route: MKRoute?
    let transportRoute: BackendTransportRoute?
    @Binding var mapPosition: MapCameraPosition
    let onCameraChangeEnded: () -> Void

    var body: some View {
        Map(position: $mapPosition) {
            if let origin {
                Marker("From", coordinate: origin.coordinate)
                    .tint(.blue)
            }
            if let destination {
                Marker("To", coordinate: destination.coordinate)
                    .tint(.red)
            }
            if let route {
                MapPolyline(route.polyline)
                    .stroke(FanStyle.teal, lineWidth: 6)
            }
            if route == nil, let transportRoute {
                // Provider leg shapes draw first: each shape is real geometry
                // and gaps between shapes stay gaps. The endpoint fallback
                // below only runs for simulated timetables without shapes.
                let shapes = transportRoute.legs.compactMap { leg -> [CLLocationCoordinate2D]? in
                    guard let path = leg.path, path.count > 1 else { return nil }
                    return path.map { CLLocationCoordinate2D(latitude: $0.latitude, longitude: $0.longitude) }
                }
                if !shapes.isEmpty {
                    ForEach(shapes.indices, id: \.self) { index in
                        MapPolyline(coordinates: shapes[index])
                            .stroke(FanStyle.teal, lineWidth: 6)
                    }
                } else {
                    // MVP: fall back to the endpoint line whenever there is
                    // no real geometry, so the selection is never blank.
                    let coordinates = Self.lineCoordinates(for: transportRoute.legs)
                    if coordinates.count > 1 {
                        MapPolyline(coordinates: coordinates)
                            .stroke(FanStyle.teal, lineWidth: 6)
                    }
                }
            }
            if route == nil, transportRoute == nil, let origin, let destination {
                // No path geometry available: still show the planned line.
                MapPolyline(coordinates: [origin.coordinate, destination.coordinate])
                    .stroke(FanStyle.teal, lineWidth: 6)
            }
        }
        .mapStyle(.standard(emphasis: .muted))
        .mapControlVisibility(.hidden)
        .onMapCameraChange(frequency: .onEnd) { _ in
            onCameraChangeEnded()
        }
    }

    static func lineCoordinates(for legs: [BackendTransportLeg]) -> [CLLocationCoordinate2D] {
        var points: [CLLocationCoordinate2D] = []
        for raw in legs.flatMap({ [$0.fromCoordinate, $0.toCoordinate] }).compactMap({ $0 }) {
            let point = CLLocationCoordinate2D(latitude: raw.latitude, longitude: raw.longitude)
            if let last = points.last,
                abs(last.latitude - point.latitude) < 1e-9,
                abs(last.longitude - point.longitude) < 1e-9 {
                continue
            }
            points.append(point)
        }
        guard points.count > 1,
            let first = points.first, let last = points.last,
            abs(first.latitude - last.latitude) >= 1e-9 ||
            abs(first.longitude - last.longitude) >= 1e-9 else { return [] }
        return points
    }
}

private enum PlannerState: Equatable {
    case collapsed
    case expanded
}

@MainActor
@Observable
private final class PlaceSearchModel: NSObject, MKLocalSearchCompleterDelegate {
    enum Field: Hashable {
        case origin
        case destination
    }

    private(set) var completions: [MKLocalSearchCompletion] = []
    private let completer = MKLocalSearchCompleter()
    private static let searchRegion = MKCoordinateRegion(
        center: CLLocationCoordinate2D(latitude: 1.2868, longitude: 103.8545),
        span: MKCoordinateSpan(latitudeDelta: 2.0, longitudeDelta: 2.0)
    )
    var activeField: Field?

    override init() {
        super.init()
        completer.delegate = self
        completer.resultTypes = [.address, .pointOfInterest]
        completer.region = Self.searchRegion
    }

    func activate(_ field: Field, query: String) {
        activeField = field
        update(query: query, field: field)
    }

    func update(query: String, field: Field) {
        activeField = field
        guard query.trimmingCharacters(in: .whitespacesAndNewlines).count >= 2 else {
            completions = []
            completer.cancel()
            return
        }
        completer.queryFragment = query
    }

    func clear() {
        activeField = nil
        completions = []
        completer.cancel()
    }

    func resolve(_ completion: MKLocalSearchCompletion) async throws -> MKMapItem {
        let request = MKLocalSearch.Request(completion: completion)
        let response = try await MKLocalSearch(request: request).start()
        guard let item = response.mapItems.first else {
            throw RouteError.noPlace
        }
        return item
    }

    func resolve(query: String) async throws -> MKMapItem {
        let request = MKLocalSearch.Request()
        request.naturalLanguageQuery = query
        request.region = Self.searchRegion
        let response = try await MKLocalSearch(request: request).start()
        guard let item = response.mapItems.first else {
            throw RouteError.noPlace
        }
        return item
    }

    func completerDidUpdateResults(_ completer: MKLocalSearchCompleter) {
        completions = Array(completer.results.prefix(5))
    }

    func completer(_ completer: MKLocalSearchCompleter, didFailWithError error: Error) {
        completions = []
    }
}

private enum TravelMode: String, CaseIterable, Identifiable {
    case transit
    case walking
    case cycling
    case car

    var id: Self { self }

    var title: String {
        switch self {
        case .transit: "Public transport"
        case .walking: "Walking"
        case .cycling: "Cycling"
        case .car: "Car"
        }
    }

    var shortTitle: String {
        switch self {
        case .transit: "Transit"
        case .walking: "Walk"
        case .cycling: "Cycle"
        case .car: "Car"
        }
    }

    var symbol: String {
        switch self {
        case .transit: "tram.fill"
        case .walking: "figure.walk"
        case .cycling: "bicycle"
        case .car: "car.fill"
        }
    }

    var transportType: MKDirectionsTransportType {
        switch self {
        case .transit: .transit
        case .walking: .walking
        case .cycling: .cycling
        case .car: .automobile
        }
    }

    var launchMode: String {
        switch self {
        case .transit: MKLaunchOptionsDirectionsModeTransit
        case .walking: MKLaunchOptionsDirectionsModeWalking
        case .cycling: MKLaunchOptionsDirectionsModeCycling
        case .car: MKLaunchOptionsDirectionsModeDriving
        }
    }
}

private enum RouteError: Error {
    case noPlace
    case noRoute
}

private extension MKMapItem {
    var displayName: String {
        name ?? address?.fullAddress ?? "Selected place"
    }

    var coordinate: CLLocationCoordinate2D {
        location.coordinate
    }
}

private extension TimeInterval {
    var formattedDuration: String {
        let minutes = max(1, Int((self / 60).rounded()))
        return minutes < 60 ? "\(minutes) min" : "\(minutes / 60) hr \(minutes % 60) min"
    }
}

private extension CLLocationDistance {
    var formattedDistance: String {
        Measurement(value: self, unit: UnitLength.meters)
            .converted(to: self >= 1000 ? .kilometers : .meters)
            .formatted(.measurement(width: .abbreviated, usage: .road))
    }
}
