package com.amr.fanapp.domain

import java.time.LocalDate
import java.util.UUID
import kotlinx.serialization.Serializable

enum class Driver(val displayName: String, val number: String, val firstName: String, val imageAsset: String, val capAsset: String, val teamwearAsset: String, val outerwearAsset: String) {
    ALONSO("Alonso", "14", "Fernando", "alonsocard_alonso", "alonsocapportrait_alonso_cap", "alonsoteamwearportrait_alonso_teamwear", "alonsoouterwearportrait_alonso_outerwear"),
    STROLL("Stroll", "18", "Lance", "strollcard_stroll", "strollcapportrait_stroll_cap", "strollteamwearportrait_stroll_teamwear", "strollouterwearportrait_stroll_outerwear")
}

enum class FanTab(val label: String) { HOME("Home"), REWARDS("Rewards"), IMPACT("Impact") }
enum class FanDestination { PROFILE, ACCOUNT, NEWS, PADDOCK, TRAVEL, CHALLENGES, HISTORY, TREE, OFFERS, CAPS, TSHIRTS, OUTERWEAR, OTHER, CONTENT, QUIZ, CAMERA }
enum class TreeKind(val label: String, val pointsCost: Int, val carbonSavedKg: Double) { TREE("Tree", 2000, 12.0), BUSH("Bush", 1250, 5.5), PLANT("Plant", 750, 2.0) }
enum class PlantingLocation(val label: String, val flag: String, val country: String) { SINGAPORE("Singapore", "🇸🇬", "Singapore"), BANGKOK("Bangkok", "🇹🇭", "Thailand"), AMR_TECHNOLOGY_CAMPUS("AMR Technology Campus", "🇬🇧", "United Kingdom") }
enum class PlantingStatus { PENDING, CONFIRMED }

data class PlantedTree(val id: UUID = UUID.randomUUID(), val kind: TreeKind, var location: PlantingLocation? = null, var plantedDate: String = "Today", val carbonSavedKg: Double = kind.carbonSavedKg, var status: PlantingStatus = PlantingStatus.PENDING)
data class RewardCoupon(val code: String, val productName: String, val storeUrl: String, val discountPercent: Int, val pointsSpent: Int, val createdAt: String, val expiry: String = "30 days", val status: String = "Demo only")

@Serializable data class MerchCatalogEntry(val category: String, val driver: String? = null, val id: String, val imageAssetName: String, val name: String, val url: String, val appRewardPointsCost: Int? = null, val appRewardDiscountPercent: Int? = null, val year: String? = null)
@Serializable data class MerchCatalogDocument(val products: List<MerchCatalogEntry>)
data class MerchPreview(val entry: MerchCatalogEntry) {
    val id get() = entry.id; val name get() = entry.name; val storeUrl get() = entry.url; val isAvailable = true
    val category get() = when (entry.category) { "Headwear" -> "Caps"; "T-shirt", "Polo" -> "T-shirts"; "Outerwear" -> "Outerwear"; else -> "Other" }
    val discountPercent get() = entry.appRewardDiscountPercent ?: when (category) { "Caps" -> 40; "T-shirts" -> 20; "Outerwear" -> 30; else -> 15 }
    val pointsCost get() = entry.appRewardPointsCost ?: when (entry.category) { "Headwear" -> 250; "Outerwear", "Sweatshirt", "Midlayer" -> 650; "T-shirt", "Polo" -> 450; else -> 350 }
}

data class DemoFanState(val greenPoints: Int = 0, val plantedTrees: List<PlantedTree> = emptyList(), val sustainabilityActionsCompleted: Int = 0, val redeemedMerchIds: Set<String> = emptySet(), val coupons: List<RewardCoupon> = emptyList(), val lastQuizRewardDay: String? = null, val currentStreak: Int = 0, val lastActivityDay: LocalDate? = null) {
    val totalEstimatedCarbonKg get() = plantedTrees.sumOf { it.carbonSavedKg }
    fun redeem(kind: TreeKind, quantity: Int = 1): DemoFanState { val safe = quantity.coerceAtLeast(1); val cost = kind.pointsCost * safe; if (greenPoints < cost) return this; return copy(greenPoints = greenPoints - cost, plantedTrees = plantedTrees + List(safe) { PlantedTree(kind = kind) }).recordActivity() }
    fun confirmPlanting(id: UUID, location: PlantingLocation, plantedDate: String): DemoFanState = copy(plantedTrees = plantedTrees.map { if (it.id == id) it.copy(location = location, plantedDate = plantedDate, status = PlantingStatus.CONFIRMED) else it })
    fun redeemMerch(product: MerchPreview): DemoFanState { if (greenPoints < product.pointsCost || !product.isAvailable) return this; val coupon = RewardCoupon("AMR-${UUID.randomUUID().toString().take(8).uppercase()}", product.name, product.storeUrl, product.discountPercent, product.pointsCost, LocalDate.now().toString()); return copy(greenPoints = greenPoints - product.pointsCost, redeemedMerchIds = redeemedMerchIds + product.id, coupons = listOf(coupon) + coupons) }
    fun claimDailyQuizReward(today: LocalDate = LocalDate.now()): DemoFanState = if (lastQuizRewardDay == today.toString()) this else copy(greenPoints = greenPoints + 100, lastQuizRewardDay = today.toString()).recordActivity(today)
    fun completeSustainabilityAction(): DemoFanState = copy(greenPoints = greenPoints + 100, sustainabilityActionsCompleted = sustainabilityActionsCompleted + 1).recordActivity()
    fun recordActivity(date: LocalDate = LocalDate.now()): DemoFanState { if (lastActivityDay == date) return this; val next = if (lastActivityDay == date.minusDays(1)) currentStreak + 1 else 1; return copy(currentStreak = next, lastActivityDay = date) }
}

data class ChallengeIdea(val id: UUID = UUID.randomUUID(), val title: String, val author: String, val tag: String = "activity", val rankingPoints: Int, val moderation: String = "approved", val lifecycle: String = "backlog", val fulfilment: String = "demonstration")
data class RaceChallenge(val id: UUID = UUID.randomUUID(), val race: String, val dateLabel: String, val ideas: List<ChallengeIdea>, val isPast: Boolean)
data class SubmissionRecord(val id: UUID = UUID.randomUUID(), val text: String, val tag: String?, val createdAt: String, val fee: Int, val resubmissionOf: String?, val moderation: String, val rankingPoints: Int?, val lifecycle: String?, val fulfilment: String)
