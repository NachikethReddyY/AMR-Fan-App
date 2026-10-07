package com.amr.fanapp.ui.screens

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Person
import androidx.compose.material3.Icon
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import com.amr.fanapp.network.BackendAccount
import com.amr.fanapp.ui.theme.FanColors
import com.amr.fanapp.ui.theme.FanButton

internal fun profileNeedsSetup(account: BackendAccount?): Boolean {
    val profile = account?.realProfile ?: return false
    val name = profile.displayName.trim()
    return name.isEmpty() || name == "Fan" || name == "Unknown" || profile.birthday.isNullOrBlank()
}

internal fun normalizeBirthdayInput(value: String): String = value.replace('/', '-')

@Composable
fun ProfileSetupScreen(
    account: BackendAccount?,
    onSave: (name: String, email: String, birthday: String) -> Unit,
    onSkip: () -> Unit,
    saving: Boolean = false,
    error: String? = null,
) {
    var name by remember { mutableStateOf(account?.realProfile?.displayName?.takeIf { it != "Fan" && it != "Unknown" }.orEmpty()) }
    var email by remember { mutableStateOf(account?.realProfile?.email.orEmpty()) }
    var birthday by remember { mutableStateOf(account?.realProfile?.birthday.orEmpty()) }
    Column(Modifier.verticalScroll(rememberScrollState()).padding(24.dp), verticalArrangement = Arrangement.spacedBy(18.dp)) {
        Icon(Icons.Filled.Person, contentDescription = null, tint = FanColors.teal, modifier = Modifier.height(45.dp))
        SectionHeader("Set up your profile.", "Your name appears on Home. Add your birthday so we can celebrate with you.")
        OutlinedTextField(
            value = name,
            onValueChange = { name = it },
            label = { Text("Name") },
            singleLine = true,
            colors = profileFieldColors(),
            modifier = Modifier.padding(0.dp),
        )
        OutlinedTextField(
            value = email,
            onValueChange = { email = it },
            label = { Text("Email") },
            singleLine = true,
            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Email),
            colors = profileFieldColors(),
        )
        OutlinedTextField(
            value = birthday,
            onValueChange = { birthday = normalizeBirthdayInput(it) },
            label = { Text("Birthday (YYYY-MM-DD)") },
            singleLine = true,
            colors = profileFieldColors(),
        )
        if (!error.isNullOrBlank()) Text(error, color = androidx.compose.ui.graphics.Color(0xFFFFA726))
        FanButton(if (saving) "Saving…" else "Save and continue", { onSave(name.trim(), email.trim(), birthday.trim()) })
        FanButton("Skip for now", onSkip)
        Spacer(Modifier.height(20.dp))
    }
}

@Composable
internal fun profileFieldColors() = OutlinedTextFieldDefaults.colors(
    focusedBorderColor = FanColors.teal,
    unfocusedBorderColor = FanColors.muted,
    focusedLabelColor = FanColors.teal,
    unfocusedLabelColor = FanColors.muted,
    focusedTextColor = androidx.compose.ui.graphics.Color.White,
    unfocusedTextColor = androidx.compose.ui.graphics.Color.White,
)
