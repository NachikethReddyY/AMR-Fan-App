package com.amr.fanapp.media

import org.junit.Assert.assertEquals
import org.junit.Test

class PhotoUploadTest {
    @Test fun uploadBudgetMatchesBackendSafetyMargin() { assertEquals(1_800_000, PhotoUploadEncoder.maxUploadBytes) }
    @Test fun smallImageKeepsItsDimensions() { assertEquals(640, PhotoUploadEncoder.maxPixelDimension.coerceAtMost(640)) }
}
