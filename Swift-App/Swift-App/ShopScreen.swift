import SwiftUI

struct ShopScreen: View {
    @State private var category = "All"
    @State private var selectedDiscount = 10

    private var visibleProducts: [MerchPreview] {
        MerchPreview.examples.filter { category == "All" || $0.category == category }
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 24) {
                Text("Shop.")
                    .font(.system(size: 38, weight: .bold, design: .rounded))
                    .tracking(-1.6)
                    .padding(.top, 12)

                VStack(alignment: .leading, spacing: 15) {
                    Label("Points discounts", systemImage: "tag")
                        .font(.headline)

                    LazyVGrid(columns: Array(repeating: GridItem(.flexible()), count: 3), spacing: 10) {
                        ForEach([10, 20, 30, 40, 50, 60], id: \.self) { discount in
                            Button { selectedDiscount = discount } label: {
                                VStack(alignment: .leading, spacing: 6) {
                                    Text("\(discount)% off")
                                        .font(.subheadline.bold())
                                    Text("Points TBD")
                                        .font(.caption2)
                                        .foregroundStyle(FanStyle.muted)
                                }
                                .frame(maxWidth: .infinity, alignment: .leading)
                                .padding(11)
                                .background(selectedDiscount == discount ? FanStyle.darkTeal : Color(white: 0.16),
                                            in: RoundedRectangle(cornerRadius: 17))
                                .overlay(RoundedRectangle(cornerRadius: 17)
                                    .strokeBorder(selectedDiscount == discount ? FanStyle.teal : .white.opacity(0.08)))
                            }
                            .buttonStyle(.plain)
                        }
                    }

                    Button("Redeem \(selectedDiscount)% off", systemImage: "ticket") {}
                        .font(.subheadline.bold())
                        .frame(maxWidth: .infinity)
                        .padding(13)
                        .background(FanStyle.darkTeal, in: RoundedRectangle(cornerRadius: 13))
                        .disabled(true)

                    Text("Preview only · Connect points and real offers to enable redemption.")
                        .font(.caption)
                        .foregroundStyle(FanStyle.muted)
                }
                .padding(17)
                .background(FanStyle.panel, in: RoundedRectangle(cornerRadius: 22))

                Text("Teamwear")
                    .font(.title3.bold())

                ScrollView(.horizontal) {
                    HStack(spacing: 9) {
                        ForEach(["All", "Caps", "Tops", "Layers"], id: \.self) { option in
                            Button { withAnimation(.easeInOut(duration: 0.2)) { category = option } } label: {
                                Text(option)
                                    .font(.subheadline.bold())
                                    .foregroundStyle(category == option ? .white : FanStyle.muted)
                                    .padding(.horizontal, 18)
                                    .padding(.vertical, 11)
                                    .background(category == option ? FanStyle.darkTeal : FanStyle.panel, in: Capsule())
                                    .overlay(Capsule().strokeBorder(category == option ? FanStyle.teal : .clear))
                            }
                            .buttonStyle(.plain)
                        }
                    }
                }
                .scrollIndicators(.hidden)

                LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: 12) {
                    ForEach(visibleProducts) { product in
                        NavigationLink {
                            ShopProductScreen(product: product)
                        } label: {
                            MerchPreviewCard(product: product)
                                .frame(maxWidth: .infinity)
                        }
                        .buttonStyle(.plain)
                    }
                }

                Text("Products shown for reference. Prices, availability and discounts are set by the store.")
                    .font(.caption)
                    .foregroundStyle(FanStyle.muted)
            }
            .padding(22)
            .frame(maxWidth: 520)
            .frame(maxWidth: .infinity)
        }
        .scrollIndicators(.hidden)
        .background(FanStyle.background)
        .navigationBarTitleDisplayMode(.inline)
        .toolbar(.visible, for: .navigationBar)
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
