package com.amr.fanapp.domain

import com.amr.fanapp.network.BackendTransportPlan
import com.amr.fanapp.network.BackendTransportRoute

enum class TransitSort { SUGGESTED, FASTEST, GREENEST, SIMPLEST }

fun formatKg(value: Double, gas: String): String =
    if (value < 1) "%.2f kg %s".format(value, gas) else "%.1f kg %s".format(value, gas)

fun transitCo2(plan: BackendTransportPlan, routeId: String): Pair<String, Double>? {
    val item = plan.estimates.firstOrNull { it.routeId == routeId } ?: return null
    return when (item.estimate.kind) {
        "estimated_co2" -> item.estimate.kg?.let { formatKg(it, "CO₂") to it }
        "estimated" -> item.estimate.kgCo2e?.let { formatKg(it, "CO₂e") to it }
        else -> null
    }
}

fun transitUnavailableReason(plan: BackendTransportPlan, routeId: String): String? {
    val item = plan.estimates.firstOrNull { it.routeId == routeId } ?: return null
    if (item.estimate.kind != "unavailable") return null
    return item.estimate.reason?.replace('_', ' ')
}

fun lowestCo2RouteId(plan: BackendTransportPlan): String? {
    // Single-gas comparison only; mixed gases withhold the badge like iOS.
    val gases = plan.routes.mapNotNull { route ->
        plan.estimates.firstOrNull { it.routeId == route.id }?.estimate?.kind
    }.toSet()
    if (gases.size != 1) return null
    return plan.routes.minByOrNull { transitCo2(plan, it.id)?.second ?: Double.POSITIVE_INFINITY }?.id
}

fun recommendedTransitRouteId(plan: BackendTransportPlan): String? {
    val jev = plan.jev
    if (jev?.kind == "ranked") {
        val top = jev.orderedRouteIds?.firstOrNull()
        if (top != null && plan.routes.any { it.id == top } && transitCo2(plan, top) != null) return top
    }
    if (plan.recommendation.kind != "recommended") return null
    val id = plan.recommendation.routeId ?: return null
    if (!plan.routes.any { it.id == id }) return null
    if (transitCo2(plan, id) == null) return null
    return id
}

fun transitSummary(route: BackendTransportRoute): String {
    val walkMinutes = (route.legs.filter { it.kind == "walk" }.sumOf { it.durationSeconds } / 60).toInt()
    val transfers = maxOf(0, route.legs.count { it.kind == "ride" || it.kind == "drive" } - 1)
    val parts = mutableListOf<String>()
    if (walkMinutes > 0) parts += "$walkMinutes min walk"
    if (transfers > 0) parts += "$transfers transfer" + (if (transfers == 1) "" else "s")
    if (parts.isEmpty()) parts += "Direct ride"
    return parts.joinToString(" · ")
}

fun displayTitle(route: BackendTransportRoute): String {
    val modes = route.legs.map { it.mode }.toSet()
    return if (modes.contains("train") && modes.contains("bus") || route.mode == "transit") "Train + bus"
    else route.mode.replaceFirstChar { it.uppercase() }
}

fun sortedTransportRoutes(plan: BackendTransportPlan, sort: TransitSort): List<BackendTransportRoute> {
    val routes = plan.routes
    return when (sort) {
        TransitSort.SUGGESTED -> routes
        TransitSort.FASTEST -> routes.sortedBy { it.durationSeconds }
        TransitSort.GREENEST -> routes.sortedBy { transitCo2(plan, it.id)?.second ?: Double.POSITIVE_INFINITY }
        TransitSort.SIMPLEST -> routes.sortedWith(compareBy({ it.transfers }, { it.durationSeconds }))
    }
}
