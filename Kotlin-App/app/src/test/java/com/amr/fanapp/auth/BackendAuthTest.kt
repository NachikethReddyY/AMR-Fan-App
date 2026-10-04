package com.amr.fanapp.auth

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class BackendAuthTest {
    @Test fun pkceChallengeMatchesSwift() {
        val pair = PkceCodePair.create("0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ-._~")
        assertEquals("7SjWf5Of9twuEYtSj6OLPS7Cghq5qnlkvYWqFFxRvWo", pair.challenge)
    }
    @Test fun formEncodingUsesRfc3986Spaces() { assertEquals("a%20b=x%2By", FormUrlEncoder.encode(mapOf("a b" to "x+y"))) }
    @Test fun authorizationURLIncludesStateAndChallenge() { val url = OidcConfig().authorizationUrl("state", "challenge").toString(); assertTrue(url.contains("state=state")); assertTrue(url.contains("code_challenge=challenge")) }
}
