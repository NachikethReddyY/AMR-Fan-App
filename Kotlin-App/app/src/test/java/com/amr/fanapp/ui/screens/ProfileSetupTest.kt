package com.amr.fanapp.ui.screens

import org.junit.Assert.assertEquals
import org.junit.Test

class ProfileSetupTest {
    @Test fun normalizesSlashSeparatedBirthdayForApiContract() {
        assertEquals("2008-09-20", normalizeBirthdayInput("2008/09/20"))
    }
}
