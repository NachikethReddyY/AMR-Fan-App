import SwiftUI

struct ShopScreen: View {
    let driver: Driver?
    @Binding var demoState: DemoFanState
    let category: MerchCategory

    private var visibleProducts: [MerchPreview] {
        MerchPreview.examples.filter { product in
            let matchesCategory = category.catalogCategory == nil || product.category == category.catalogCategory
            let matchesDriver = driver == nil || product.driver == nil || product.driver == "Team" || product.driver == "\(driver!.firstName) \(driver!.rawValue)"
            return matchesCategory && matchesDriver
        }
    }

    private var viewportWidth: CGFloat {
        UIApplication.shared.connectedScenes
            .compactMap { ($0 as? UIWindowScene)?.screen.bounds.width }
            .first ?? 402
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 22) {
                    if category == .all {
                        VStack(alignment: .leading, spacing: 8) {
                            Text("Merchandise")
                                .font(.system(size: 38, weight: .bold, design: .rounded))
                            Text("The full team catalog.")
                                .font(.subheadline)
                                .foregroundStyle(FanStyle.muted)
                        }
                        .padding(.top, 12)

                        categoryLinks
                    } else {
                        categoryHero(width: viewportWidth)
                    }

                    HStack {
                        if category == .all {
                            Text("All products")
                                .font(.title3.bold())
                        } else {
                            Text("Available now")
                                .font(.title3.bold())
                        }
                        Spacer()
                        Label("\(demoState.racePoints.formatted()) race points", systemImage: "bolt.fill")
                            .font(.subheadline.bold())
                            .foregroundStyle(FanStyle.teal)
                    }

                    LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: 12) {
                        ForEach(visibleProducts) { product in
                            CatalogProductCard(product: product, isRedeemed: demoState.redeemedMerchIDs.contains(product.id)) {
                                _ = demoState.redeemMerch(product)
                            }
                        }
                    }

                    Text("Products and availability come from the connected store. Point costs are admin-configured.")
                        .font(.caption)
                        .foregroundStyle(FanStyle.muted)
                        .padding(.bottom, 24)
                }
                .padding(.horizontal, 22)
                .frame(width: viewportWidth)
            }
            .frame(width: viewportWidth)
        .frame(width: viewportWidth)
        .scrollIndicators(.hidden)
        .ignoresSafeArea(.container, edges: category == .all ? [] : .top)
        .background(FanStyle.background)
        .navigationTitle(category == .all ? "Store" : "")
        .navigationBarTitleDisplayMode(.inline)
        .toolbarBackground(category == .all ? .visible : .hidden, for: .navigationBar)
        .toolbar(.visible, for: .navigationBar)
    }

    private func categoryHero(width: CGFloat) -> some View {
        VStack(alignment: .leading, spacing: 0) {
            Image(heroImageName)
                .resizable()
                .scaledToFill()
                .frame(width: width, height: 330)
                .clipped()

            VStack(alignment: .leading, spacing: 6) {
                Text(category.rawValue)
                    .font(.system(size: 34, weight: .bold, design: .rounded))
                Text("Official team collection")
                    .font(.subheadline)
                    .foregroundStyle(FanStyle.muted)
            }
            .padding(.horizontal, 22)
            .padding(.top, 22)
            .frame(width: width, alignment: .leading)
        }
        .frame(width: width)
    }

    private var categoryLinks: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 9) {
                ForEach(MerchCategory.allCases.filter { $0 != .all }, id: \.self) { destinationCategory in
                    NavigationLink {
                        ShopScreen(driver: driver, demoState: $demoState, category: destinationCategory)
                    } label: {
                        Text(destinationCategory.rawValue)
                            .font(.subheadline.bold())
                            .foregroundStyle(FanStyle.muted)
                            .padding(.horizontal, 16)
                            .padding(.vertical, 11)
                            .background(FanStyle.panel, in: Capsule())
                    }
                    .buttonStyle(.plain)
                }
            }
        }
    }

    private var heroImageName: String {
        guard let driver, let keyPath = category.heroImageKey else { return "AMR26Car" }
        return driver[keyPath: keyPath]
    }
}

private struct CatalogProductCard: View {
    let product: MerchPreview
    let isRedeemed: Bool
    let redeem: () -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            Image(product.imageName)
                .resizable()
                .scaledToFit()
                .frame(width: 140, height: 118)
                .frame(maxWidth: .infinity)
                .background(Color(white: 0.23), in: RoundedRectangle(cornerRadius: 15))

            Text(product.name)
                .font(.subheadline.bold())
            HStack {
                Text(product.isAvailable ? "In stock" : "Currently unavailable")
                Spacer()
                Text("\(product.discountPercent)% off")
            }
                .font(.caption.bold())
                .foregroundStyle(FanStyle.teal)
            Button(isRedeemed ? "Coupon added" : "\(product.pointsCost) points", action: redeem)
                .font(.caption.bold())
                .frame(maxWidth: .infinity)
                .padding(.vertical, 9)
                .background(isRedeemed ? FanStyle.panel : FanStyle.teal, in: RoundedRectangle(cornerRadius: 11))
                .foregroundStyle(isRedeemed ? FanStyle.muted : .black)
                .disabled(isRedeemed || !product.isAvailable)
        }
        .frame(maxWidth: .infinity)
        .padding(10)
        .background(FanStyle.panel, in: RoundedRectangle(cornerRadius: 19))
    }
}

private struct DriverMerchLookCard: View {
    let imageName: String
    let title: String
    let driver: Driver

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            Image(imageName)
                .resizable()
                .scaledToFill()
                .frame(width: 250, height: 205)
                .clipped()
                .accessibilityLabel("\(driver.firstName) \(driver.rawValue) wearing \(title.lowercased())")

            VStack(alignment: .leading, spacing: 4) {
                Text(title)
                    .font(.headline)
                Text("Official team collection")
                    .font(.caption)
                    .foregroundStyle(FanStyle.muted)
            }
            .padding(13)
        }
        .background(FanStyle.panel, in: RoundedRectangle(cornerRadius: 20))
        .clipShape(RoundedRectangle(cornerRadius: 20))
    }
}

struct ShopProductScreen: View {
    let product: MerchPreview
    @Environment(\.openURL) private var openURL
    @State private var showBrowserNotice = false

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 20) {
                Image(product.imageName)
                    .resizable()
                    .scaledToFit()
                    .frame(maxWidth: .infinity)
                    .frame(height: 310)
                    .background(Color(white: 0.23), in: RoundedRectangle(cornerRadius: 24))
                    .accessibilityLabel(product.id)

                Text(product.id)
                    .font(.system(size: 29, weight: .bold, design: .rounded))
                Text("Redeem a discount in the app when offers are available. Complete purchases in the store.")
                    .font(.subheadline)
                    .foregroundStyle(FanStyle.muted)

                Button("Visit store", systemImage: "arrow.up.right") {
                    showBrowserNotice = true
                }
                .font(.headline)
                .frame(maxWidth: .infinity)
                .padding(16)
                .background(FanStyle.darkTeal, in: RoundedRectangle(cornerRadius: 15))
                .overlay(RoundedRectangle(cornerRadius: 15).strokeBorder(FanStyle.teal.opacity(0.5)))

                Text("No discount is applied yet. You’ll leave the app to browse and check out.")
                    .font(.caption)
                    .foregroundStyle(FanStyle.muted)
            }
            .padding(22)
            .frame(maxWidth: 520)
            .frame(maxWidth: .infinity)
        }
        .background(FanStyle.background)
        .navigationBarTitleDisplayMode(.inline)
        .toolbar(.visible, for: .navigationBar)
        .confirmationDialog("Open external store?", isPresented: $showBrowserNotice) {
            Button("Continue to browser") {
                if let url = URL(string: product.storeURLString) {
                    openURL(url)
                }
            }
        } message: {
            Text("You’ll leave the app. Discounts and checkout are not connected yet.")
        }
    }
}
