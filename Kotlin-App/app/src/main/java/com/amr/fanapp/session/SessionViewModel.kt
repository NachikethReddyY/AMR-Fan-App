package com.amr.fanapp.session

import android.app.Application
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.amr.fanapp.auth.EncryptedSessionTokenStore
import com.amr.fanapp.network.BackendAccount
import com.amr.fanapp.network.BackendClient
import com.amr.fanapp.network.BackendError
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

class SessionViewModel(app: Application) : AndroidViewModel(app) {
    private val client = BackendClient(); private val store = EncryptedSessionTokenStore(app)
    private val _account = MutableStateFlow<BackendAccount?>(null); val account: StateFlow<BackendAccount?> = _account.asStateFlow()
    private val _isBusy = MutableStateFlow(false); val isBusy: StateFlow<Boolean> = _isBusy.asStateFlow()
    private val _errorMessage = MutableStateFlow<String?>(null); val errorMessage: StateFlow<String?> = _errorMessage.asStateFlow()
    val isConnected get() = account.value != null
    init { resume() }
    fun resume() { store.read()?.let { run { _account.value = client.account(it) } } }
    fun signInForLocalDemo() { if (com.amr.fanapp.BuildConfig.DEBUG) { _account.value = BackendAccount("demo-account", "fan", listOf(com.amr.fanapp.network.BackendProfile("demo-profile", "real", "AMR Demo Fan", 9000))) } }
    fun signOut() { store.read()?.let { run { client.logout(it); store.delete(); _account.value = null } } }
    private fun run(block: suspend () -> Unit) { viewModelScope.launch { _isBusy.value = true; _errorMessage.value = null; try { block() } catch (error: BackendError) { _errorMessage.value = error.message } catch (error: Exception) { _errorMessage.value = error.message ?: "Something went wrong." } finally { _isBusy.value = false } } }
}
