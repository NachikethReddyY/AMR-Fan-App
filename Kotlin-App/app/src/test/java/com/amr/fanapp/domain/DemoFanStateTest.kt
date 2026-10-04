package com.amr.fanapp.domain

import java.time.LocalDate
import org.junit.Assert.assertEquals
import org.junit.Test

class DemoFanStateTest {
    @Test fun redemptionDeductsPointsAndCreatesPendingPlanting() { val result = DemoFanState(2000).redeem(TreeKind.TREE); assertEquals(0, result.greenPoints); assertEquals(1, result.plantedTrees.size); assertEquals(PlantingStatus.PENDING, result.plantedTrees.single().status) }
    @Test fun consecutiveActivityExtendsStreak() { val first = DemoFanState().recordActivity(LocalDate.of(2026, 1, 1)); val second = first.recordActivity(LocalDate.of(2026, 1, 2)); assertEquals(2, second.currentStreak) }
    @Test fun duplicateQuizRewardIsIdempotent() { val first = DemoFanState().claimDailyQuizReward(LocalDate.of(2026, 1, 1)); assertEquals(first, first.claimDailyQuizReward(LocalDate.of(2026, 1, 1))) }
}
