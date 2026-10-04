import SwiftUI
import MapKit
import Observation

struct TravelScreen: View {
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
    @State private var expandedContentHeight: CGFloat = 260
    @FocusState private var focusedField: PlaceSearchModel.Field?
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @EnvironmentObject private var backend: BackendSession
    @State private var backendRoutes: [BackendRouteOption] = []
    @State private var selectedBackendRouteID: String?
    @State private var transportPlan: BackendTransportPlan?
    @State private var guidance = NavigationGuidance()

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
                .padding(.top, 25)
                .frame(maxWidth: .infinity)
                .allowsHitTesting(false)
            }
        }
        .background(FanStyle.background.ignoresSafeArea())
        .overlay(alignment: .bottom) {
            GeometryReader { geometry in
                let compactHeight = compactContentHeight + 52 + geometry.safeAreaInsets.bottom + 16
                let expandedHeight = min(
                    max(expandedContentHeight + 52 + geometry.safeAreaInsets.bottom + 16, compactHeight),
                    geometry.size.height - 20
                )
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
                        .background {
                            GeometryReader { sheetGeometry in
                                Color.clear.preference(
                                    key: SheetMetricsPreferenceKey.self,
                                    value: SheetMetrics(
                                        height: sheetGeometry.size.height,
                                        viewportHeight: geometry.size.height,
                                        bottomSafeAreaInset: geometry.safeAreaInsets.bottom
                                    )
                                )
                            }
                        }
                        .clipShape(
                            UnevenRoundedRectangle(
                                topLeadingRadius: 28,
                                topTrailingRadius: 28
                            )
                        )
                }
                .frame(width: geometry.size.width, height: geometry.size.height)
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
        .onPreferenceChange(SheetMetricsPreferenceKey.self) { metrics in
            renderedSheetHeight = metrics.height
            viewportHeight = metrics.viewportHeight
            bottomSafeAreaInset = metrics.bottomSafeAreaInset
        }
        .onPreferenceChange(CompactPlannerHeightPreferenceKey.self) { height in
            guard height > 0, compactContentHeight != height else { return }
            compactContentHeight = height
            if plannerState == .collapsed && dragStartSheetHeight == nil {
                withAnimation(sheetAnimation) {
                    currentSheetHeight = detentHeight(for: .collapsed)
                }
            }
        }
        .onPreferenceChange(ExpandedPlannerHeightPreferenceKey.self) { height in
            guard height > 0, expandedContentHeight != height else { return }
            expandedContentHeight = height
            if plannerState == .expanded && dragStartSheetHeight == nil {
                withAnimation(sheetAnimation) {
                    currentSheetHeight = detentHeight(for: .expanded)
                }
            }
        }
        .onChange(of: focusedField) { _, field in
            if let field {
                searchModel.activate(field, query: field == .origin ? originText : destinationText)
            } else {
                searchModel.clear()
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
        let expandedHeight = min(
            max(expandedContentHeight + 52 + bottomSafeAreaInset + 16, compactHeight),
            max(viewportHeight - 20, compactHeight)
        )
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
                compactRoute(travelTime: route.expectedTravelTime)
            } else if let transitTravelTime {
                compactRoute(travelTime: transitTravelTime)
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
                Color.clear.preference(
                    key: CompactPlannerHeightPreferenceKey.self,
                    value: geometry.size.height
                )
            }
        }
    }

    private func compactRoute(travelTime: TimeInterval) -> some View {
        HStack(spacing: 12) {
            Label("\(selectedMode.title) · \(travelTime.formattedDuration)", systemImage: selectedMode.symbol)
                .font(.subheadline)
                .lineLimit(1)
            Spacer(minLength: 0)
            Button("Navigate", systemImage: "location.north.fill") {
                startInAppNavigation()
            }
            .font(.subheadline.bold())
            .buttonStyle(FanPressStyle())
        }
        .padding(12)
        .background(.white.opacity(0.07), in: RoundedRectangle(cornerRadius: 14))
    }

    private var expandedPlanner: some View {
        ScrollView(.vertical) {
            VStack(alignment: .leading, spacing: 15) {
                PlaceSearchField(
                    title: "From",
                    placeholder: "Search starting place",
                    symbol: "circle.dotted.circle.fill",
                    text: placeText(for: .origin),
                    isActive: searchModel.activeField == .origin
                )
                .focused($focusedField, equals: .origin)

                PlaceSearchField(
                    title: "To",
                    placeholder: "Search destination",
                    symbol: "mappin.and.ellipse",
                    text: placeText(for: .destination),
                    isActive: searchModel.activeField == .destination
                )
                .focused($focusedField, equals: .destination)

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
                        transitionToPlannerState(.expanded)
                        Task { await calculateRoute(for: selectedMode) }
                    }

                    if !backendRoutes.isEmpty {
                        VStack(alignment: .leading, spacing: 8) {
                            Text("Other routes").font(.subheadline.bold())
                            ForEach(backendRoutes) { option in
                                Button {
                                    selectedBackendRouteID = option.id
                                } label: {
                                    HStack {
                                        Text(option.mode.capitalized)
                                        Spacer()
                                        if let seconds = option.durationSeconds {
                                            Text("\(Int(seconds / 60)) min")
                                        }
                                    }
                                    .font(.subheadline)
                                    .foregroundStyle(.white)
                                    .padding(12)
                                    .background(selectedBackendRouteID == option.id ? FanStyle.darkTeal : FanStyle.panel, in: RoundedRectangle(cornerRadius: 10))
                                }
                                .buttonStyle(.plain)
                                if selectedBackendRouteID == option.id {
                                    ForEach(option.legs) { leg in
                                        Text("\(leg.mode.capitalized) · \(Int(leg.durationSeconds / 60)) min · \(leg.description)")
                                            .font(.caption)
                                            .foregroundStyle(FanStyle.muted)
                                    }
                                }
                            }
                        }
                    }

                    if let transportPlan {
                        VStack(alignment: .leading, spacing: 8) {
                            Text("Transit options").font(.subheadline.bold())
                            ForEach(transportPlan.routes) { option in
                                Button {
                                    selectedBackendRouteID = option.id
                                } label: {
                                    HStack {
                                        Text(option.displayTitle)
                                        Spacer()
                                        Text("\(Int(option.durationSeconds / 60)) min")
                                    }
                                    .font(.subheadline)
                                    .foregroundStyle(.white)
                                    .padding(12)
                                    .background(selectedBackendRouteID == option.id ? FanStyle.darkTeal : FanStyle.panel, in: RoundedRectangle(cornerRadius: 10))
                                }
                                .buttonStyle(.plain)
                                if selectedBackendRouteID == option.id {
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
            .background {
                GeometryReader { geometry in
                    Color.clear.preference(
                        key: ExpandedPlannerHeightPreferenceKey.self,
                        value: geometry.size.height
                    )
                }
            }
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
            await calculateRoute(for: selectedMode)
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
                await calculateRoute(for: selectedMode)
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
                    let response = try await backend.routes(origin: origin.displayName, destination: destination.displayName)
                    if response.result.kind == "unavailable" {
                        backendRoutes = []
                        selectedBackendRouteID = nil
                        routeError = "More route choices are unavailable right now. Showing the map route instead."
                    } else {
                        backendRoutes = response.result.routes ?? []
                        selectedBackendRouteID = backendRoutes.first?.id
                    }
                } catch {
                    backendRoutes = []
                    selectedBackendRouteID = nil
                    routeError = "More route choices are unavailable right now. Showing the map route instead."
                }
            }
            do {
                transportPlan = try await backend.transportPlan(origin: originText, destination: destinationText)
                selectedBackendRouteID = transportPlan?.recommendation.routeId ?? transportPlan?.routes.first?.id
            } catch {
                transportPlan = nil
            }
            let directions = MKDirections(request: request)
            if mode == .transit {
                let response = try await directions.calculateETA()
                guard requestID == routeRequestID else { return }
                transitTravelTime = response.expectedTravelTime
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

        isCalculatingRoute = false
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

    private func startInAppNavigation() {
        guard let selected = transportPlan?.routes.first(where: { $0.id == selectedBackendRouteID }) ?? transportPlan?.routes.first else {
            routeError = "AMR navigation is unavailable until a transport route is returned."
            return
        }
        guidance.start(route: selected)
    }
}

private extension Array {
    subscript(safe index: Index) -> Element? {
        indices.contains(index) ? self[index] : nil
    }
}

private struct PlaceSearchField: View {
    let title: String
    let placeholder: String
    let symbol: String
    @Binding var text: String
    let isActive: Bool

    var body: some View {
        HStack(spacing: 14) {
            Image(systemName: symbol)
                .foregroundStyle(FanStyle.teal)
            VStack(alignment: .leading, spacing: 2) {
                Text(title)
                    .font(.caption.bold())
                    .foregroundStyle(FanStyle.muted)
                TextField(placeholder, text: $text)
                    .textInputAutocapitalization(.words)
                    .autocorrectionDisabled()
            }
        }
        .padding(14)
        .background(.white.opacity(0.07), in: RoundedRectangle(cornerRadius: 14))
        .overlay(
            RoundedRectangle(cornerRadius: 14)
                .strokeBorder(isActive ? FanStyle.teal : .clear, lineWidth: 1)
        )
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
                    VStack(alignment: .leading, spacing: 3) {
                        Text(completion.title)
                            .font(.subheadline.bold())
                            .foregroundStyle(.white)
                        if !completion.subtitle.isEmpty {
                            Text(completion.subtitle)
                                .font(.caption)
                                .foregroundStyle(FanStyle.muted)
                        }
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .padding(.vertical, 10)
                }
                .buttonStyle(.plain)

                if completion !== completions.last {
                    Divider().overlay(.white.opacity(0.08))
                }
            }
        }
        .padding(.horizontal, 14)
        .background(.white.opacity(0.05), in: RoundedRectangle(cornerRadius: 14))
    }
}

private struct TravelModePicker: View {
    @Binding var selectedMode: TravelMode
    let select: () -> Void

    var body: some View {
        HStack(spacing: 4) {
            ForEach(TravelMode.allCases) { mode in
                Button {
                    selectedMode = mode
                    select()
                } label: {
                    HStack(spacing: 6) {
                        Image(systemName: mode.symbol)
                            .font(.subheadline.weight(.semibold))
                        Text(mode.shortTitle)
                            .font(.caption.bold())
                            .lineLimit(1)
                    }
                    .foregroundStyle(selectedMode == mode ? FanStyle.background : .white)
                    .frame(maxWidth: .infinity, minHeight: 44)
                    .background(
                        selectedMode == mode ? FanStyle.teal : .clear,
                        in: Capsule()
                    )
                }
                .buttonStyle(FanPressStyle())
                .accessibilityLabel(mode.title)
                .accessibilityAddTraits(selectedMode == mode ? .isSelected : [])
            }
        }
        .padding(4)
        .background(.white.opacity(0.08), in: Capsule())
        .overlay(Capsule().strokeBorder(FanStyle.teal.opacity(0.35)))
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
        }
        .mapStyle(.standard(emphasis: .muted))
        .mapControlVisibility(.hidden)
        .onMapCameraChange(frequency: .onEnd) { _ in
            onCameraChangeEnded()
        }
    }
}

private enum PlannerState: Equatable {
    case collapsed
    case expanded
}

private struct SheetMetrics: Equatable {
    let height: CGFloat
    let viewportHeight: CGFloat
    let bottomSafeAreaInset: CGFloat
}

private struct SheetMetricsPreferenceKey: PreferenceKey {
    static let defaultValue = SheetMetrics(height: 0, viewportHeight: 0, bottomSafeAreaInset: 0)

    static func reduce(value: inout SheetMetrics, nextValue: () -> SheetMetrics) {
        value = nextValue()
    }
}

private struct CompactPlannerHeightPreferenceKey: PreferenceKey {
    static let defaultValue: CGFloat = 0

    static func reduce(value: inout CGFloat, nextValue: () -> CGFloat) {
        value = nextValue()
    }
}

private struct ExpandedPlannerHeightPreferenceKey: PreferenceKey {
    static let defaultValue: CGFloat = 0

    static func reduce(value: inout CGFloat, nextValue: () -> CGFloat) {
        value = nextValue()
    }
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
