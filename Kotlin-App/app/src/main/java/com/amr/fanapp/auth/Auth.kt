package com.amr.fanapp.auth

import android.content.Context
import androidx.security.crypto.EncryptedSharedPreferences
import androidx.security.crypto.MasterKey
import java.net.URLEncoder
import java.util.Base64
import java.security.MessageDigest
import java.security.SecureRandom

data class OidcConfig(val authority: String = "https://amrfancustomers.ciamlogin.com/9dcdff78-04a7-49fc-90bd-e9c7b76e4774", val clientId: String = "616286cc-a22b-49a2-b5a3-27011fd615a1", val apiScope: String = "api://f278be1f-21a5-455b-bb14-b2fc60373939/account.access", val redirectUri: String = "msauth.com.amr.fanapp://auth") {
    val authorizeUrl get() = "$authority/oauth2/v2.0/authorize"; val tokenUrl get() = "$authority/oauth2/v2.0/token"
    fun authorizationUrl(state: String, challenge: String): String = authorizeUrl + "?" + FormUrlEncoder.encode(mapOf("client_id" to clientId, "response_type" to "code", "redirect_uri" to redirectUri, "response_mode" to "query", "scope" to "openid profile email offline_access $apiScope", "state" to state, "code_challenge" to challenge, "code_challenge_method" to "S256"))
}
data class PkceCodePair(val verifier: String, val challenge: String) { companion object { fun create(verifier: String = SecureRandomToken.create()): PkceCodePair { val digest = MessageDigest.getInstance("SHA-256").digest(verifier.toByteArray()); return PkceCodePair(verifier, Base64.getUrlEncoder().withoutPadding().encodeToString(digest)) } } }
object SecureRandomToken { fun create(): String { val bytes = ByteArray(32); SecureRandom().nextBytes(bytes); return Base64.getUrlEncoder().withoutPadding().encodeToString(bytes) } }
object FormUrlEncoder { fun encode(values: Map<String, String>) = values.toSortedMap().entries.joinToString("&") { "${component(it.key)}=${component(it.value)}" }; private fun component(value: String) = URLEncoder.encode(value, Charsets.UTF_8.name()).replace("+", "%20") }
interface SessionTokenStore { fun read(): String?; fun write(value: String); fun delete() }
class EncryptedSessionTokenStore(context: Context) : SessionTokenStore { private val prefs = EncryptedSharedPreferences.create(context, "amr_session", MasterKey.Builder(context).setKeyScheme(MasterKey.KeyScheme.AES256_GCM).build(), EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV, EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM); override fun read() = prefs.getString("token", null); override fun write(value: String) { prefs.edit().putString("token", value).apply() }; override fun delete() { prefs.edit().remove("token").apply() } }
