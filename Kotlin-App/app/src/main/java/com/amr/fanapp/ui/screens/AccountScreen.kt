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

@Composable
fun AccountScreen(account: BackendAccount?, onSave: ((name: String, email: String, birthday: String) -> Unit)? = null, onSignOut: () -> Unit) {
    val profile = account?.realProfile
    var name by remember(profile?.id, profile?.displayName) { mutableStateOf(profile?.displayName.orEmpty()) }
    var email by remember(profile?.id, profile?.email) { mutableStateOf(profile?.email.orEmpty()) }
    var birthday by remember(profile?.id, profile?.birthday) { mutableStateOf(profile?.birthday.orEmpty()) }
    Column(Modifier.verticalScroll(rememberScrollState()).padding(24.dp), verticalArrangement = Arrangement.spacedBy(22.dp)) {
        Icon(Icons.Filled.Person, contentDescription = null, tint = FanColors.teal, modifier = Modifier.height(45.dp))
        SectionHeader(if (account != null) "Your account." else "Connect your account.", if (account != null) "Your backend profile and earned balance." else "Sign in securely with your AMR Fan account.")
        if (profile != null) {
            FeatureCard {
                Text(profile.displayName, style = androidx.compose.material3.MaterialTheme.typography.titleLarge)
                Text("${profile.balance} earned points", color = FanColors.teal, style = androidx.compose.material3.MaterialTheme.typography.titleMedium)
                Text("This balance is stored by the backend. Local demo Green Points remain separate.", color = FanColors.muted, style = androidx.compose.material3.MaterialTheme.typography.bodySmall)
            }
            Column(verticalArrangement = Arrangement.spacedBy(14.dp)) {
                OutlinedTextField(value = name, onValueChange = { name = it }, label = { Text("Name") }, singleLine = true, colors = profileFieldColors())
                OutlinedTextField(value = email, onValueChange = { email = it }, label = { Text("Email") }, singleLine = true, keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Email), colors = profileFieldColors())
                OutlinedTextField(value = birthday, onValueChange = { birthday = it }, label = { Text("Birthday (YYYY-MM-DD)") }, singleLine = true, colors = profileFieldColors())
            }
            if (onSave != null) FanButton("Save profile", { onSave(name.trim(), email.trim(), birthday.trim()) })
            FanButton("Sign out", onSignOut)
        } else {
            FanButton("Sign in", onSignOut)
        }
        Spacer(Modifier.height(20.dp))
    }
}
