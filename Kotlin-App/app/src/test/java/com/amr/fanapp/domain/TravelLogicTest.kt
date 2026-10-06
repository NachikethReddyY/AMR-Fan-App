package com.amr.fanapp.domain

import com.amr.fanapp.network.BackendEstimate
import com.amr.fanapp.network.BackendJevRank
import com.amr.fanapp.network.BackendTransportEstimate
import com.amr.fanapp.network.BackendTransportLeg
import com.amr.fanapp.network.BackendTransportPlan
import com.amr.fanapp.network.BackendTransportRecommendation
import com.amr.fanapp.network.BackendTransportRoute
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class TravelLogicTest {
    private fun leg(kind: String, mode: String, seconds: Double) = BackendTransportLeg(
        kind, mode, "a", "b", "s", "e", seconds, "Leg", null, null, null, null,
    )
    private fun route(id: String, mode: String, seconds: Double, legs: List<BackendTransportLeg>, transfers: Int = 0) =
        BackendTransportRoute(id, mode, legs, seconds, 0.0, transfers, "e", true, null)
    private fun est(routeId: String, kg: Double?) = BackendTransportEstimate(
        routeId,
        if (kg == null) BackendEstimate("unavailable", null, null, "invalid_route")
        else BackendEstimate("estimated", kg, null, null),
    )
    private fun plan(routes: List<BackendTransportRoute>, estimates: List<BackendTransportEstimate>, recommendationId: String? = null, jev: BackendJevRank? = null) =
        BackendTransportPlan(
            routes, emptyList(), estimates,
            BackendTransportRecommendation(if (recommendationId == null) "unavailable" else "recommended", recommendationId, "reason"),
            jev, false,
        )

    @Test fun `co2 text and badge follow estimates`() {
        val train = route("t", "train", 1260.0, listOf(leg("ride", "train", 1200.0)))
        val car = route("c", "car", 540.0, listOf(leg("drive", "car", 540.0)))
        val value = plan(listOf(train, car), listOf(est("t", 0.03), est("c", 0.64)), "t")
        assertEquals("0.03 kg CO₂e" to 0.03, transitCo2(value, "t"))
        assertEquals("t", recommendedTransitRouteId(value))
        assertEquals(
            "55 min walk",
            transitSummary(route("w", "walk", 3300.0, listOf(leg("walk", "walk", 3300.0)))),
        )
    }

    @Test fun `fastest fallback without estimate is never badged`() {
        val car = route("c", "car", 540.0, listOf(leg("drive", "car", 540.0)))
        val value = plan(listOf(car), listOf(est("c", null)), "c")
        assertNull(recommendedTransitRouteId(value))
        assertEquals("invalid route", transitUnavailableReason(value, "c"))
    }

    @Test fun `jev pick wins when estimated, deterministic otherwise`() {
        val train = route("t", "train", 1260.0, listOf(leg("ride", "train", 1200.0)))
        val car = route("c", "car", 540.0, listOf(leg("drive", "car", 540.0)))
        val estimates = listOf(est("t", 0.03), est("c", 0.64))
        val ranked = plan(listOf(train, car), estimates, "t", BackendJevRank("ranked", listOf("c", "t"), null))
        assertEquals("c", recommendedTransitRouteId(ranked))
        val fallback = plan(listOf(train, car), estimates, "t", BackendJevRank("unavailable", null, "disabled"))
        assertEquals("t", recommendedTransitRouteId(fallback))
    }

    @Test fun `lowest badge needs single gas family`() {
        val train = route("t", "train", 1260.0, listOf(leg("ride", "train", 1200.0)))
        val walk = route("w", "walk", 3300.0, listOf(leg("walk", "walk", 3300.0)))
        val value = plan(listOf(train, walk), listOf(est("t", 0.03), est("w", 0.0)), null)
        assertEquals("w", lowestCo2RouteId(value))
        val mixed = plan(
            listOf(train, walk),
            listOf(
                BackendTransportEstimate("t", BackendEstimate("estimated", 0.03, null, null)),
                BackendTransportEstimate("w", BackendEstimate("estimated_co2", null, 0.0, null)),
            ),
            null,
        )
        assertNull(lowestCo2RouteId(mixed))
    }

    @Test fun `greenest sinks unknown, simplest uses transfers`() {
        val train = route("t", "train", 1260.0, listOf(leg("ride", "train", 1200.0)), transfers = 0)
        val mixed = route("m", "transit", 1440.0, listOf(leg("ride", "train", 700.0), leg("ride", "bus", 700.0)), transfers = 1)
        val walk = route("w", "walk", 3300.0, listOf(leg("walk", "walk", 3300.0)), transfers = 0)
        val value = plan(listOf(mixed, walk, train), listOf(est("t", 0.03), est("w", 0.0)), null)
        assertEquals(listOf("w", "t", "m"), sortedTransportRoutes(value, TransitSort.GREENEST).map { it.id })
        assertEquals(listOf("t", "m", "w"), sortedTransportRoutes(value, TransitSort.FASTEST).map { it.id })
        assertEquals(listOf("t", "w", "m"), sortedTransportRoutes(value, TransitSort.SIMPLEST).map { it.id })
        assertEquals("55 min walk", transitSummary(walk))
        assertEquals("Train + bus", displayTitle(mixed))
    }
}
