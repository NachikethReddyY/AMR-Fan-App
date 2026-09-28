import SwiftUI

struct RewardsScreen: View {
    let driver: Driver
    @Binding var demoState: DemoFanState
    let open: (FanDestination) -> Void
    @State private var selectedSection = "Rewards"
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 22) {
                SectionHeader(title: "Rewards.", description: "Your points. Your choices.")
                    .padding(.top, 30)

                racePointsHeader

                HStack(spacing: 9) {
                    ForEach(["Rewards", "Coupons"], id: \.self) { section in
                        Button {
                            withAnimation(reduceMotion ? nil : FanMotion.quick) { selectedSection = section }
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

                Group {
                    if selectedSection == "Coupons" {
                        couponsSection
                    } else {
                        redemptionCategories
                    }
                }
                .id(selectedSection)
                .transition(reduceMotion ? .opacity : .opacity.combined(with: .scale(scale: 0.98)))

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
                    Text("Merchandise")
                        .font(.title3.bold())
                    Spacer()
                    Button("Open store", systemImage: "chevron.right") { open(.offers) }
                        .font(.caption.bold())
                        .tint(FanStyle.teal)
                }

                LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: 12) {
                        Button { open(.caps) } label: {
                            DriverShopPreviewCard(
                                imageName: driver.capPortraitImageName,
                                title: "Caps",
                                driver: driver
                            )
                        }
                        .buttonStyle(FanPressStyle())

                        Button { open(.tshirts) } label: {
                            DriverShopPreviewCard(
                                imageName: driver.teamwearPortraitImageName,
                                title: "T-shirts",
                                driver: driver
                            )
                        }
                        .buttonStyle(.plain)

                        Button { open(.outerwear) } label: {
                            DriverShopPreviewCard(
                                imageName: driver.outerwearPortraitImageName,
                                title: "Outerwear",
                                driver: driver
                            )
                        }
                        .buttonStyle(.plain)

                        Button { open(.other) } label: {
                            DriverShopPreviewCard(
                                imageName: "AMR26CarFront",
                                title: "Other",
                                driver: driver
                            )
                        }
                        .buttonStyle(.plain)
                    }
                .frame(maxWidth: .infinity)

                HStack(spacing: 12) {
                    Button { open(.tree) } label: {
                        categoryCard("Trees", detail: "\(demoState.plantedTrees.count) pending", symbol: "tree.fill")
                    }
                    Button { open(.content) } label: {
                        categoryCard("Stories", detail: "Team access", symbol: "play.rectangle.fill")
                    }
                }
                .buttonStyle(FanPressStyle())

        }
    }

    private var couponsSection: some View {
        VStack(alignment: .leading, spacing: 12) {
            Label("Your coupon codes", systemImage: "ticket.fill")
                .font(.headline)
            if demoState.coupons.isEmpty {
                Text("Claim a merchandise offer to see its code here.")
                    .font(.subheadline)
                    .foregroundStyle(FanStyle.muted)
            } else {
                ForEach(demoState.coupons) { coupon in
                    VStack(alignment: .leading, spacing: 8) {
                        HStack {
                            Text(coupon.code)
                                .font(.headline.monospaced())
                            Spacer()
                            Text(coupon.status)
                                .font(.caption.bold())
                                .foregroundStyle(FanStyle.teal)
                        }
                        Text("\(coupon.discountPercent)% off · \(coupon.productName)")
                            .font(.subheadline.bold())
                        Text("\(coupon.pointsSpent) points · expires in \(coupon.expiry) · \(coupon.createdAt)")
                            .font(.caption)
                            .foregroundStyle(FanStyle.muted)
                    }
                    .padding(14)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .background(FanStyle.panel, in: RoundedRectangle(cornerRadius: 16))
                }
            }
        }
    }

    private var racePointsHeader: some View {
        HStack(spacing: 12) {
            VStack(alignment: .leading, spacing: 4) {
                Text("Race points")
                    .font(.subheadline)
                    .foregroundStyle(FanStyle.muted)
                Text(demoState.racePoints.formatted())
                    .font(.system(size: 34, weight: .bold, design: .rounded))
            }
            Spacer()
            Image(systemName: "bolt.fill")
                .font(.title2)
                .foregroundStyle(FanStyle.teal)
        }
        .padding(18)
        .background(FanStyle.panel, in: RoundedRectangle(cornerRadius: 20))
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

private struct DriverShopPreviewCard: View {
    let imageName: String
    let title: String
    let driver: Driver

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            Image(imageName)
                .resizable()
                .scaledToFill()
                .frame(width: 141, height: 118)
                .clipped()
                .accessibilityLabel("\(driver.firstName) \(driver.rawValue) wearing \(title.lowercased())")
            Text(title)
                .font(.subheadline.bold())
            Text("Official team collection")
                .font(.caption2)
                .foregroundStyle(FanStyle.muted)
        }
        .frame(maxWidth: .infinity)
        .padding(10)
        .background(FanStyle.panel, in: RoundedRectangle(cornerRadius: 19))
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
        .frame(maxWidth: .infinity)
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
