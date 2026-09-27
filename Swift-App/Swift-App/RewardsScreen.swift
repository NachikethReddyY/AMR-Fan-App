import SwiftUI

struct MerchPreview: Identifiable {
    let id: String
    let imageName: String
    let category: String
    let storeURLString: String

    static let examples = [
        MerchPreview(id: "Team cap", imageName: "TeamCap", category: "Caps",
                     storeURLString: "https://shop.astonmartinf1.com/"),
        MerchPreview(id: "Replica team tee", imageName: "TeamTee", category: "Tops",
                     storeURLString: "https://us.puma.com/us/en/pd/puma-x-aston-martin-aramco-f1-team-mens-replica-tee/713889"),
        MerchPreview(id: "Replica team polo", imageName: "TeamPolo", category: "Tops",
                     storeURLString: "https://us.puma.com/us/en/pd/puma-x-aston-martin-aramco-f1-team-mens-replica-polo/713888"),
        MerchPreview(id: "Team jacket", imageName: "TeamJacket", category: "Layers",
                     storeURLString: "https://shop.astonmartinf1.com/")
    ]
}

struct RewardsScreen: View {
    let open: (FanDestination) -> Void
    @State private var selectedSection = "Redemption"

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 22) {
                SectionHeader(title: "Rewards.", description: "Your points. Your choices.")
                    .padding(.top, 30)

                HStack(alignment: .firstTextBaseline, spacing: 10) {
                    Text("0")
                        .font(.system(size: 56, weight: .bold, design: .rounded))
                    Text("points available")
                        .font(.subheadline)
                        .foregroundStyle(FanStyle.muted)
                    Spacer()
                    Image(systemName: "bolt.fill")
                        .foregroundStyle(FanStyle.teal)
                }
                .padding(21)
                .background(FanStyle.panel, in: RoundedRectangle(cornerRadius: 23))

                HStack(spacing: 9) {
                    ForEach(["Redemption", "History"], id: \.self) { section in
                        Button {
                            withAnimation(.easeInOut(duration: 0.2)) { selectedSection = section }
                        } label: {
                            Text(section)
                                .font(.subheadline.bold())
                                .foregroundStyle(selectedSection == section ? .white : FanStyle.muted)
                                .frame(maxWidth: .infinity)
                                .padding(12)
                                .background(selectedSection == section ? FanStyle.darkTeal : FanStyle.panel, in: Capsule())
                                .overlay(Capsule().strokeBorder(selectedSection == section ? FanStyle.teal : .clear))
                        }
                        .buttonStyle(.plain)
                    }
                }

                if selectedSection == "History" {
                    FeatureCard {
                        Label("No activity yet", systemImage: "clock.arrow.circlepath")
                            .font(.headline)
                        Text("Your earned and spent points will appear here once your account is connected.")
                            .font(.subheadline)
                            .foregroundStyle(FanStyle.muted)
                            .padding(.top, 7)
                    }
                } else {
                    redemptionCategories
                }

                Text("Preview only · Points and discounts aren't connected yet.")
                    .font(.caption)
                    .foregroundStyle(FanStyle.muted)
                    .padding(.bottom, 110)
            }
            .padding(.horizontal, 22)
            .frame(maxWidth: 520)
            .frame(maxWidth: .infinity)
        }
        .scrollIndicators(.hidden)
    }

    private var redemptionCategories: some View {
        VStack(alignment: .leading, spacing: 20) {
            Button { open(.challenges) } label: {
                    ZStack(alignment: .trailing) {
                        CheckeredBackdrop()
                            .opacity(0.22)
                        RoundedRectangle(cornerRadius: 23)
                            .fill(.ultraThinMaterial)
                            .opacity(0.38)

                        Image("AM26CarFront")
                            .resizable()
                            .scaledToFit()
                            .frame(width: 165, height: 165)
                            .rotationEffect(.degrees(-90))
                            .frame(width: 165, height: 145)
                            .allowsHitTesting(false)
                            .accessibilityHidden(true)

                        VStack(alignment: .leading, spacing: 12) {
                            Text("Fan challenges")
                                .font(.system(size: 25, weight: .bold, design: .rounded))
                            Text("Your idea. The team's stage.")
                                .font(.caption)
                                .foregroundStyle(FanStyle.muted)
                        }
                        .padding(22)
                        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .bottomLeading)
                    }
                    .frame(height: 145)
                    .background(FanStyle.panel)
                    .clipShape(RoundedRectangle(cornerRadius: 23))
                    .overlay(RoundedRectangle(cornerRadius: 23).strokeBorder(.white.opacity(0.16)))
            }
            .buttonStyle(.plain)
            .accessibilityLabel("Explore fan challenges")

                HStack {
                    Text("Shop")
                        .font(.title3.bold())
                    Spacer()
                    Button("Explore shop", systemImage: "chevron.right") { open(.offers) }
                        .font(.caption.bold())
                        .tint(FanStyle.teal)
                }

                ScrollView(.horizontal) {
                    HStack(spacing: 12) {
                        ForEach(MerchPreview.examples) { product in
                            Button { open(.offers) } label: {
                                MerchPreviewCard(product: product)
                            }
                            .buttonStyle(.plain)
                        }
                    }
                }
                .scrollIndicators(.hidden)

                HStack(spacing: 12) {
                    Button { open(.tree) } label: {
                        categoryCard("Trees", detail: "0 planted", symbol: "tree.fill")
                    }
                    Button { open(.content) } label: {
                        categoryCard("Stories", detail: "Team access", symbol: "play.rectangle.fill")
                    }
                }
                .buttonStyle(.plain)

        }
    }

    private func categoryCard(_ name: String, detail: String, symbol: String) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            Image(systemName: symbol)
                .font(.title2)
                .foregroundStyle(.white)
            Spacer(minLength: 5)
            Text(name).font(.headline)
            Text(detail).font(.caption).foregroundStyle(FanStyle.muted)
        }
        .frame(maxWidth: .infinity, minHeight: 104, alignment: .leading)
        .padding(16)
        .background(FanStyle.panel, in: RoundedRectangle(cornerRadius: 20))
    }
}

struct MerchPreviewCard: View {
    let product: MerchPreview

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            Image(product.imageName)
                .resizable()
                .scaledToFit()
                .frame(maxWidth: .infinity)
                .frame(height: 118)
                .background(Color(white: 0.23), in: RoundedRectangle(cornerRadius: 15))
            Text(product.id)
                .font(.subheadline.bold())
            Text(product.category)
                .font(.caption2)
                .foregroundStyle(FanStyle.muted)
        }
        .frame(width: 141)
        .padding(10)
        .background(FanStyle.panel, in: RoundedRectangle(cornerRadius: 19))
    }
}

struct CheckeredBackdrop: View {
    var body: some View {
        Canvas { context, size in
            let squareSize: CGFloat = 17
            let columns = Int(ceil(size.width / squareSize))
            let rows = Int(ceil(size.height / squareSize))

            for row in 0..<rows {
                for column in 0..<columns where (row + column).isMultiple(of: 2) {
                    let rect = CGRect(x: CGFloat(column) * squareSize,
                                      y: CGFloat(row) * squareSize,
                                      width: squareSize,
                                      height: squareSize)
                    context.fill(Path(rect), with: .color(.white))
                }
            }
        }
        .accessibilityHidden(true)
    }
}
