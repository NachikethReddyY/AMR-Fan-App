package com.amr.fanapp.domain

import org.junit.Assert.assertEquals
import org.junit.Test

class CatalogTest {
    @Test fun categoryDefaultsMatchSwiftRules() { val cap = MerchPreview(MerchCatalogEntry("Headwear", id = "cap", imageAssetName = "cap", name = "Cap", url = "https://example.com")); assertEquals("Caps", cap.category); assertEquals(250, cap.pointsCost); assertEquals(40, cap.discountPercent) }
}
