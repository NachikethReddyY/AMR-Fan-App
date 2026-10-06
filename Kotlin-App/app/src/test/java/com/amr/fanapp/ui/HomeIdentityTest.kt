package com.amr.fanapp.ui

import com.amr.fanapp.network.BackendAccount
import com.amr.fanapp.network.BackendProfile
import com.amr.fanapp.ui.screens.homeDisplayName
import org.junit.Assert.assertEquals
import org.junit.Test

class HomeIdentityTest {
    @Test fun homeUsesTheAccountNameInsteadOfTheDriverName() {
        val account = BackendAccount(
            id = "account",
            role = "fan",
            profiles = listOf(BackendProfile("profile", "real", "Nachiketh Reddy", 0)),
        )

        assertEquals("Nachiketh Reddy", homeDisplayName(account))
    }

    @Test fun homeFallsBackToFanWhenNoAccountNameExists() {
        val account = BackendAccount(
            id = "account",
            role = "fan",
            profiles = listOf(BackendProfile("profile", "real", "  ", 0)),
        )

        assertEquals("Fan", homeDisplayName(account))
    }
}
