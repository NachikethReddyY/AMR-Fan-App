import SwiftUI
import Combine

enum FanStyle {
    static let background = Color(red: 10 / 255, green: 10 / 255, blue: 10 / 255)
    static let panel = Color(red: 30 / 255, green: 32 / 255, blue: 32 / 255)
    static let astonGreen = Color(red: 4 / 255, green: 82 / 255, blue: 75 / 255)
    static let teal = Color(red: 69 / 255, green: 152 / 255, blue: 143 / 255)
    static let navigationTeal = Color(red: 35 / 255, green: 117 / 255, blue: 108 / 255)
    static let introGreen = Color(red: 48 / 255, green: 151 / 255, blue: 78 / 255)
    static let darkTeal = Color(red: 34 / 255, green: 39 / 255, blue: 39 / 255)
    static let muted = Color(red: 0.63, green: 0.69, blue: 0.67)
    static let streakGradient = LinearGradient(
        colors: [.orange, .red.opacity(0.1)],
        startPoint: .topLeading,
        endPoint: .bottomTrailing
    )
}

enum DemoMode {
    static let optionalGreenPoints = 9_000
}

enum Driver: String, CaseIterable, Identifiable {
    case alonso = "Alonso"
    case stroll = "Stroll"

    var id: String { rawValue }
    var number: String { self == .alonso ? "14" : "18" }
    var imageName: String { self == .alonso ? "AlonsoCard" : "StrollCard" }
    var cutoutImageName: String { self == .alonso ? "AlonsoCutout" : "StrollCutout" }
    var capPortraitImageName: String { self == .alonso ? "AlonsoCapPortrait" : "StrollCapPortrait" }
    var teamwearPortraitImageName: String { self == .alonso ? "AlonsoTeamwearPortrait" : "StrollTeamwearPortrait" }
    var outerwearPortraitImageName: String { self == .alonso ? "AlonsoOuterwearPortrait" : "StrollOuterwearPortrait" }
    var firstName: String { self == .alonso ? "Fernando" : "Lance" }
    var capHeroImageName: String { self == .alonso ? "AlonsoCapHero" : "StrollCapHero" }
    var topsHeroImageName: String { self == .alonso ? "AlonsoTShirtHero" : "StrollTShirtHero" }
    var outerwearHeroImageName: String { self == .alonso ? "AlonsoOuterwearHero" : "StrollOuterwearHero" }
}

struct MerchCatalogEntry: Decodable {
    let category: String
    let driver: String?
    let id: String
    let imageAssetName: String
    let name: String
    let url: String
    let appRewardPointsCost: Int?
    let appRewardDiscountPercent: Int?
    let year: String?

    init(
        category: String,
        driver: String? = nil,
        id: String,
        imageAssetName: String,
        name: String,
        url: String,
        appRewardPointsCost: Int? = nil,
        appRewardDiscountPercent: Int? = nil,
        year: String? = nil
    ) {
        self.category = category
        self.driver = driver
        self.id = id
        self.imageAssetName = imageAssetName
        self.name = name
        self.url = url
        self.appRewardPointsCost = appRewardPointsCost
        self.appRewardDiscountPercent = appRewardDiscountPercent
        self.year = year
    }
}

struct MerchCatalogDocument: Decodable {
    let products: [MerchCatalogEntry]
}

struct MerchPreview: Identifiable {
    let id: String
    let imageName: String
    let name: String
    let category: String
    let driver: String?
    let discountPercent: Int
    let pointsCost: Int
    let storeURLString: String
    let isAvailable: Bool
    let year: String

    init(entry: MerchCatalogEntry) {
        id = entry.id
        imageName = entry.imageAssetName
        name = entry.name
        category = Self.appCategory(for: entry.category)
        driver = entry.driver
        discountPercent = entry.appRewardDiscountPercent ?? Self.defaultDiscount(for: entry)
        pointsCost = entry.appRewardPointsCost ?? Self.defaultPoints(for: entry.category)
        storeURLString = entry.url
        isAvailable = true
        year = entry.year ?? "2026"
    }

    @MainActor static var examples: [MerchPreview] {
        guard let url = Bundle.main.url(forResource: "MerchStoreCatalog", withExtension: "json"),
              let data = try? Data(contentsOf: url),
              let document = try? JSONDecoder().decode(MerchCatalogDocument.self, from: data) else {
            return fallbackEntries.map(MerchPreview.init(entry:))
        }
        return document.products.map(MerchPreview.init(entry:))
    }

    private static let fallbackEntries: [MerchCatalogEntry] = [
        MerchCatalogEntry(category: "Sweatshirt", id: "701238091-TrueBlack", imageAssetName: "Merch_701238091_TrueBlack", name: "Stealth Sweater", url: "https://shop.astonmartinf1.com/en/aston-martin-f1-team-stealth-sweater/701238091-TrueBlack.html", appRewardPointsCost: nil),
        MerchCatalogEntry(category: "Polo", id: "701238092-AMGreen", imageAssetName: "Merch_701238092_AMGreen", name: "Seasonal Polo", url: "https://shop.astonmartinf1.com/en/aston-martin-f1-team-seasonal-polo/701238092-AMGreen.html", appRewardPointsCost: nil),
        MerchCatalogEntry(category: "Polo", id: "701238092-TrueBlack", imageAssetName: "Merch_701238092_TrueBlack", name: "Seasonal Polo", url: "https://shop.astonmartinf1.com/en/aston-martin-f1-team-seasonal-polo/701238092-TrueBlack.html", appRewardPointsCost: nil),
        MerchCatalogEntry(category: "Key ring", id: "701238098-multicolor", imageAssetName: "Merch_701238098_multicolor", name: "Keyring", url: "https://shop.astonmartinf1.com/en/aston-martin-f1-team-keyring/701238098-multicolor.html", appRewardPointsCost: nil),
        MerchCatalogEntry(category: "Flag/Banner", id: "701238100-Multicolor", imageAssetName: "Merch_701238100_Multicolor", name: "Team Flag", url: "https://shop.astonmartinf1.com/en/aston-martin-f1-team-team-flag/701238100-Multicolor.html", appRewardPointsCost: nil),
        MerchCatalogEntry(category: "Lanyard", id: "701238101-multicolor", imageAssetName: "Merch_701238101_multicolor", name: "Lanyard", url: "https://shop.astonmartinf1.com/en/aston-martin-f1-team-lanyard/701238101-multicolor.html", appRewardPointsCost: nil),
        MerchCatalogEntry(category: "Bag", id: "701238102-Black", imageAssetName: "Merch_701238102_Black", name: "Packable Tote Bag", url: "https://shop.astonmartinf1.com/en/aston-martin-f1-team-packable-tote-bag/701238102-Black.html", appRewardPointsCost: nil),
        MerchCatalogEntry(category: "T-shirt", id: "701238346-PUMABlack", imageAssetName: "Merch_701238346_PUMABlack", name: "PUMA Graphic T-shirt", url: "https://shop.astonmartinf1.com/en/aston-martin-f1-team-puma-graphic-t-shirt/701238346-PUMABlack.html", appRewardPointsCost: nil),
        MerchCatalogEntry(category: "Headwear", id: "701238353-GreenLux", imageAssetName: "Merch_701238353_GreenLux", name: "PUMA Cap", url: "https://shop.astonmartinf1.com/en/aston-martin-f1-team-puma-cap/701238353-GreenLux.html", appRewardPointsCost: nil),
        MerchCatalogEntry(category: "Headwear", id: "701238353-PumaBlack", imageAssetName: "Merch_701238353_PumaBlack", name: "PUMA Cap", url: "https://shop.astonmartinf1.com/en/aston-martin-f1-team-puma-cap/701238353-PumaBlack.html", appRewardPointsCost: nil),
        MerchCatalogEntry(category: "Outerwear", id: "701238354-PumaBlack", imageAssetName: "Merch_701238354_PumaBlack", name: "PUMA Bomber Jacket", url: "https://shop.astonmartinf1.com/en/aston-martin-f1-team-puma-bomber-jacket/701238354-PumaBlack.html", appRewardPointsCost: nil),
        MerchCatalogEntry(category: "T-shirt", id: "701238357-PumaBlack", imageAssetName: "Merch_701238357_PumaBlack", name: "PUMA Jersey", url: "https://shop.astonmartinf1.com/en/aston-martin-f1-team-puma-jersey/701238357-PumaBlack.html", appRewardPointsCost: nil),
        MerchCatalogEntry(category: "T-shirt", id: "701238358-GreenLux", imageAssetName: "Merch_701238358_GreenLux", name: "PUMA T7 T-shirt", url: "https://shop.astonmartinf1.com/en/aston-martin-f1-team-puma-t7-t-shirt/701238358-GreenLux.html", appRewardPointsCost: nil),
        MerchCatalogEntry(category: "Midlayer", id: "701238359-GreenLux", imageAssetName: "Merch_701238359_GreenLux", name: "PUMA T7 Jacket", url: "https://shop.astonmartinf1.com/en/aston-martin-f1-team-puma-t7-jacket/701238359-GreenLux.html", appRewardPointsCost: nil),
        MerchCatalogEntry(category: "Trousers", id: "701239138-GREENLUX", imageAssetName: "Merch_701239138_GREENLUX", name: "PUMA T7 Oversized Pants", url: "https://shop.astonmartinf1.com/en/aston-martin-f1-team-puma-t7-oversized-pants/701239138-GREENLUX.html", appRewardPointsCost: nil),
        MerchCatalogEntry(category: "Footwear", id: "701239149-PUMABlack-GreenLux", imageAssetName: "Merch_701239149_PUMABlack_GreenLux", name: "PUMA RS Surge Sneakers", url: "https://shop.astonmartinf1.com/en/aston-martin-f1-team-puma-rs-surge-sneakers/701239149-PUMABlack-GreenLux.html", appRewardPointsCost: nil),
        MerchCatalogEntry(category: "Headwear", id: "701239667-green", imageAssetName: "Merch_701239667_green", name: "Kids 2026 Fernando Alonso Replica Cap", url: "https://shop.astonmartinf1.com/en/aston-martin-f1-team-kids-2026-fernando-alonso-replica-cap/701239667-green.html", appRewardPointsCost: nil),
        MerchCatalogEntry(category: "Headwear", id: "701239668-green", imageAssetName: "Merch_701239668_green", name: "2026 Fernando Alonso Replica Cap", url: "https://shop.astonmartinf1.com/en/aston-martin-f1-team-2026-fernando-alonso-replica-cap/701239668-green.html", appRewardPointsCost: nil),
        MerchCatalogEntry(category: "Headwear", id: "701239668-lime", imageAssetName: "Merch_701239668_lime", name: "2026 Fernando Alonso Replica Cap", url: "https://shop.astonmartinf1.com/en/aston-martin-f1-team-2026-fernando-alonso-replica-cap/701239668-lime.html", appRewardPointsCost: nil),
        MerchCatalogEntry(category: "Headwear", id: "701239669-Red", imageAssetName: "Merch_701239669_Red", name: "2026 Fernando Alonso Spain Cap", url: "https://shop.astonmartinf1.com/en/aston-martin-f1-team-2026-fernando-alonso-spain-cap/701239669-Red.html", appRewardPointsCost: nil),
        MerchCatalogEntry(category: "Headwear", id: "701239670-green", imageAssetName: "Merch_701239670_green", name: "2026 Team Silverstone GP Replica Cap", url: "https://shop.astonmartinf1.com/en/aston-martin-f1-team-2026-team-silverstone-gp-replica-cap/701239670-green.html", appRewardPointsCost: nil),
        MerchCatalogEntry(category: "Headwear", id: "701239672-GREENLUX", imageAssetName: "Merch_701239672_GREENLUX", name: "2026 Lance Stroll Replica Trucker Cap", url: "https://shop.astonmartinf1.com/en/aston-martin-f1-team-2026-lance-stroll-replica-trucker-cap/701239672-GREENLUX.html", appRewardPointsCost: nil),
        MerchCatalogEntry(category: "Headwear", id: "701239672-black", imageAssetName: "Merch_701239672_black", name: "2026 Lance Stroll Replica Trucker Cap", url: "https://shop.astonmartinf1.com/en/aston-martin-f1-team-2026-lance-stroll-replica-trucker-cap/701239672-black.html", appRewardPointsCost: nil),
        MerchCatalogEntry(category: "Headwear", id: "701239673-White", imageAssetName: "Merch_701239673_White", name: "2026 Lance Stroll Trucker Cap", url: "https://shop.astonmartinf1.com/en/aston-martin-f1-team-2026-lance-stroll-trucker-cap/701239673-White.html", appRewardPointsCost: nil),
        MerchCatalogEntry(category: "Headwear", id: "701239674-green", imageAssetName: "Merch_701239674_green", name: "2026 Replica Kids Team Cap", url: "https://shop.astonmartinf1.com/en/aston-martin-f1-team-2026-replica-kids-team-cap/701239674-green.html", appRewardPointsCost: nil),
        MerchCatalogEntry(category: "Headwear", id: "701239675-black", imageAssetName: "Merch_701239675_black", name: "2026 Replica Team Cap", url: "https://shop.astonmartinf1.com/en/aston-martin-f1-team-2026-replica-team-cap/701239675-black.html", appRewardPointsCost: nil),
        MerchCatalogEntry(category: "Headwear", id: "701239675-green", imageAssetName: "Merch_701239675_green", name: "2026 Replica Team Cap", url: "https://shop.astonmartinf1.com/en/aston-martin-f1-team-2026-replica-team-cap/701239675-green.html", appRewardPointsCost: nil),
        MerchCatalogEntry(category: "Sweatshirt", id: "701239678-GreenLux", imageAssetName: "Merch_701239678_GreenLux", name: "2026 Replica Team Half Zip Sweater", url: "https://shop.astonmartinf1.com/en/aston-martin-f1-team-2026-replica-team-half-zip-sweater/701239678-GreenLux.html", appRewardPointsCost: nil),
        MerchCatalogEntry(category: "Sweatshirt", id: "701239679-green", imageAssetName: "Merch_701239679_green", name: "2026 Replica Team Hoodie", url: "https://shop.astonmartinf1.com/en/aston-martin-f1-team-2026-replica-team-hoodie/701239679-green.html", appRewardPointsCost: nil),
        MerchCatalogEntry(category: "Polo", id: "701239681-GreenLux", imageAssetName: "Merch_701239681_GreenLux", name: "Women's 2026 Replica Team Polo", url: "https://shop.astonmartinf1.com/en/aston-martin-f1-team-womens-2026-replica-team-polo/701239681-GreenLux.html", appRewardPointsCost: nil),
        MerchCatalogEntry(category: "Polo", id: "701239682-green", imageAssetName: "Merch_701239682_green", name: "2026 Replica Team Polo", url: "https://shop.astonmartinf1.com/en/aston-martin-f1-team-2026-replica-team-polo/701239682-green.html", appRewardPointsCost: nil),
        MerchCatalogEntry(category: "T-shirt", id: "701239685-GreenLux", imageAssetName: "Merch_701239685_GreenLux", name: "2026 Fernando Alonso Replica T-shirt", url: "https://shop.astonmartinf1.com/en/aston-martin-f1-team-2026-fernando-alonso-replica-t-shirt/701239685-GreenLux.html", appRewardPointsCost: nil),
        MerchCatalogEntry(category: "T-shirt", id: "701239688-green", imageAssetName: "Merch_701239688_green", name: "2026 Team Silverstone GP Replica T-shirt", url: "https://shop.astonmartinf1.com/en/aston-martin-f1-team-2026-team-silverstone-gp-replica-t-shirt/701239688-green.html", appRewardPointsCost: nil),
        MerchCatalogEntry(category: "T-shirt", id: "701239689-green", imageAssetName: "Merch_701239689_green", name: "2026 Lance Stroll Replica T-shirt", url: "https://shop.astonmartinf1.com/en/aston-martin-f1-team-2026-lance-stroll-replica-t-shirt/701239689-green.html", appRewardPointsCost: nil),
        MerchCatalogEntry(category: "T-shirt", id: "701239690-green", imageAssetName: "Merch_701239690_green", name: "Women's 2026 Replica Team T-shirt", url: "https://shop.astonmartinf1.com/en/aston-martin-f1-team-womens-2026-replica-team-t-shirt/701239690-green.html", appRewardPointsCost: nil),
        MerchCatalogEntry(category: "T-shirt", id: "701239691-GreenLux", imageAssetName: "Merch_701239691_GreenLux", name: "2026 Replica Team T-shirt", url: "https://shop.astonmartinf1.com/en/aston-martin-f1-team-2026-replica-team-t-shirt/701239691-GreenLux.html", appRewardPointsCost: nil),
        MerchCatalogEntry(category: "Outerwear", id: "701239692-green", imageAssetName: "Merch_701239692_green", name: "2026 Replica Team Bomber Jacket", url: "https://shop.astonmartinf1.com/en/aston-martin-f1-team-2026-replica-team-bomber-jacket/701239692-green.html", appRewardPointsCost: nil),
        MerchCatalogEntry(category: "Outerwear", id: "701239693-green", imageAssetName: "Merch_701239693_green", name: "2026 Replica Team Rain Jacket", url: "https://shop.astonmartinf1.com/en/aston-martin-f1-team-2026-replica-team-rain-jacket/701239693-green.html", appRewardPointsCost: nil),
        MerchCatalogEntry(category: "Outerwear", id: "701239694-GreenLux", imageAssetName: "Merch_701239694_GreenLux", name: "2026 Replica Team Softshell Jacket", url: "https://shop.astonmartinf1.com/en/aston-martin-f1-team-2026-replica-team-softshell-jacket/701239694-GreenLux.html", appRewardPointsCost: nil),
        MerchCatalogEntry(category: "Sweatshirt", id: "701239820-green", imageAssetName: "Merch_701239820_green", name: "Kids 2026 Replica Team Hoodie", url: "https://shop.astonmartinf1.com/en/aston-martin-f1-team-kids-2026-replica-team-hoodie/701239820-green.html", appRewardPointsCost: nil),
        MerchCatalogEntry(category: "Polo", id: "701239821-green", imageAssetName: "Merch_701239821_green", name: "Kids 2026 Replica Team Polo", url: "https://shop.astonmartinf1.com/en/aston-martin-f1-team-kids-2026-replica-team-polo/701239821-green.html", appRewardPointsCost: nil),
        MerchCatalogEntry(category: "T-shirt", id: "701239822-green", imageAssetName: "Merch_701239822_green", name: "Kids 2026 Replica Team T-shirt", url: "https://shop.astonmartinf1.com/en/aston-martin-f1-team-kids-2026-replica-team-t-shirt/701239822-green.html", appRewardPointsCost: nil),
        MerchCatalogEntry(category: "T-shirt", id: "701241713-TrueBlack", imageAssetName: "Merch_701241713_TrueBlack", name: "2026 Fernando Alonso Spain T-shirt", url: "https://shop.astonmartinf1.com/en/aston-martin-f1-team-2026-fernando-alonso-spain-t-shirt/701241713-TrueBlack.html", appRewardPointsCost: nil),
        MerchCatalogEntry(category: "Sweatshirt", id: "701241714-TrueBlack", imageAssetName: "Merch_701241714_TrueBlack", name: "2026 Fernando Alonso Spain Hoodie", url: "https://shop.astonmartinf1.com/en/aston-martin-f1-team-2026-fernando-alonso-spain-hoodie/701241714-TrueBlack.html", appRewardPointsCost: nil),
        MerchCatalogEntry(category: "Watch", id: "701242308-Black", imageAssetName: "Merch_701242308_Black", name: "DWF Nato Strap Watch", url: "https://shop.astonmartinf1.com/en/aston-martin-f1-team-dwf-nato-strap-watch/701242308-Black.html", appRewardPointsCost: nil),
        MerchCatalogEntry(category: "Watch", id: "701242308-PodiumGreen", imageAssetName: "Merch_701242308_PodiumGreen", name: "DWF Nato Strap Watch", url: "https://shop.astonmartinf1.com/en/aston-martin-f1-team-dwf-nato-strap-watch/701242308-PodiumGreen.html", appRewardPointsCost: nil),
        MerchCatalogEntry(category: "Watch", id: "701242309-Black", imageAssetName: "Merch_701242309_Black", name: "OVR Silicone Strap Watch", url: "https://shop.astonmartinf1.com/en/aston-martin-f1-team-ovr-silicone-strap-watch/701242309-Black.html", appRewardPointsCost: nil),
        MerchCatalogEntry(category: "Watch", id: "701242309-Green", imageAssetName: "Merch_701242309_Green", name: "OVR Silicone Strap Watch", url: "https://shop.astonmartinf1.com/en/aston-martin-f1-team-ovr-silicone-strap-watch/701242309-Green.html", appRewardPointsCost: nil),
        MerchCatalogEntry(category: "Watch", id: "701242312-Black", imageAssetName: "Merch_701242312_Black", name: "Silicone Strap Watch", url: "https://shop.astonmartinf1.com/en/aston-martin-f1-team-silicone-strap-watch/701242312-Black.html", appRewardPointsCost: nil),
        MerchCatalogEntry(category: "Watch", id: "701242312-PodiumGreen", imageAssetName: "Merch_701242312_PodiumGreen", name: "Silicone Strap Watch", url: "https://shop.astonmartinf1.com/en/aston-martin-f1-team-silicone-strap-watch/701242312-PodiumGreen.html", appRewardPointsCost: nil),
        MerchCatalogEntry(category: "Footwear", id: "701242392-PUMABlack-LimeShimmer", imageAssetName: "Merch_701242392_PUMABlack_LimeShimmer", name: "Caven III Sneakers", url: "https://shop.astonmartinf1.com/en/aston-martin-f1-team-caven-iii-sneakers/701242392-PUMABlack-LimeShimmer.html", appRewardPointsCost: nil),
        MerchCatalogEntry(category: "Footwear", id: "701242395-GreenLux-PUMASilver", imageAssetName: "Merch_701242395_GreenLux_PUMASilver", name: "Basket Sneakers", url: "https://shop.astonmartinf1.com/en/aston-martin-f1-team-basket-sneakers/701242395-GreenLux-PUMASilver.html", appRewardPointsCost: nil),
        MerchCatalogEntry(category: "T-shirt", id: "701242397-PUMABlack", imageAssetName: "Merch_701242397_PUMABlack", name: "PUMA Graphic T-shirt", url: "https://shop.astonmartinf1.com/en/aston-martin-f1-team-puma-graphic-t-shirt/701242397-PUMABlack.html", appRewardPointsCost: nil),
        MerchCatalogEntry(category: "Polo", id: "701242398-PUMABlack", imageAssetName: "Merch_701242398_PUMABlack", name: "PUMA CLOUDSPUN Polo", url: "https://shop.astonmartinf1.com/en/aston-martin-f1-team-puma-cloudspun-polo/701242398-PUMABlack.html", appRewardPointsCost: nil),
        MerchCatalogEntry(category: "T-shirt", id: "701242409-GreenLux", imageAssetName: "Merch_701242409_GreenLux", name: "Silverstone GP Oversized T-shirt", url: "https://shop.astonmartinf1.com/en/aston-martin-f1-team-silverstone-gp-oversized-t-shirt/701242409-GreenLux.html", appRewardPointsCost: nil),
        MerchCatalogEntry(category: "T-shirt", id: "701242411-PUMAWhite", imageAssetName: "Merch_701242411_PUMAWhite", name: "PUMA Madrid GP T-shirt", url: "https://shop.astonmartinf1.com/en/aston-martin-f1-team-puma-madrid-gp-t-shirt/701242411-PUMAWhite.html", appRewardPointsCost: nil),
        MerchCatalogEntry(category: "T-shirt", id: "701242412-PUMAWhite", imageAssetName: "Merch_701242412_PUMAWhite", name: "Silverstone GP Graphic T-shirt", url: "https://shop.astonmartinf1.com/en/aston-martin-f1-team-silverstone-gp-graphic-t-shirt/701242412-PUMAWhite.html", appRewardPointsCost: nil),
        MerchCatalogEntry(category: "T-shirt", id: "701242715-TrueBlack", imageAssetName: "Merch_701242715_TrueBlack", name: "2026 Lance Stroll T-shirt", url: "https://shop.astonmartinf1.com/en/aston-martin-f1-team-2026-lance-stroll-t-shirt/701242715-TrueBlack.html", appRewardPointsCost: nil),
        MerchCatalogEntry(category: "Footwear", id: "701242801-PUMABlack", imageAssetName: "Merch_701242801_PUMABlack", name: "FAST-R NITRO™ Elite 3 trainers", url: "https://shop.astonmartinf1.com/en/aston-martin-f1-team-fast-r-nitro-elite-3-trainers/701242801-PUMABlack.html", appRewardPointsCost: nil),
        MerchCatalogEntry(category: "Footwear", id: "701242802-PUMABlack", imageAssetName: "Merch_701242802_PUMABlack", name: "Women's FAST-R NITRO™ Elite 3 Trainers", url: "https://shop.astonmartinf1.com/en/aston-martin-f1-team-womens-fast-r-nitro-elite-3-trainers/701242802-PUMABlack.html", appRewardPointsCost: nil),
        MerchCatalogEntry(category: "Footwear", id: "701242803-PUMABlack", imageAssetName: "Merch_701242803_PUMABlack", name: "MagMax NITRO™ 2 Shoes", url: "https://shop.astonmartinf1.com/en/aston-martin-f1-team-magmax-nitro-2-shoes/701242803-PUMABlack.html", appRewardPointsCost: nil),
        MerchCatalogEntry(category: "Footwear", id: "701242804-PUMABlack", imageAssetName: "Merch_701242804_PUMABlack", name: "Women's MagMax NITRO 2™ Shoes", url: "https://shop.astonmartinf1.com/en/aston-martin-f1-team-womens-magmax-nitro-2-shoes/701242804-PUMABlack.html", appRewardPointsCost: nil),
        MerchCatalogEntry(category: "Watch", id: "701245891-Black", imageAssetName: "Merch_701245891_Black", name: "DWF Podium Silicone Strap Watch", url: "https://shop.astonmartinf1.com/en/aston-martin-f1-team-dwf-podium-silicone-strap-watch/701245891-Black.html", appRewardPointsCost: nil),
        MerchCatalogEntry(category: "Watch", id: "701245891-PodiumGreen", imageAssetName: "Merch_701245891_PodiumGreen", name: "DWF Podium Silicone Strap Watch", url: "https://shop.astonmartinf1.com/en/aston-martin-f1-team-dwf-podium-silicone-strap-watch/701245891-PodiumGreen.html", appRewardPointsCost: nil),
        MerchCatalogEntry(category: "Watch", id: "701245893-Black", imageAssetName: "Merch_701245893_Black", name: "FLK Black & Lime Essence Silicone Strap Watch", url: "https://shop.astonmartinf1.com/en/aston-martin-f1-team-flk-black-and-lime-essence-silicone-strap-watch/701245893-Black.html", appRewardPointsCost: nil),
        MerchCatalogEntry(category: "Watch", id: "701245893-PodiumGreen", imageAssetName: "Merch_701245893_PodiumGreen", name: "FLK Black & Lime Essence Silicone Strap Watch", url: "https://shop.astonmartinf1.com/en/aston-martin-f1-team-flk-black-and-lime-essence-silicone-strap-watch/701245893-PodiumGreen.html", appRewardPointsCost: nil),
        MerchCatalogEntry(category: "Watch", id: "701245899-PodiumGreen", imageAssetName: "Merch_701245899_PodiumGreen", name: "SHD Silicone Strap Watch", url: "https://shop.astonmartinf1.com/en/aston-martin-f1-team-shd-silicone-strap-watch/701245899-PodiumGreen.html", appRewardPointsCost: nil),
        MerchCatalogEntry(category: "Watch", id: "701245899-White", imageAssetName: "Merch_701245899_White", name: "SHD Silicone Strap Watch", url: "https://shop.astonmartinf1.com/en/aston-martin-f1-team-shd-silicone-strap-watch/701245899-White.html", appRewardPointsCost: nil),
        MerchCatalogEntry(category: "Drinkware", id: "701246413-Green", imageAssetName: "Merch_701246413_Green", name: "Team Official Water Bottle", url: "https://shop.astonmartinf1.com/en/aston-martin-f1-team-team-official-water-bottle/701246413-Green.html", appRewardPointsCost: nil),
        MerchCatalogEntry(category: "Toy", id: "701247205-Green", imageAssetName: "Merch_701247205_Green", name: "LEGO Technic Aston Martin Aramco AMR25 F1 Car", url: "https://shop.astonmartinf1.com/en/aston-martin-f1-team-lego-technic-aston-martin-aramco-amr25-f1-car/701247205-Green.html", appRewardPointsCost: nil),
    ]

    private static func appCategory(for sourceCategory: String) -> String {
        switch sourceCategory {
        case "Headwear": "Caps"
        case "Outerwear": "Outerwear"
        case "T-shirt", "Polo": "T-shirts"
        case "Sweatshirt", "Midlayer": "Outerwear"
        default: "Other"
        }
    }

    private static func defaultPoints(for sourceCategory: String) -> Int {
        switch sourceCategory {
        case "Headwear": 250
        case "Outerwear": 650
        case "T-shirt", "Polo": 450
        case "Sweatshirt", "Midlayer": 650
        default: 350
        }
    }

    private static func defaultDiscount(for entry: MerchCatalogEntry) -> Int {
        switch appCategory(for: entry.category) {
        case "Caps": 40
        case "T-shirts": 20
        case "Outerwear": 30
        default: 15
        }
    }
}

enum TreeKind: String, CaseIterable, Identifiable {
    case tree = "Tree"
    case bush = "Bush"
    case plant = "Plant"

    var id: String { rawValue }
    var symbol: String {
        switch self {
        case .tree: "tree.fill"
        case .bush: "leaf.fill"
        case .plant: "camera.macro"
        }
    }
    var pointsCost: Int {
        switch self {
        case .tree: 2_000
        case .bush: 1_250
        case .plant: 750
        }
    }
    var carbonSavedKg: Double {
        switch self {
        case .tree: 12.0
        case .bush: 5.5
        case .plant: 2.0
        }
    }
}

enum PlantingLocation: String, CaseIterable, Identifiable {
    case singapore = "Singapore"
    case bangkok = "Bangkok"
    case amrTechnologyCampus = "AMR Technology Campus"

    var id: String { rawValue }
    var flag: String {
        switch self {
        case .singapore: "🇸🇬"
        case .bangkok: "🇹🇭"
        case .amrTechnologyCampus: "🇬🇧"
        }
    }
    var country: String {
        switch self {
        case .singapore: "Singapore"
        case .bangkok: "Thailand"
        case .amrTechnologyCampus: "United Kingdom"
        }
    }
}

enum PlantingStatus: String {
    case pending = "Pending"
    case confirmed = "Confirmed"
}

struct PlantedTree: Identifiable {
    let id: UUID
    let kind: TreeKind
    var location: PlantingLocation?
    var plantedDate: String
    let carbonSavedKg: Double
    var status: PlantingStatus

    var species: String { kind.rawValue }
}

enum SustainabilityAction: String, CaseIterable, Identifiable {
    case publicTransport = "Public transport"
    case recycling = "Recycle something"

    var id: String { rawValue }
    var symbol: String {
        switch self {
        case .publicTransport: "bus.fill"
        case .recycling: "arrow.3.trianglepath"
        }
    }
}

struct DemoFanState {
    var greenPoints: Int
    var plantedTrees: [PlantedTree] = []
    var sustainabilityActionsCompleted = 0
    var redeemedMerchIDs = Set<String>()
    var coupons: [RewardCoupon] = []
    var lastQuizRewardDay: String?
    var currentStreak = 0
    var lastActivityDay: String?

    init(greenPoints: Int = 0) {
        self.greenPoints = greenPoints
    }

    var totalEstimatedCarbonKg: Double {
        plantedTrees.reduce(0) { $0 + $1.carbonSavedKg }
    }

    mutating func redeem(_ kind: TreeKind, quantity: Int) -> Bool {
        let safeQuantity = max(1, quantity)
        let totalCost = kind.pointsCost * safeQuantity
        guard greenPoints >= totalCost else { return false }
        greenPoints -= totalCost
        plantedTrees.append(contentsOf: (0..<safeQuantity).map { _ in
            PlantedTree(
                id: UUID(),
                kind: kind,
                location: nil,
                plantedDate: "Today",
                carbonSavedKg: kind.carbonSavedKg,
                status: .pending
            )
        })
        recordActivity()
        return true
    }

    mutating func confirmPlanting(id: UUID, location: PlantingLocation, plantedDate: String) {
        guard let index = plantedTrees.firstIndex(where: { $0.id == id }) else { return }
        plantedTrees[index].location = location
        plantedTrees[index].plantedDate = plantedDate
        plantedTrees[index].status = .confirmed
    }

    mutating func redeemMerch(_ product: MerchPreview) -> Bool {
        guard greenPoints >= product.pointsCost, product.isAvailable else { return false }
        greenPoints -= product.pointsCost
        redeemedMerchIDs.insert(product.id)
        coupons.insert(RewardCoupon(
            code: "AMR-\(String(UUID().uuidString.prefix(8)).uppercased())",
            productName: product.name,
            storeURLString: product.storeURLString,
            discountPercent: product.discountPercent,
            pointsSpent: product.pointsCost,
            createdAt: Date.now.formatted(date: .abbreviated, time: .omitted),
            expiry: "30 days",
            status: "Demo only"
        ), at: 0)
        return true
    }

    mutating func claimDailyQuizReward() -> Bool {
        let today = Date.now.formatted(date: .numeric, time: .omitted)
        guard lastQuizRewardDay != today else { return false }
        lastQuizRewardDay = today
        greenPoints += 100
        recordActivity()
        return true
    }

    mutating func completeSustainabilityAction() {
        greenPoints += 100
        sustainabilityActionsCompleted += 1
        recordActivity()
    }

    mutating func recordActivity(on date: Date = .now, calendar: Calendar = .current) {
        let day = calendar.startOfDay(for: date)
        let formatter = Date.ISO8601FormatStyle().year().month().day()
        let dayKey = day.formatted(formatter)
        guard lastActivityDay != dayKey else { return }

        if let lastActivityDay,
           let previousDay = calendar.date(byAdding: .day, value: -1, to: day),
           lastActivityDay == previousDay.formatted(formatter) {
            currentStreak += 1
        } else {
            currentStreak = 1
        }
        lastActivityDay = dayKey
    }
}

struct RewardCoupon: Identifiable {
    let id = UUID()
    let code: String
    let productName: String
    let storeURLString: String
    let discountPercent: Int
    let pointsSpent: Int
    let createdAt: String
    let expiry: String
    let status: String
}

enum FanTab: String, CaseIterable, Identifiable {
    case home = "Home"
    case rewards = "Rewards"
    case impact = "Impact"
    case travel = "Travel"

    var id: String { rawValue }
    var symbol: String {
        switch self {
        case .home: "house.fill"
        case .rewards: "gift.fill"
        case .impact: "tree.fill"
        case .travel: "paperplane.fill"
        }
    }
}

enum FanDestination: String, Identifiable {
    case profile, account, news, paddock, travel, challenges, history, tree, offers, caps, tshirts, outerwear, other, content, quiz

    var id: String { rawValue }
}

enum MerchCategory: String, CaseIterable, Identifiable {
    case all = "All"
    case caps = "Caps"
    case tshirts = "T-shirts"
    case outerwear = "Outerwear"
    case other = "Other"

    var id: String { rawValue }
    var catalogCategory: String? {
        switch self {
        case .all: nil
        case .caps: "Caps"
        case .tshirts: "T-shirts"
        case .outerwear: "Outerwear"
        case .other: "Other"
        }
    }
    var heroImageKey: KeyPath<Driver, String>? {
        switch self {
        case .all, .other: nil
        case .caps: \.capHeroImageName
        case .tshirts: \.topsHeroImageName
        case .outerwear: \.outerwearHeroImageName
        }
    }
}

struct ChallengeIdea: Identifiable {
    let id: UUID
    let title: String
    let author: String
    let tag: String
    var rankingPoints: Int
    let moderation: String
    let lifecycle: String
    let fulfilment: String

    var isSelected: Bool { lifecycle == "selected" }
}

struct RaceChallenge: Identifiable {
    let id: UUID
    let race: String
    let dateLabel: String
    var ideas: [ChallengeIdea]
    let isPast: Bool
}

struct SubmissionRecord: Identifiable {
    let id: UUID
    let text: String
    let tag: String?
    let createdAt: String
    let fee: Int
    let resubmissionOf: String?
    let moderation: String
    let rankingPoints: Int?
    let lifecycle: String?
    let fulfilment: String
}

extension RaceChallenge {
    static let examples = [
        RaceChallenge(
            id: UUID(),
            race: "Malaysia Grand Prix",
            dateLabel: "Next upcoming race",
            ideas: [
                ChallengeIdea(id: UUID(), title: "Green pit-lane relay", author: "Maya", tag: "activity", rankingPoints: 1_284, moderation: "approved", lifecycle: "backlog", fulfilment: "demonstration"),
                ChallengeIdea(id: UUID(), title: "Fan-designed helmet detail", author: "Ravi", tag: "activity", rankingPoints: 1_184, moderation: "approved", lifecycle: "backlog", fulfilment: "demonstration"),
                ChallengeIdea(id: UUID(), title: "Sunset team photo challenge", author: "Aisha", tag: "activity", rankingPoints: 896, moderation: "pending", lifecycle: "backlog", fulfilment: "demonstration")
            ],
            isPast: false
        ),
        RaceChallenge(
            id: UUID(),
            race: "Singapore Grand Prix",
            dateLabel: "Following race",
            ideas: [
                ChallengeIdea(id: UUID(), title: "Night-race fan light trail", author: "Jules", tag: "activity", rankingPoints: 1_006, moderation: "approved", lifecycle: "backlog", fulfilment: "demonstration"),
                ChallengeIdea(id: UUID(), title: "Green city photo lap", author: "Isha", tag: "activity", rankingPoints: 934, moderation: "approved", lifecycle: "backlog", fulfilment: "demonstration")
            ],
            isPast: false
        ),
        RaceChallenge(
            id: UUID(),
            race: "Monaco Grand Prix",
            dateLabel: "24 May 2026",
            ideas: [
                ChallengeIdea(id: UUID(), title: "Harbour-side fan roll call", author: "Leo", tag: "activity", rankingPoints: 2_241, moderation: "approved", lifecycle: "selected", fulfilment: "demonstration"),
                ChallengeIdea(id: UUID(), title: "Team radio impression", author: "Nia", tag: "activity", rankingPoints: 2_203, moderation: "approved", lifecycle: "selected", fulfilment: "demonstration"),
                ChallengeIdea(id: UUID(), title: "Race-weekend sketchbook", author: "Sam", tag: "activity", rankingPoints: 1_117, moderation: "approved", lifecycle: "backlog", fulfilment: "demonstration")
            ],
            isPast: true
        )
    ]
}
