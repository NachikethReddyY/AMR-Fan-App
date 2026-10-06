package com.amr.fanapp.domain

import android.content.Context
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.core.stringPreferencesKey
import androidx.datastore.preferences.preferencesDataStore
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.map

private val Context.fanPreferences by preferencesDataStore("fan_preferences")
class PreferencesStore(private val context: Context) {
    private val driverKey = stringPreferencesKey("supported_driver")
    val driver: Flow<String?> = context.fanPreferences.data.map { it[driverKey] }
    suspend fun saveDriver(driver: Driver) { context.fanPreferences.edit { it[driverKey] = driver.name } }
    private val skippedSetupKey = stringPreferencesKey("profile_setup_skipped")
    val profileSetupSkipped: Flow<String?> = context.fanPreferences.data.map { it[skippedSetupKey] }
    suspend fun skipProfileSetup(accountId: String) { context.fanPreferences.edit { it[skippedSetupKey] = accountId } }
}
