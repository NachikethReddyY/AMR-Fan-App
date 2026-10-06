package com.amr.fanapp.session

import android.app.Application
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.graphics.BitmapFactory
import androidx.browser.customtabs.CustomTabsIntent
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.amr.fanapp.auth.EncryptedSessionTokenStore
import com.amr.fanapp.auth.OidcConfig
import com.amr.fanapp.auth.PkceCodePair
import com.amr.fanapp.auth.PendingAuthTransaction
import com.amr.fanapp.auth.SecureRandomToken
import com.amr.fanapp.network.BackendAccount
import com.amr.fanapp.network.BackendClient
import com.amr.fanapp.network.BackendError
import com.amr.fanapp.network.BackendTransportPlan
import com.amr.fanapp.network.BackendTransportCoordinate
import com.amr.fanapp.network.BackendPlaceSuggestion
import com.amr.fanapp.network.BackendActivityPhoto
import com.amr.fanapp.network.BackendActivityRequest
import com.amr.fanapp.network.BackendActivityResponse
import com.amr.fanapp.network.BackendSessionResponse
import com.amr.fanapp.network.ProviderTokens
import com.amr.fanapp.media.PhotoUploadEncoder
import java.util.Base64
import java.util.UUID
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import kotlinx.serialization.decodeFromString
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json

class SessionViewModel(app: Application) : AndroidViewModel(app) {
    private val client = BackendClient(); private val store = EncryptedSessionTokenStore(app)
    private val oidc = OidcConfig()
    private val json = Json { ignoreUnknownKeys = true }
    private var pendingAuth: PendingAuthTransaction? = null
    private val _account = MutableStateFlow<BackendAccount?>(null); val account: StateFlow<BackendAccount?> = _account.asStateFlow()
    private val _isBusy = MutableStateFlow(false); val isBusy: StateFlow<Boolean> = _isBusy.asStateFlow()
    private val _isRestoring = MutableStateFlow(true); val isRestoring: StateFlow<Boolean> = _isRestoring.asStateFlow()
    private val _errorMessage = MutableStateFlow<String?>(null); val errorMessage: StateFlow<String?> = _errorMessage.asStateFlow()
    private var handledCallback: String? = null
    val isConnected get() = account.value != null
    init { resume() }
    fun resume() {
        store.readCachedAccount()?.let { cached ->
            runCatching { json.decodeFromString<BackendAccount>(cached) }
                .onSuccess { _account.value = it }
                .onFailure { store.clearCachedAccount() }
        }
        val token = store.read()
        if (token == null) {
            _isRestoring.value = false
            return
        }
        viewModelScope.launch {
            _isBusy.value = true
            try {
                val refreshed = client.account(token)
                _account.value = refreshed
                store.writeCachedAccount(json.encodeToString(refreshed))
            } catch (error: BackendError.Server) {
                if (error.code == 401) {
                    val recovered = runCatching { refreshBackendSession() }.getOrNull()
                    if (recovered != null) {
                        _account.value = recovered.account
                        store.writeCachedAccount(json.encodeToString(recovered.account))
                    } else {
                        clearSession()
                        _errorMessage.value = "Sign-in expired. Please sign in again."
                    }
                } else {
                    _errorMessage.value = error.message
                }
            } catch (error: Exception) {
                _errorMessage.value = error.message ?: "Something went wrong."
            } finally {
                _isBusy.value = false
                _isRestoring.value = false
            }
        }
    }
    fun signInForLocalDemo() { if (com.amr.fanapp.BuildConfig.DEBUG) { _account.value = BackendAccount("demo-account", "fan", listOf(com.amr.fanapp.network.BackendProfile("demo-profile", "real", "AMR Demo Fan", 9000))) } }
    fun beginSignIn(context: Context) {
        _errorMessage.value = null
        // A dismissed browser can leave an old challenge behind. Restarting
        // the flow is safer than silently ignoring the user's next tap.
        pendingAuth = null
        store.clearPendingAuth()
        val pkce = PkceCodePair.create()
        val state = SecureRandomToken.create()
        pendingAuth = PendingAuthTransaction(state, pkce.verifier)
        store.writePendingAuth(pendingAuth!!)
        val uri = Uri.parse(oidc.authorizationUrl(state, pkce.challenge))
        try {
            val customTabs = CustomTabsIntent.Builder().build()
            if (customTabs.intent.resolveActivity(context.packageManager) != null) {
                customTabs.launchUrl(context, uri)
            } else {
                val browser = Intent(Intent.ACTION_VIEW, uri)
                if (browser.resolveActivity(context.packageManager) == null) throw IllegalStateException("No browser is available.")
                context.startActivity(browser)
            }
        } catch (error: Exception) {
            pendingAuth = null
            store.clearPendingAuth()
            _errorMessage.value = error.message ?: "Unable to open sign-in."
        }
    }

    fun handleAuthCallback(uri: Uri?) {
        if (uri?.scheme != "msauth.com.amr.fanapp" || uri.host != "auth") return
        val callback = uri.toString()
        if (handledCallback == callback) return
        handledCallback = callback
        val transaction = pendingAuth ?: store.readPendingAuth()
        pendingAuth = null
        store.clearPendingAuth()
        if (transaction == null) {
            _errorMessage.value = "Sign-in expired. Please try again."
            return
        }
        val error = uri.getQueryParameter("error")
        if (error != null) {
            _errorMessage.value = uri.getQueryParameter("error_description") ?: "Sign-in was cancelled."
            return
        }
        val code = uri.getQueryParameter("code")
        if (!transaction.matches(uri.getQueryParameter("state")) || code.isNullOrBlank()) {
            _errorMessage.value = "Sign-in could not be verified. Please try again."
            return
        }
        run {
            val providerTokens = client.exchangeCode(code, transaction.verifier)
            val session = client.exchange(providerTokens.accessToken)
            persistSession(providerTokens, session)
            _account.value = session.account
        }
    }
    suspend fun updateProfile(patch: com.amr.fanapp.network.ProfileUpdate) {
        val token = store.read() ?: throw BackendError.NotSignedIn
        val profile = account.value?.realProfile ?: throw BackendError.NotSignedIn
        client.updateProfile(token, profile.id, patch)
        _account.value = client.account(token)
    }

    fun signOut() {
        val token = store.read()
        viewModelScope.launch {
            _isBusy.value = true
            runCatching { token?.let { client.logout(it) } }
            clearSession()
            _isBusy.value = false
        }
    }
    suspend fun planTransport(origin: String, destination: String): BackendTransportPlan {
        return client.transport(origin, destination)
    }
    suspend fun planTransport(origin: BackendTransportCoordinate, destination: BackendTransportCoordinate): BackendTransportPlan {
        return client.transport(origin, destination)
    }
    suspend fun searchPlaces(query: String): List<BackendPlaceSuggestion> = client.searchPlaces(query)
    suspend fun verifyActivity(uri: Uri): BackendActivityResponse {
        val token = store.read() ?: throw BackendError.NotSignedIn
        val profile = account.value?.realProfile ?: throw BackendError.NotSignedIn
        if (!client.activityAvailable(token, profile.id)) throw BackendError.VerificationUnavailable
        val bytes = withContext(Dispatchers.IO) {
            getApplication<Application>().contentResolver.openInputStream(uri)?.use { it.readBytes() }
        } ?: throw BackendError.UnsupportedImage
        val bitmap = PhotoUploadEncoder.downsampledImage(bytes) ?: throw BackendError.UnsupportedImage
        val jpeg = PhotoUploadEncoder.jpegData(bitmap) ?: throw BackendError.UnsupportedImage
        return client.uploadActivity(
            token,
            profile.id,
            BackendActivityRequest(
                requestId = UUID.randomUUID().toString(),
                description = "Identify the sustainable activity visible in this photo.",
                photos = listOf(BackendActivityPhoto("image/jpeg", Base64.getEncoder().encodeToString(jpeg))),
            ),
        )
    }
    private fun run(block: suspend () -> Unit) { viewModelScope.launch { _isBusy.value = true; _errorMessage.value = null; try { block() } catch (error: BackendError.Server) { _errorMessage.value = if (error.code == 401) "Sign-in expired. Please try again." else error.message } catch (error: BackendError) { _errorMessage.value = error.message } catch (error: Exception) { _errorMessage.value = error.message ?: "Something went wrong." } finally { _isBusy.value = false } } }
    private suspend fun refreshBackendSession(): BackendSessionResponse? {
        val refreshToken = store.readRefreshToken() ?: return null
        val providerTokens = client.refreshProviderToken(refreshToken)
        val session = client.exchange(providerTokens.accessToken)
        persistSession(providerTokens, session)
        return session
    }
    private fun persistSession(providerTokens: ProviderTokens, session: BackendSessionResponse) {
        store.write(session.token)
        providerTokens.refreshToken?.takeIf { it.isNotBlank() }?.let(store::writeRefreshToken)
        store.writeCachedAccount(json.encodeToString(session.account))
    }
    private fun clearSession() {
        store.delete()
        store.clearRefreshToken()
        store.clearCachedAccount()
        _account.value = null
    }
}
