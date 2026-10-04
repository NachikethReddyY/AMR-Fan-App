package com.amr.fanapp.network

import com.amr.fanapp.BuildConfig
import com.amr.fanapp.auth.OidcConfig
import com.amr.fanapp.domain.Driver
import io.ktor.client.HttpClient
import io.ktor.client.call.body
import io.ktor.client.engine.android.Android
import io.ktor.client.plugins.contentnegotiation.ContentNegotiation
import io.ktor.client.request.delete
import io.ktor.client.request.get
import io.ktor.client.request.header
import io.ktor.client.request.post
import io.ktor.client.request.setBody
import io.ktor.client.statement.HttpResponse
import io.ktor.http.ContentType
import io.ktor.http.HttpHeaders
import io.ktor.http.contentType
import io.ktor.serialization.kotlinx.json.json
import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json

@Serializable data class BackendProfile(val id: String, val kind: String, val displayName: String, val balance: Int)
@Serializable data class BackendAccount(val id: String, val role: String, val profiles: List<BackendProfile>) { val realProfile get() = profiles.firstOrNull { it.kind == "real" } }
@Serializable data class BackendSessionResponse(val token: String, val expiresAt: String, val account: BackendAccount)
@Serializable data class BackendRouteLeg(val mode: String, val distanceMeters: Double, val durationSeconds: Double, val description: String)
@Serializable data class BackendRouteAvailability(val kind: String, val reason: String? = null)
@Serializable data class BackendRouteOption(val id: String, val mode: String, val availability: BackendRouteAvailability, val legs: List<BackendRouteLeg>, val distanceMeters: Double? = null, val durationSeconds: Double? = null)
@Serializable data class BackendRouteResult(val kind: String, val routes: List<BackendRouteOption>? = null, val reason: String? = null)
@Serializable data class BackendEstimate(val kind: String, val kgCo2e: Double? = null, val kg: Double? = null, val reason: String? = null)
@Serializable data class BackendRouteEstimate(@SerialName("routeId") val routeId: String, val estimate: BackendEstimate)
@Serializable data class BackendRouteResponse(val result: BackendRouteResult, val estimates: List<BackendRouteEstimate>)
@Serializable data class BackendTransportCoordinate(val latitude: Double, val longitude: Double)
@Serializable data class BackendTransportLeg(val kind: String, val mode: String, val from: String, val to: String, val startsAt: String, val endsAt: String, val durationSeconds: Double, val description: String, val instruction: String? = null, val fromCoordinate: BackendTransportCoordinate? = null, val toCoordinate: BackendTransportCoordinate? = null)
@Serializable data class BackendTransportRoute(val id: String, val mode: String, val legs: List<BackendTransportLeg>, val durationSeconds: Double, val waitSeconds: Double, val transfers: Int, val arrivesAt: String, val meetsDeadline: Boolean, val distanceMeters: Double? = null)
@Serializable data class BackendTransportUnavailable(val mode: String, val reason: String)
@Serializable data class BackendTransportRecommendation(val kind: String, val routeId: String? = null, val reason: String)
@Serializable data class BackendTransportPlan(val routes: List<BackendTransportRoute>, val unavailable: List<BackendTransportUnavailable>, val recommendation: BackendTransportRecommendation, val awardEligible: Boolean)
@Serializable data class BackendActivityReward(val kind: String, val points: Int, val receiptId: String? = null, val balanceAfter: Int? = null, val policyVersion: String? = null, val reason: String? = null)
@Serializable data class BackendActivityResponse(val kind: String, val assessmentId: String? = null, val category: String? = null, val evidenceScore: Int? = null, val confidence: Double? = null, val rationale: String? = null, val reason: String? = null, val reward: BackendActivityReward? = null) { val creditedPoints get() = reward?.points ?: 0 }
@Serializable private data class RouteRequest(val origin: String, val destination: String, val extraMinutes: Int = 15, val modes: List<String> = listOf("DRIVE", "TRANSIT", "WALK", "BICYCLE"))
@Serializable private data class TransportRequest(val origin: String, val destination: String, val departAt: String, val modes: List<String> = listOf("train", "bus", "walk", "car"))
@Serializable private data class EmptyBody(val placeholder: String = "")
@Serializable private data class FixtureRequest(val fixture: String)

sealed class BackendError(message: String) : Exception(message) { data object NotSignedIn : BackendError("Connect a fan account before using this feature."); data object InvalidResponse : BackendError("The backend returned an invalid response."); data class Server(val code: Int, val detail: String) : BackendError(detail); data object UnsupportedImage : BackendError("Choose a photo smaller than 2 MB after compression."); data object VerificationUnavailable : BackendError("Photo analysis is not available on this backend yet. Your photo was not uploaded."); data object AuthFailed : BackendError("Sign-in could not be completed. Please try again.") }

class BackendClient(private val baseUrl: String = BuildConfig.API_BASE_URL, private val http: HttpClient = HttpClient(Android) { install(ContentNegotiation) { json(Json { ignoreUnknownKeys = true }) } }) {
    private fun url(path: String) = baseUrl.trimEnd('/') + "/" + path.trimStart('/')
    private fun io.ktor.client.request.HttpRequestBuilder.auth(token: String?) { contentType(ContentType.Application.Json); token?.let { header(HttpHeaders.Authorization, "Bearer $it") } }
    suspend fun account(token: String): BackendAccount = http.get(url("v1/me")) { auth(token) }.checked()
    suspend fun routes(token: String, origin: String, destination: String): BackendRouteResponse = http.post(url("v1/routes/query")) { auth(token); setBody(RouteRequest(origin, destination)) }.checked()
    suspend fun transport(origin: String, destination: String): BackendTransportPlan = http.post(url("v1/transport/plan")) { auth(null); setBody(TransportRequest(origin, destination, java.time.OffsetDateTime.now().toString())) }.checked()
    suspend fun exchange(providerToken: String): BackendSessionResponse = http.post(url("v1/session")) { auth(providerToken); setBody(EmptyBody()) }.checked()
    suspend fun syntheticSignIn(fixture: String): BackendSessionResponse = http.post(url("v1/dev/session")) { auth(null); setBody(FixtureRequest(fixture)) }.checked()
    suspend fun logout(token: String) { http.delete(url("v1/session")) { auth(token) }.checked<EmptyBody>() }
    private suspend inline fun <reified T> HttpResponse.checked(): T { if (status.value !in 200..299) throw BackendError.Server(status.value, "Request failed with HTTP ${status.value}."); return try { body() } catch (_: Exception) { throw BackendError.InvalidResponse } }
}
