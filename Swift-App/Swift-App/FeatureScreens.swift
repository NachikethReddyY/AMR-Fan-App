import SwiftUI

struct ChallengesScreen: View {
    @Binding var demoState: DemoFanState
    @State private var idea = ""
    @State private var showComposer = false
    @State private var selectedRace = RaceChallenge.examples.first(where: { !$0.isPast })?.race ?? RaceChallenge.examples.first?.race ?? ""
    @State private var challenges = RaceChallenge.examples
    @State private var activeContribution: ChallengeIdea?
    @State private var contributionPoints = "10"
    @State private var displayedIdeaCount = 4
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    private var selectedChallenge: RaceChallenge? {
        challenges.first { $0.race == selectedRace }
    }

    private var raceOptions: [String] {
        challenges.map(\.race)
    }

    private var visibleIdeas: [ChallengeIdea] {
        Array((selectedChallenge?.ideas ?? []).sorted { $0.rankingPoints > $1.rankingPoints }.prefix(displayedIdeaCount))
    }

    var body: some View {
        ZStack(alignment: .bottomTrailing) {
            ScrollView {
                VStack(alignment: .leading, spacing: 20) {
                    SectionHeader(title: "Fan challenges.",
                                  description: "Choose a race, vote for an idea, or propose what comes next.")

                    HStack(spacing: 12) {
                        Image(systemName: "bolt.fill")
                            .foregroundStyle(FanStyle.teal)
                        Text("\(demoState.greenPoints.formatted()) Green Points")
                            .font(.subheadline.bold())
                        Spacer()
                        Text("500 Green Points to submit")
                            .font(.caption.bold())
                            .foregroundStyle(FanStyle.muted)
                    }
                    .padding(16)
                    .background(FanStyle.panel, in: RoundedRectangle(cornerRadius: 18))

                    ScrollView(.horizontal, showsIndicators: false) {
                        HStack(spacing: 9) {
                            ForEach(raceOptions, id: \.self) { race in
                                Button {
                                    withAnimation(reduceMotion ? nil : FanMotion.quick) {
                                        selectedRace = race
                                        displayedIdeaCount = 4
                                    }
                                } label: {
                                    Text(race)
                                        .font(.subheadline.bold())
                                        .foregroundStyle(selectedRace == race ? .white : FanStyle.muted)
                                        .padding(.horizontal, 15)
                                        .padding(.vertical, 10)
                                        .background(selectedRace == race ? FanStyle.darkTeal : FanStyle.panel, in: Capsule())
                                        .overlay(Capsule().strokeBorder(selectedRace == race ? FanStyle.teal : .clear))
                                }
                                .buttonStyle(.plain)
                            }
                        }
                    }

                    if let selectedChallenge {
                        VStack(alignment: .leading, spacing: 5) {
                            Text(selectedChallenge.race)
                                .font(.system(size: 27, weight: .bold, design: .rounded))
                            Text(selectedChallenge.isPast ? "Past race · ranked by total contribution points" : "Next upcoming race · ranked by total contribution points")
                                .font(.caption)
                                .foregroundStyle(FanStyle.muted)
                        }

                        LazyVStack(spacing: 12) {
                            ForEach(visibleIdeas) { idea in
                                challengeCard(idea)
                                    .onAppear {
                                        if idea.id == visibleIdeas.last?.id, displayedIdeaCount < (selectedChallenge.ideas.count) {
                                            displayedIdeaCount += 4
                                        }
                                    }
                            }
                        }
                    }

                    if showComposer {
                        FeatureCard {
                            VStack(alignment: .leading, spacing: 15) {
                                HStack {
                                    Text("Propose a challenge")
                                        .font(.headline)
                                    Spacer()
                                    Text("500 points")
                                        .font(.caption.bold())
                                        .foregroundStyle(FanStyle.teal)
                                }
                                TextField("Describe your idea…", text: $idea, axis: .vertical)
                                    .lineLimit(3...6)
                                    .padding(14)
                                    .background(FanStyle.background, in: RoundedRectangle(cornerRadius: 12))
                                Button("Submit challenge", systemImage: "paperplane.fill") {
                                    submitIdea()
                                }
                                .font(.headline)
                                .frame(maxWidth: .infinity)
                                .padding(14)
                                .background(FanStyle.darkTeal, in: RoundedRectangle(cornerRadius: 14))
                                .disabled(idea.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty || demoState.greenPoints < 500)
                            }
                        }
                        .transition(.opacity.combined(with: .move(edge: .bottom)))
                    }
                }
                .padding(22)
                .padding(.bottom, 105)
                .frame(maxWidth: 520)
                .frame(maxWidth: .infinity)
            }
            .scrollIndicators(.hidden)
        }
        .background(FanStyle.background)
        .overlay(alignment: .bottomTrailing) {
            HStack(spacing: 12) {
                Button {
                    withAnimation(reduceMotion ? nil : FanMotion.content) { showComposer.toggle() }
                } label: {
                    Image(systemName: showComposer ? "xmark" : "plus")
                        .font(.title2.bold())
                        .frame(width: 58, height: 58)
                        .background(FanStyle.teal, in: Circle())
                        .foregroundStyle(.black)
                }
                .accessibilityLabel(showComposer ? "Close challenge composer" : "Propose a challenge")
            }
            .padding(.trailing, 22)
            .padding(.bottom, 22)
        }
        .sheet(item: $activeContribution) { idea in
            NavigationStack {
                VStack(alignment: .leading, spacing: 22) {
                    Text(idea.title)
                        .font(.system(size: 28, weight: .bold, design: .rounded))
                    Text("Add Green Points to this activity idea. Every point contributes to the shared ranking.")
                        .font(.subheadline)
                        .foregroundStyle(FanStyle.muted)
                    Stepper("\(contributionPoints) points", value: Binding(
                        get: { Int(contributionPoints) ?? 10 },
                        set: { contributionPoints = String(max(10, $0)) }
                    ), in: 10...9_000, step: 10)
                    .font(.headline)
                    Button("Add \(contributionPoints) points", systemImage: "bolt.fill") {
                        contribute()
                    }
                    .font(.headline)
                    .frame(maxWidth: .infinity)
                    .padding(16)
                    .background(FanStyle.teal, in: RoundedRectangle(cornerRadius: 15))
                    .foregroundStyle(.black)
                    .disabled((Int(contributionPoints) ?? 0) < 10 || (Int(contributionPoints) ?? 0) > demoState.greenPoints)
                    Spacer()
                }
                .padding(22)
                .navigationTitle("Contribute")
                .toolbar { Button("Cancel") { activeContribution = nil } }
            }
            .preferredColorScheme(.dark)
        }
    }

    @ViewBuilder
    private func challengeCard(_ idea: ChallengeIdea) -> some View {
        Button {
            guard !idea.isSelected else { return }
            activeContribution = idea
        } label: {
            HStack(alignment: .top, spacing: 12) {
                if idea.isSelected {
                    Image(systemName: "star.fill")
                        .foregroundStyle(.yellow)
                }
                VStack(alignment: .leading, spacing: 4) {
                    Text(idea.title)
                        .font(.subheadline.bold())
                        .foregroundStyle(.white)
                    Text("by \(idea.author) · \(idea.moderation)")
                        .font(.caption)
                        .foregroundStyle(FanStyle.muted)
                }
                Spacer()
                VStack(alignment: .trailing, spacing: 5) {
                    Text(idea.rankingPoints.formatted())
                        .font(.headline.bold())
                        .foregroundStyle(idea.isSelected ? .yellow : FanStyle.teal)
                    Text(idea.isSelected ? "Selected" : "Add points")
                        .font(.caption.bold())
                        .foregroundStyle(FanStyle.muted)
                }
            }
            .padding(15)
            .background(FanStyle.background, in: RoundedRectangle(cornerRadius: 14))
            .overlay(RoundedRectangle(cornerRadius: 14).strokeBorder(idea.isSelected ? .yellow : .clear, lineWidth: 1.5))
        }
        .buttonStyle(.plain)
        .accessibilityLabel(idea.isSelected ? "Selected idea \(idea.title)" : "Add points to \(idea.title)")
    }

    private func contribute() {
        guard let activeContribution,
              let points = Int(contributionPoints),
              points >= 10,
              demoState.greenPoints >= points,
              let challengeIndex = challenges.firstIndex(where: { $0.race == selectedRace }),
              let ideaIndex = challenges[challengeIndex].ideas.firstIndex(where: { $0.id == activeContribution.id }) else { return }
        demoState.greenPoints -= points
        challenges[challengeIndex].ideas[ideaIndex].rankingPoints += points
        self.activeContribution = nil
        contributionPoints = "10"
    }

    private func submitIdea() {
        let trimmedIdea = idea.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmedIdea.isEmpty, demoState.greenPoints >= 500 else { return }
        demoState.greenPoints -= 500
        if let challengeIndex = challenges.firstIndex(where: { $0.race == selectedRace }) {
            challenges[challengeIndex].ideas.insert(
                ChallengeIdea(id: UUID(), title: trimmedIdea, author: "You", tag: "activity", rankingPoints: 0, moderation: "pending", lifecycle: "backlog", fulfilment: "demonstration"),
                at: 0
            )
        }
        idea = ""
        showComposer = false
    }
}

struct TreeScreen: View {
    @Binding var demoState: DemoFanState
    @State private var searchText = ""
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @State private var activeSheet: PlantingSheet?
    @State private var selectedLocation: PlantingLocation?

    private var filteredTrees: [PlantedTree] {
        let query = searchText.trimmingCharacters(in: .whitespacesAndNewlines)
        return demoState.plantedTrees.filter {
            let matchesLocation = selectedLocation == nil || $0.location == selectedLocation
            let matchesQuery = query.isEmpty ||
            $0.species.localizedCaseInsensitiveContains(query) ||
            $0.location?.rawValue.localizedCaseInsensitiveContains(query) == true ||
            $0.location?.country.localizedCaseInsensitiveContains(query) == true ||
            (query.localizedCaseInsensitiveContains("pending") && $0.location == nil)
            return matchesLocation && matchesQuery
        }
    }

    private var locationSummaries: [ForestLocationSummary] {
        PlantingLocation.allCases.map { location in
            let trees = filteredTrees.filter { $0.location == location }
            return ForestLocationSummary(
                location: location,
                count: trees.count,
                carbonSavedKg: trees.reduce(0) { $0 + $1.carbonSavedKg }
            )
        }
    }

    var body: some View {
        ZStack(alignment: .bottomTrailing) {
            ScrollView {
                VStack(alignment: .leading, spacing: 18) {
                    HStack(spacing: 10) {
                        Image(systemName: "magnifyingglass")
                            .foregroundStyle(.white.opacity(0.72))
                        TextField("Search plants or places", text: $searchText)
                            .textInputAutocapitalization(.words)
                            .foregroundStyle(.white)
                    }
                    .padding(14)
                    .background(.white.opacity(0.12), in: RoundedRectangle(cornerRadius: 15))

                    VStack(alignment: .leading, spacing: 12) {
                        Text("Your digital forest")
                            .font(.system(size: 32, weight: .bold, design: .rounded))
                        Text("Redeemed plantings stay pending until the AMR team plants and assigns their real-world location.")
                            .font(.subheadline)
                            .foregroundStyle(.white.opacity(0.72))

                        DigitalForestCanopy(locations: locationSummaries)
                            .frame(height: 285)

                        HStack(spacing: 18) {
                            forestMetric("\(filteredTrees.count)", label: "PLANTINGS")
                            forestMetric("\(demoState.greenPoints.formatted())", label: "GREEN POINTS")
                            forestMetric(demoState.totalEstimatedCarbonKg.formatted(.number.precision(.fractionLength(1))), label: "KG CO₂E EST.")
                        }
                        if demoState.plantedTrees.contains(where: { $0.status == .pending }) {
                            Label("Pending · AMR will assign the location after planting", systemImage: "clock.badge.exclamationmark")
                                .font(.caption.bold())
                                .foregroundStyle(.orange)
                        }
                    }

                    Text("Confirmed plantings by location")
                        .font(.title3.bold())
                        .padding(.top, 8)

                    VStack(spacing: 10) {
                        ForEach(locationSummaries) { summary in
                            LocationSummaryCard(
                                summary: summary,
                                maximumCount: max(1, locationSummaries.map(\.count).max() ?? 1),
                                isSelected: selectedLocation == summary.location
                            ) {
                                withAnimation(reduceMotion ? nil : FanMotion.quick) {
                                    selectedLocation = selectedLocation == summary.location ? nil : summary.location
                                }
                            }
                        }
                    }

                    Text("Your plantings")
                        .font(.title3.bold())
                        .padding(.top, 8)

                    if filteredTrees.isEmpty {
                        FeatureCard {
                            VStack(alignment: .leading, spacing: 10) {
                                Text(searchText.isEmpty ? "No plantings yet" : "No plants match your search.")
                                    .font(.headline)
                                Text(searchText.isEmpty
                                     ? "Use + to choose a tree, bush, or plant and add it to your forest."
                                     : "Try searching by plant type, country, or location.")
                                    .font(.subheadline)
                                    .foregroundStyle(FanStyle.muted)
                            }
                        }
                    } else {
                        ForEach(filteredTrees) { tree in
                            PlantingRecordCard(tree: tree)
                                .transition(reduceMotion ? .opacity : .move(edge: .bottom).combined(with: .opacity))
                        }
                    }

                    Text("Prices are set by the rewards catalogue. AMR planting confirmation and location assignment are handled by the team.")
                        .font(.caption)
                        .foregroundStyle(.white.opacity(0.62))
                        .padding(.bottom, 100)
                }
                .padding(.horizontal, 20)
                .padding(.top, 14)
                .frame(maxWidth: 560)
                .frame(maxWidth: .infinity)
            }
            .scrollIndicators(.hidden)

            Button {
                activeSheet = .catalog
            } label: {
                Image(systemName: "plus")
                    .font(.title2.bold())
                    .foregroundStyle(.black)
                    .frame(width: 56, height: 56)
                    .background(FanStyle.teal, in: Circle())
                    .shadow(color: .black.opacity(0.35), radius: 14, y: 7)
            }
            .accessibilityLabel("Add a planting")
            .padding(.trailing, 22)
            .padding(.bottom, 24)
        }
        .background(
            LinearGradient(
                colors: [Color(red: 0.06, green: 0.34, blue: 0.28), Color(red: 0.03, green: 0.17, blue: 0.15), FanStyle.background],
                startPoint: .top,
                endPoint: .bottom
            )
            .ignoresSafeArea()
        )
        .navigationTitle("Forest")
        .navigationBarTitleDisplayMode(.inline)
        .sheet(item: $activeSheet) { sheet in
            switch sheet {
            case .catalog:
                PlantingCatalogSheet { kind in
                    activeSheet = .confirmation(kind)
                }
            case .confirmation(let kind):
                PlantingConfirmationSheet(kind: kind, demoState: $demoState) {
                    activeSheet = nil
                }
            }
        }
    }

    private func forestMetric(_ value: String, label: String) -> some View {
        VStack(alignment: .leading, spacing: 3) {
            Text(value)
                .font(.headline)
            Text(label)
                .font(.system(size: 9, weight: .bold))
                .foregroundStyle(.white.opacity(0.62))
                .tracking(0.8)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }
}

private enum PlantingSheet: Identifiable {
    case catalog
    case confirmation(TreeKind)

    var id: String {
        switch self {
        case .catalog: "catalog"
        case .confirmation(let kind): "confirmation-\(kind.rawValue)"
        }
    }
}

private struct ForestLocationSummary: Identifiable {
    let location: PlantingLocation
    let count: Int
    let carbonSavedKg: Double

    var id: PlantingLocation { location }
}

private struct LocationSummaryCard: View {
    let summary: ForestLocationSummary
    let maximumCount: Int
    let isSelected: Bool
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            HStack(spacing: 12) {
                Text(summary.location.flag)
                    .font(.title2)
                VStack(alignment: .leading, spacing: 6) {
                    HStack {
                        Text(summary.location.rawValue)
                            .font(.headline)
                        Spacer()
                        Text("\(summary.count)")
                            .font(.headline.monospacedDigit())
                    }
                            Text("\(summary.count) planting\(summary.count == 1 ? "" : "s") · \(summary.carbonSavedKg, specifier: "%.1f") kg CO₂e estimated")
                        .font(.caption)
                        .foregroundStyle(FanStyle.muted)
                    ProgressView(value: Double(summary.count), total: Double(maximumCount))
                        .tint(FanStyle.teal)
                }
                Image(systemName: isSelected ? "checkmark.circle.fill" : "chevron.right")
                    .font(.caption.bold())
                    .foregroundStyle(isSelected ? FanStyle.teal : FanStyle.muted)
            }
            .foregroundStyle(.white)
            .padding(14)
            .background(isSelected ? FanStyle.darkTeal : FanStyle.panel, in: RoundedRectangle(cornerRadius: 17))
        }
        .buttonStyle(.plain)
    }
}

private struct PlantingRecordCard: View {
    let tree: PlantedTree

    var body: some View {
        FeatureCard {
            HStack(spacing: 14) {
                Image(systemName: tree.kind.symbol)
                    .font(.title2)
                    .foregroundStyle(FanStyle.teal)
                    .frame(width: 44, height: 44)
                    .background(FanStyle.darkTeal, in: RoundedRectangle(cornerRadius: 12))
                VStack(alignment: .leading, spacing: 4) {
                    Text(tree.species)
                        .font(.headline)
                    if let location = tree.location {
                        Text("\(location.flag) \(location.rawValue)")
                            .font(.caption)
                            .foregroundStyle(FanStyle.muted)
                    } else {
                        Text("Location pending AMR assignment")
                            .font(.caption)
                            .foregroundStyle(.orange)
                    }
                    Text("\(tree.status.rawValue) · \(tree.plantedDate)")
                        .font(.caption2)
                        .foregroundStyle(tree.status == .pending ? .orange : FanStyle.teal)
                    Text("Estimated saving: \(tree.carbonSavedKg, specifier: "%.1f") kg CO₂e")
                        .font(.caption2)
                        .foregroundStyle(FanStyle.teal)
                }
                Spacer()
            }
        }
    }
}

private struct PlantingCatalogSheet: View {
    let select: (TreeKind) -> Void
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 16) {
                    Text("Choose a planting")
                        .font(.system(size: 30, weight: .bold, design: .rounded))
                    Text("Select a card to choose quantity before spending Green Points.")
                        .font(.subheadline)
                        .foregroundStyle(FanStyle.muted)
                    ForEach(TreeKind.allCases) { kind in
                        Button { select(kind) } label: {
                            VStack(alignment: .leading, spacing: 12) {
                                HStack {
                                    Image(systemName: kind.symbol)
                                        .font(.title2)
                                        .foregroundStyle(FanStyle.teal)
                                    Text(kind.rawValue)
                                        .font(.title3.bold())
                                    Spacer()
                                    Image(systemName: "chevron.right")
                                        .foregroundStyle(FanStyle.muted)
                                }
                                Text("\(kind.pointsCost.formatted()) Green Points")
                                    .font(.subheadline)
                                Text("Estimated saving: \(kind.carbonSavedKg, specifier: "%.1f") kg CO₂e")
                                    .font(.caption)
                                    .foregroundStyle(FanStyle.muted)
                            }
                            .foregroundStyle(.white)
                            .padding(18)
                            .background(FanStyle.panel, in: RoundedRectangle(cornerRadius: 20))
                        }
                        .buttonStyle(.plain)
                    }
                    Text("Prices and carbon values are set by the rewards catalogue.")
                        .font(.caption)
                        .foregroundStyle(FanStyle.muted)
                }
                .padding(22)
            }
            .background(FanStyle.background)
            .navigationTitle("Add to forest")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Close") { dismiss() }
                }
            }
        }
        .presentationDetents([.medium, .large])
        .preferredColorScheme(.dark)
    }
}

private struct PlantingConfirmationSheet: View {
    let kind: TreeKind
    @Binding var demoState: DemoFanState
    let onComplete: () -> Void
    @State private var quantity = 1
    @Environment(\.dismiss) private var dismiss

    private var totalCost: Int { kind.pointsCost * quantity }
    private var totalCarbon: Double { kind.carbonSavedKg * Double(quantity) }
    private var canRedeem: Bool { demoState.greenPoints >= totalCost }

    var body: some View {
        NavigationStack {
            VStack(alignment: .leading, spacing: 20) {
                Text(kind.rawValue)
                    .font(.system(size: 32, weight: .bold, design: .rounded))
                Text("Choose how many to add. AMR assigns the real planting location after fulfilment.")
                    .font(.subheadline)
                    .foregroundStyle(FanStyle.muted)

                HStack {
                    Text("Quantity")
                        .font(.headline)
                    Spacer()
                    Stepper("\(quantity)", value: $quantity, in: 1...10)
                        .labelsHidden()
                    Text("\(quantity)")
                        .font(.headline.monospacedDigit())
                        .frame(width: 28)
                }
                .padding(14)
                .background(FanStyle.panel, in: RoundedRectangle(cornerRadius: 14))

                VStack(alignment: .leading, spacing: 8) {
                    Text("Confirmation")
                        .font(.headline)
                    Text("Spend \(totalCost.formatted()) Green Points")
                    Text("Add \(quantity) pending planting\(quantity == 1 ? "" : "s")")
                    Text("Estimated saving: \(totalCarbon, specifier: "%.1f") kg CO₂e")
                        .foregroundStyle(FanStyle.teal)
                    Text("The AMR team must confirm planting before it is considered planted.")
                        .font(.caption)
                        .foregroundStyle(.orange)
                }
                .padding(16)
                .background(FanStyle.panel, in: RoundedRectangle(cornerRadius: 18))

                Spacer()

                Button {
                    guard demoState.redeem(kind, quantity: quantity) else { return }
                    onComplete()
                    dismiss()
                } label: {
                    Text(canRedeem ? "Confirm redemption" : "Not enough Green Points")
                        .font(.headline)
                        .frame(maxWidth: .infinity)
                        .padding(16)
                        .background(canRedeem ? FanStyle.teal : Color.white.opacity(0.10), in: RoundedRectangle(cornerRadius: 16))
                        .foregroundStyle(canRedeem ? .black : FanStyle.muted)
                }
                .disabled(!canRedeem)
            }
            .padding(22)
            .background(FanStyle.background)
            .navigationTitle("Review redemption")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                }
            }
        }
        .presentationDetents([.large])
        .preferredColorScheme(.dark)
    }
}

private struct DigitalForestCanopy: View {
    let locations: [ForestLocationSummary]

    var body: some View {
        IsometricForestPlot(locations: locations)
            .accessibilityLabel("Digital forest with locations grouped by country")
    }
}

private struct IsometricForestPlot: View {
    let locations: [ForestLocationSummary]
    private let positions: [CGPoint] = [CGPoint(x: 0.26, y: 0.55), CGPoint(x: 0.52, y: 0.32), CGPoint(x: 0.73, y: 0.58)]

    var body: some View {
        GeometryReader { geometry in
            let width = geometry.size.width
            let height = geometry.size.height
            let top = CGPoint(x: width / 2, y: 18)
            let right = CGPoint(x: width - 16, y: height * 0.47)
            let bottom = CGPoint(x: width / 2, y: height * 0.77)
            let left = CGPoint(x: 16, y: height * 0.47)
            ZStack {
                IsometricSide(points: [left, bottom, CGPoint(x: bottom.x, y: height - 12), CGPoint(x: left.x, y: height * 0.62)])
                    .fill(Color(red: 0.17, green: 0.28, blue: 0.10))
                IsometricSide(points: [bottom, right, CGPoint(x: right.x, y: height * 0.62), CGPoint(x: bottom.x, y: height - 12)])
                    .fill(Color(red: 0.25, green: 0.38, blue: 0.12))
                IsometricSide(points: [top, right, bottom, left])
                    .fill(LinearGradient(colors: [Color(red: 0.64, green: 0.86, blue: 0.22), Color(red: 0.37, green: 0.63, blue: 0.13)], startPoint: .topLeading, endPoint: .bottomTrailing))
                    .overlay { IsometricGrid().clipShape(IsometricSide(points: [top, right, bottom, left])) }

                ForEach(Array(locations.filter { $0.count > 0 }.enumerated()), id: \.offset) { index, summary in
                    ForestLocationMarker(summary: summary)
                        .position(x: left.x + (right.x - left.x) * positions[min(index, positions.count - 1)].x,
                                  y: top.y + (bottom.y - top.y) * positions[min(index, positions.count - 1)].y)
                }
            }
        }
        .background(FanStyle.background)
        .clipShape(RoundedRectangle(cornerRadius: 22))
    }
}

private struct IsometricSide: Shape {
    let points: [CGPoint]

    func path(in _: CGRect) -> Path {
        var path = Path()
        guard let first = points.first else { return path }
        path.move(to: first)
        for point in points.dropFirst() {
            path.addLine(to: point)
        }
        path.closeSubpath()
        return path
    }
}

private struct IsometricGrid: View {
    var body: some View {
        Canvas { context, size in
            let color = Color.white.opacity(0.10)
            for index in 1..<7 {
                let fraction = CGFloat(index) / 7
                var diagonal = Path()
                diagonal.move(to: CGPoint(x: size.width * fraction, y: size.height * 0.18))
                diagonal.addLine(to: CGPoint(x: size.width * (fraction * 0.55 + 0.23), y: size.height * 0.72))
                context.stroke(diagonal, with: .color(color), lineWidth: 1)
            }
        }
    }
}

private struct ForestLocationMarker: View {
    let summary: ForestLocationSummary

    var body: some View {
        VStack(spacing: 4) {
            ZStack {
                Circle()
                    .fill(Color(red: 0.08, green: 0.45, blue: 0.35))
                    .frame(width: 54, height: 54)
                    .shadow(color: .black.opacity(0.25), radius: 7, y: 6)
                Image(systemName: "tree.fill")
                    .font(.system(size: 28))
                    .foregroundStyle(FanStyle.teal)
            }
            Text("\(summary.location.flag) \(summary.count)")
                .font(.caption.bold())
                .padding(.horizontal, 7)
                .padding(.vertical, 4)
                .background(FanStyle.background.opacity(0.85), in: Capsule())
        }
    }
}

private struct ProfileRow: View {
    let title: String
    let symbol: String
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            HStack(spacing: 12) {
                Image(systemName: symbol)
                    .foregroundStyle(FanStyle.teal)
                    .frame(width: 22)
                Text(title)
                    .font(.system(size: 15, weight: .bold))
                Spacer()
                Image(systemName: "chevron.right")
                    .font(.caption.bold())
                    .foregroundStyle(FanStyle.muted)
            }
            .foregroundStyle(.white)
            .padding(.vertical, 12)
        }
        .buttonStyle(FanPressStyle())
    }
}

private func fanInitials(from displayName: String) -> String {
    let words = displayName.split(separator: " ")
    if words.count >= 2 {
        return String(words[0].prefix(1) + words[1].prefix(1)).uppercased()
    }
    return String(displayName.prefix(2)).uppercased()
}

private struct PennantEdge: Shape {
    func path(in rect: CGRect) -> Path {
        let notch: CGFloat = 26
        var path = Path()
        path.move(to: .zero)
        path.addLine(to: CGPoint(x: rect.maxX - notch, y: 0))
        path.addLine(to: CGPoint(x: rect.maxX, y: rect.midY))
        path.addLine(to: CGPoint(x: rect.maxX - notch, y: rect.maxY))
        path.addLine(to: CGPoint(x: 0, y: rect.maxY))
        path.closeSubpath()
        return path
    }
}

private struct AchievementPin: View {
    let symbol: String
    let earned: Bool
    let pinColor: Color
    let action: () -> Void

    private var isEmptySlot: Bool { symbol == "circle.dotted" }

    var body: some View {
        Button(action: action) {
            ZStack {
                if isEmptySlot {
                    Circle()
                        .stroke(FanStyle.muted.opacity(0.8), style: StrokeStyle(lineWidth: 1.5, dash: [3, 3]))
                        .frame(width: 44, height: 44)
                    Image(systemName: "plus")
                        .font(.system(size: 15, weight: .semibold))
                        .foregroundStyle(FanStyle.muted)
                } else {
                    Image(systemName: symbol)
                        .font(.system(size: 17, weight: .bold))
                        .foregroundStyle(earned ? FanStyle.darkTeal : FanStyle.muted)
                        .frame(width: 48, height: 48)
                        .background(pinColor, in: Circle())
                }
            }
            .frame(width: 48, height: 48)
        }
        .buttonStyle(FanPressStyle())
        .accessibilityLabel(isEmptySlot ? "Add an achievement badge." : earned ? "Achievement earned. View achievements." : "Locked achievement. View achievements.")
    }
}

private struct AchievementCorkPin: View {
    let badge: FanAchievement

    var body: some View {
        VStack(spacing: 6) {
            ZStack(alignment: .top) {
                Image(systemName: badge.earned ? badge.symbol : "lock.fill")
                    .font(.title2)
                    .foregroundStyle(badge.earned ? .white : FanStyle.muted)
                    .frame(width: 58, height: 58)
                    .background(badge.earned ? badge.tint : FanStyle.panel, in: Circle())
                    .overlay(Circle().strokeBorder(Color(red: 0.85, green: 0.81, blue: 0.75), lineWidth: 2))
                Circle()
                    .fill(.red)
                    .frame(width: 10, height: 10)
                    .offset(y: -4)
            }
            .opacity(badge.earned ? 1 : 0.45)
            Text(badge.title)
                .font(.caption2.bold())
                .foregroundStyle(FanStyle.muted)
                .multilineTextAlignment(.center)
        }
    }
}

private struct AchievementDetail: View {
    let badge: FanAchievement
    let earnedOn: String?

    var body: some View {
        VStack(spacing: 16) {
            Image(systemName: badge.earned ? badge.symbol : "lock.fill")
                .font(.system(size: 44))
                .foregroundStyle(.white)
                .frame(width: 96, height: 96)
                .background(badge.earned ? badge.tint : FanStyle.panel, in: Circle())
            Text(badge.title)
                .font(.title2.bold())
            Text(badge.earned ? "Earned" : "Locked")
                .font(.caption.bold())
                .padding(.horizontal, 14)
                .padding(.vertical, 6)
                .background(badge.earned ? badge.tint : FanStyle.panel, in: Capsule())
            Text(badge.requirement)
                .font(.subheadline)
                .foregroundStyle(FanStyle.muted)
                .multilineTextAlignment(.center)
            if let earnedOn, let display = displayEarnedDate(earnedOn) {
                Text("Earned on \(display).")
                    .font(.caption)
                    .foregroundStyle(FanStyle.muted)
            }
            Spacer()
        }
        .padding(28)
        .frame(maxWidth: .infinity)
        .background(FanStyle.background)
    }
}

struct FanAchievement: Identifiable {
    let id: String
    let symbol: String
    let title: String
    let earned: Bool
    let tint: Color
    let requirement: String
}

// FIXME: placeholder set until the backend supplies achievements and ranks.
// Earned dates also need backend event history before "earned when" can be shown.
let fanAchievements: [FanAchievement] = [
    FanAchievement(id: "first-race", symbol: "trophy.fill", title: "First race", earned: true, tint: Color(red: 0.96, green: 0.70, blue: 0.01), requirement: "Open the app on a Grand Prix race day."),
    FanAchievement(id: "green-trip", symbol: "leaf.fill", title: "Green trip", earned: true, tint: Color(red: 0.30, green: 0.75, blue: 0.35), requirement: "Log one lower-impact trip to a race weekend."),
    FanAchievement(id: "seven-day", symbol: "flame.fill", title: "7-day streak", earned: true, tint: Color(red: 0.95, green: 0.45, blue: 0.10), requirement: "Open the app 7 days in a row."),
    FanAchievement(id: "race-iq", symbol: "brain.head.profile", title: "Race IQ debut", earned: true, tint: Color(red: 0.55, green: 0.35, blue: 0.85), requirement: "Play your first Race IQ quiz."),
    FanAchievement(id: "early-fan", symbol: "star.fill", title: "Early supporter", earned: true, tint: FanStyle.teal, requirement: "Pick your driver in the first week of the season."),
    FanAchievement(id: "quiz-master", symbol: "questionmark.circle.fill", title: "Quiz master", earned: false, tint: Color(red: 0.20, green: 0.55, blue: 0.95), requirement: "Score 5 out of 5 in three daily quizzes."),
    FanAchievement(id: "superfan", symbol: "heart.fill", title: "Superfan", earned: false, tint: Color(red: 0.90, green: 0.25, blue: 0.35), requirement: "Earn 1,000 lifetime Green Points."),
    FanAchievement(id: "globetrotter", symbol: "globe", title: "Globetrotter", earned: false, tint: Color(red: 0.10, green: 0.65, blue: 0.80), requirement: "Plan trips to three different Grands Prix."),
    FanAchievement(id: "helper", symbol: "hand.raised.fill", title: "Helper", earned: false, tint: Color(red: 0.95, green: 0.75, blue: 0.20), requirement: "Verify five fan activities."),
    FanAchievement(id: "night-owl", symbol: "moon.fill", title: "Night owl", earned: false, tint: Color(red: 0.30, green: 0.30, blue: 0.70), requirement: "Check race results after midnight five times."),
    FanAchievement(id: "photographer", symbol: "camera.fill", title: "Paddock eye", earned: false, tint: Color(red: 0.60, green: 0.40, blue: 0.65), requirement: "Submit ten verified sustainability photos."),
    FanAchievement(id: "legend", symbol: "crown.fill", title: "Legend", earned: false, tint: Color(red: 0.85, green: 0.60, blue: 0.05), requirement: "Earn every other badge on this board."),
]

func showcasedBadgeIDs(from raw: String) -> [String] {
    let ids = raw.split(separator: ",").map(String.init).filter { id in fanAchievements.contains(where: { $0.id == id }) }
    return Array((ids + ["", "", ""]).prefix(3))
}

func achievement(for id: String) -> FanAchievement? {
    fanAchievements.first(where: { $0.id == id })
}

/// Earliest-known earned dates, stamped on device the first time each badge is
/// seen as earned. True historical dates need backend event history.
func earnedDates(from raw: String) -> [String: String] {
    var dates: [String: String] = [:]
    for pair in raw.split(separator: ";") {
        let parts = pair.split(separator: "=", maxSplits: 1).map(String.init)
        if parts.count == 2 { dates[parts[0]] = parts[1] }
    }
    return dates
}

func stampEarnedDates(current: String) -> String {
    var dates = earnedDates(from: current)
    let formatter = DateFormatter()
    formatter.dateFormat = "yyyy-MM-dd"
    let today = formatter.string(from: .now)
    for badge in fanAchievements where badge.earned && dates[badge.id] == nil {
        dates[badge.id] = today
    }
    return dates.map { "\($0.key)=\($0.value)" }.sorted().joined(separator: ";")
}

func displayEarnedDate(_ isoDate: String?) -> String? {
    guard let isoDate else { return nil }
    let parser = DateFormatter()
    parser.dateFormat = "yyyy-MM-dd"
    guard let date = parser.date(from: isoDate) else { return nil }
    let formatter = DateFormatter()
    formatter.dateFormat = "d MMM yyyy"
    return formatter.string(from: date)
}

struct AchievementsScreen: View {
    private let pins = fanAchievements
    @State private var selected: FanAchievement?
    @AppStorage("badgeEarnedDates") private var badgeEarnedDates = ""

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 18) {
                SectionHeader(title: "Achievements.",
                              description: "Earned pins live on your corkboard. Tap any pin to see how to earn it.")
                LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible()), GridItem(.flexible())], spacing: 20) {
                    ForEach(pins) { badge in
                        Button { selected = badge } label: {
                            AchievementCorkPin(badge: badge)
                        }
                        .buttonStyle(FanPressStyle())
                    }
                }
                .padding(18)
                .background(Color(red: 0.54, green: 0.37, blue: 0.19), in: RoundedRectangle(cornerRadius: 20))
                .overlay(RoundedRectangle(cornerRadius: 20).strokeBorder(Color(red: 0.5, green: 0.7, blue: 0.68), lineWidth: 8))
            }
            .padding(22)
            .frame(maxWidth: 520)
            .frame(maxWidth: .infinity)
        }
        .background(FanStyle.background)
        .onAppear {
            badgeEarnedDates = stampEarnedDates(current: badgeEarnedDates)
        }
        .sheet(item: $selected) { badge in
            NavigationStack {
                AchievementDetail(badge: badge, earnedOn: earnedDates(from: badgeEarnedDates)[badge.id])
                    .toolbar {
                        ToolbarItem(placement: .primaryAction) {
                            Button("Close", systemImage: "xmark") { selected = nil }
                                .labelStyle(.iconOnly)
                        }
                    }
            }
            .preferredColorScheme(.dark)
        }
    }
}

private struct ProfileStatRow: View {
    let label: String
    let value: String

    var body: some View {
        HStack {
            Text(label)
                .font(.subheadline)
                .foregroundStyle(FanStyle.muted)
            Spacer()
            Text(value)
                .font(.headline)
        }
        .padding(.vertical, 10)
    }
}

struct ProfileScreen: View {
    @ObservedObject var backend: BackendSession
    let driver: Driver
    let streak: Int
    let greenPoints: Int
    let changeDriver: () -> Void
    let showTour: () -> Void
    @State private var showAccount = false
    @State private var showAchievements = false
    @AppStorage("showcaseBadges") private var showcaseBadges = "first-race,green-trip,seven-day"
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 20) {
                if let profile = backend.realProfile {
                    profileBanner(displayName: profile.displayName, balance: profile.balance)

                    FeatureCard {
                        VStack(spacing: 0) {
                            ProfileStatRow(label: "Earned points", value: "\(profile.balance)")
                            Divider().background(.white.opacity(0.08))
                            ProfileStatRow(label: "Day streak", value: "\(streak)")
                            Divider().background(.white.opacity(0.08))
                            ProfileStatRow(label: "Green Points", value: "\(greenPoints)")
                        }
                    }
                } else {
                    SectionHeader(title: "Profile.",
                                  description: "Your driver. Your journey.")

                    Image(driver.imageName)
                        .resizable()
                        .scaledToFill()
                        .frame(height: 235)
                        .clipped()
                        .clipShape(RoundedRectangle(cornerRadius: 22))
                        .overlay(alignment: .bottomLeading) {
                            HStack(spacing: 10) {
                                Text("#\(driver.number)")
                                    .font(.system(size: 15, weight: .heavy, design: .rounded))
                                    .foregroundStyle(.white)
                                    .padding(.horizontal, 12)
                                    .padding(.vertical, 7)
                                    .background(FanStyle.teal.opacity(0.85), in: Capsule())
                                Spacer()
                            }
                            .padding(16)
                        }

                    FeatureCard {
                        HStack(spacing: 14) {
                            Text(String(driver.firstName.prefix(1) + driver.rawValue.prefix(1)))
                                .font(.headline.bold())
                                .foregroundStyle(.white)
                                .frame(width: 52, height: 52)
                                .background(FanStyle.teal.opacity(0.35), in: Circle())
                            VStack(alignment: .leading, spacing: 4) {
                                Text("\(driver.firstName) \(driver.rawValue)")
                                    .font(.title3.bold())
                                Text("Your choice is saved on this device.")
                                    .font(.caption).foregroundStyle(FanStyle.muted)
                            }
                            Spacer()
                        }
                    }
                }

                FeatureCard {
                    VStack(spacing: 0) {
                        ProfileRow(title: "Change your driver", symbol: "arrow.left.arrow.right") {
                            dismiss()
                            changeDriver()
                        }
                        Divider().background(.white.opacity(0.08)).padding(.leading, 46)
                        if backend.realProfile != nil {
                            ProfileRow(title: "Change name", symbol: "person.crop.circle.fill") {
                                showAccount = true
                            }
                        } else {
                            ProfileRow(title: "Sign in or create account", symbol: "person.crop.circle") {
                                showAccount = true
                            }
                        }
                        Divider().background(.white.opacity(0.08)).padding(.leading, 46)
                        ProfileRow(title: "Explore app features", symbol: "questionmark.circle") {
                            dismiss()
                            showTour()
                        }
                    }
                }

                if backend.realProfile == nil {
                    Text("Sign in to sync your backend profile and earned balance.")
                        .font(.caption).foregroundStyle(FanStyle.muted)
                }
            }
            .padding([.horizontal, .bottom], 22)
            .padding(.top, -64)
            .frame(maxWidth: 520)
            .frame(maxWidth: .infinity)
        }
        .background(FanStyle.background)
        .sheet(isPresented: $showAccount) {
            NavigationStack {
                AccountScreen(backend: backend)
                    .toolbar {
                        ToolbarItem(placement: .primaryAction) {
                            Button("Close", systemImage: "xmark") { showAccount = false }
                                .labelStyle(.iconOnly)
                        }
                    }
            }
            .preferredColorScheme(.dark)
        }
        .sheet(isPresented: $showAchievements) {
            NavigationStack {
                AchievementsScreen()
                    .toolbar {
                        ToolbarItem(placement: .primaryAction) {
                            Button("Close", systemImage: "xmark") { showAchievements = false }
                                .labelStyle(.iconOnly)
                        }
                    }
            }
            .preferredColorScheme(.dark)
        }
    }

    private func profileBanner(displayName: String, balance: Int) -> some View {
        // FIXME: rank, tier and pins are sketch placeholders until the backend
        // supplies leaderboard and achievement data.
        let pinGrey = Color(red: 0.85, green: 0.85, blue: 0.85)
        return VStack(spacing: 0) {
            ZStack(alignment: .topLeading) {
                Color.clear.frame(height: 214)
                PennantEdge()
                    .fill(FanStyle.teal)
                    .frame(height: 100)
                    .padding(.top, 90)
                Image(driver.cutoutImageName)
                    .resizable()
                    .scaledToFit()
                    .frame(height: 185)
                    .padding(.leading, 6)
                    .padding(.top, 5)
                    .offset(x: -18)
                Text(displayName)
                    .font(.system(size: 18, weight: .black))
                    .lineLimit(2)
                    .minimumScaleFactor(0.72)
                    .allowsTightening(true)
                    .padding(.leading, 150)
                    .padding(.trailing, 34)
                    .padding(.top, 100)
            }
            .overlay(alignment: .bottomLeading) {
                HStack(spacing: 12) {
                    ForEach(Array(showcasedBadgeIDs(from: showcaseBadges).enumerated()), id: \.offset) { _, id in
                        let badge = achievement(for: id)
                        AchievementPin(symbol: badge?.symbol ?? "circle.dotted", earned: badge?.earned ?? false, pinColor: pinGrey) { showAchievements = true }
                    }
                }
                .padding(.leading, 16)
            }
            .overlay(alignment: .bottomTrailing) {
                Text("Rookie")
                    .font(.system(size: 14, weight: .black))
                    .padding(.horizontal, 16)
                    .padding(.vertical, 6)
                    .background(Color(red: 0.72, green: 0.94, blue: 0.29), in: Capsule())
                    .foregroundStyle(.black)
                    .padding(.trailing, 10)
                    .offset(y: -9)
            }
            Spacer().frame(height: 8)
        }
        .toolbar {
            ToolbarItem(placement: .primaryAction) {
                Button { showAccount = true } label: {
                    Image(systemName: "pencil")
                        .font(.system(size: 13, weight: .bold))
                        .foregroundStyle(.white)
                        .frame(width: 32, height: 32)
                        .background(Color(red: 0, green: 0.53, blue: 1), in: Circle())
                }
                .accessibilityLabel("Change name")
            }
        }
    }
}

struct HistoryScreen: View {
    @EnvironmentObject private var backend: BackendSession

    var body: some View {
        VStack(alignment: .leading, spacing: 24) {
            SectionHeader(title: "History.",
                          description: "Your journeys and points.")
            if let history = backend.history {
                if history.entries.isEmpty {
                    emptyState("No points activity yet.")
                } else {
                    ForEach(history.entries) { entry in
                        FeatureCard {
                            HStack {
                                VStack(alignment: .leading, spacing: 5) {
                                    Text(entry.reason).font(.headline)
                                    Text(entry.recordedAt).font(.caption).foregroundStyle(FanStyle.muted)
                                }
                                Spacer()
                                Text("\(entry.delta >= 0 ? "+" : "")\(entry.delta)")
                                    .font(.headline)
                                    .foregroundStyle(entry.delta >= 0 ? FanStyle.teal : .orange)
                            }
                        }
                    }
                }
            } else {
                FeatureCard {
                    Label("Connect your account", systemImage: "person.crop.circle")
                        .font(.headline)
                    Text("Sign in to load points history from the backend.")
                        .font(.subheadline).foregroundStyle(FanStyle.muted).padding(.top, 10)
                }
            }
            Spacer()
        }
        .padding(22)
        .frame(maxWidth: 520)
        .frame(maxWidth: .infinity)
        .background(FanStyle.background)
        .task { await backend.loadHistory() }
    }

    private func emptyState(_ text: String) -> some View {
        FeatureCard {
            Label(text, systemImage: "clock.arrow.circlepath")
                .font(.headline)
        }
    }
}

struct EditorialScreen: View {
    let title: String
    let symbol: String
    let description: String

    var body: some View {
        VStack(alignment: .leading, spacing: 24) {
            SectionHeader(title: title, description: description)
            FeatureCard {
                VStack(alignment: .leading, spacing: 18) {
                    Image(systemName: symbol)
                        .font(.system(size: 54))
                        .foregroundStyle(FanStyle.teal)
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 46)
                    Text("Something exciting is on its way.")
                        .font(.title3.bold())
                    Text("Live content will appear here when connected.")
                        .font(.subheadline).foregroundStyle(FanStyle.muted)
                }
            }
            Spacer()
        }
        .padding(22)
        .frame(maxWidth: 520)
        .frame(maxWidth: .infinity)
        .background(FanStyle.background)
    }
}

struct QuizScreen: View {
    @Binding var demoState: DemoFanState
    @State private var questionIndex = 0
    @State private var selectedAnswer: Int?
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @State private var correctCount = 0

    private let questions: [(prompt: String, answers: [String], correct: Int)] = [
        ("What does the chequered flag mean?", ["The race is over", "A safety car is out", "The pits are open"], 0),
        ("Where does the driver on pole position start?", ["At the back", "At the front", "From the pit lane"], 1),
        ("What does a red flag mean?", ["One lap left", "The session is stopped", "A driver has won"], 1)
    ]

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 22) {
                SectionHeader(title: "Race IQ.",
                              description: "Complete today's quiz to earn 100 Green Points.")

                if questionIndex < questions.count {
                    let question = questions[questionIndex]
                    Text("QUESTION \(questionIndex + 1) / \(questions.count)")
                        .font(.system(size: 11, weight: .heavy)).tracking(2)
                        .foregroundStyle(FanStyle.teal)

                    FeatureCard {
                        Text(question.prompt)
                            .font(.system(size: 27, weight: .bold, design: .rounded))
                            .padding(.vertical, 15)
                    }

                    ForEach(question.answers.indices, id: \.self) { answerIndex in
                        Button {
                            guard selectedAnswer == nil else { return }
                            withAnimation(reduceMotion ? nil : FanMotion.quick) {
                                selectedAnswer = answerIndex
                                if answerIndex == question.correct { correctCount += 1 }
                            }
                        } label: {
                            HStack {
                                Text(question.answers[answerIndex])
                                Spacer()
                                if selectedAnswer != nil && answerIndex == question.correct {
                                    Image(systemName: "checkmark.circle.fill")
                                        .foregroundStyle(FanStyle.teal)
                                } else if selectedAnswer == answerIndex {
                                    Image(systemName: "xmark.circle.fill")
                                        .foregroundStyle(FanStyle.teal)
                                }
                            }
                            .font(.subheadline.bold())
                            .padding(19)
                            .background(FanStyle.panel, in: RoundedRectangle(cornerRadius: 17))
                            .overlay(RoundedRectangle(cornerRadius: 17)
                                .strokeBorder(selectedAnswer != nil && answerIndex == question.correct ? FanStyle.teal : .clear))
                        }
                        .buttonStyle(.plain)
                    }

                    if selectedAnswer != nil {
                        FanButton(title: questionIndex + 1 == questions.count ? "See results" : "Next question",
                                  symbol: "arrow.right") {
                            if questionIndex + 1 == questions.count {
                                _ = demoState.claimDailyQuizReward()
                            }
                            withAnimation(reduceMotion ? nil : FanMotion.content) {
                                questionIndex += 1
                                selectedAnswer = nil
                            }
                        }
                    }
                } else {
                    FeatureCard {
                        VStack(alignment: .leading, spacing: 16) {
                            Image(systemName: "flag.checkered")
                                .font(.system(size: 52)).foregroundStyle(FanStyle.teal)
                            Text("\(correctCount) out of \(questions.count)")
                                .font(.system(size: 35, weight: .bold, design: .rounded))
                            Text(demoState.lastQuizRewardDay == Date.now.formatted(date: .numeric, time: .omitted)
                                 ? "Today's reward has been added to your Green Points. Come back tomorrow for the next quiz."
                                 : "Today's reward is already claimed. Come back tomorrow for the next quiz.")
                                .font(.subheadline).foregroundStyle(FanStyle.muted)
                        }
                    }
                    FanButton(
                        title: demoState.lastQuizRewardDay == Date.now.formatted(date: .numeric, time: .omitted)
                            ? "Reward claimed today"
                            : "Play again",
                        symbol: demoState.lastQuizRewardDay == Date.now.formatted(date: .numeric, time: .omitted)
                            ? "checkmark.circle.fill"
                            : "arrow.clockwise"
                    ) {
                        withAnimation(reduceMotion ? nil : FanMotion.content) {
                            questionIndex = 0
                            selectedAnswer = nil
                            correctCount = 0
                        }
                    }
                    .disabled(demoState.lastQuizRewardDay == Date.now.formatted(date: .numeric, time: .omitted))
                }
            }
            .padding(22)
            .frame(maxWidth: 520)
            .frame(maxWidth: .infinity)
        }
        .background(FanStyle.background)
    }
}
