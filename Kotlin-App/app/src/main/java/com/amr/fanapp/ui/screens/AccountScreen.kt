package com.amr.fanapp.ui.screens
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Person
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp
import com.amr.fanapp.network.BackendAccount
import com.amr.fanapp.ui.theme.FanColors
import com.amr.fanapp.ui.theme.FanButton

@Composable
fun AccountScreen(account: BackendAccount?, onSignOut: () -> Unit) {
    Column(Modifier.verticalScroll(rememberScrollState()).padding(24.dp), verticalArrangement = Arrangement.spacedBy(22.dp)) {
        Icon(Icons.Filled.Person, contentDescription = null, tint = FanColors.teal, modifier = Modifier.height(45.dp))
        SectionHeader(if (account != null) "Your account." else "Connect your account.", if (account != null) "Your backend profile and earned balance." else "Sign in securely with your AMR Fan account.")
        if (account?.realProfile != null) {
            FeatureCard {
                Text(account.realProfile!!.displayName, style = androidx.compose.material3.MaterialTheme.typography.titleLarge)
                Text("${account.realProfile!!.balance} earned points", color = FanColors.teal, style = androidx.compose.material3.MaterialTheme.typography.titleMedium)
                Text("This balance is stored by the backend. Local demo Green Points remain separate.", color = FanColors.muted, style = androidx.compose.material3.MaterialTheme.typography.bodySmall)
            }
            FanButton("Sign out", onSignOut)
        } else {
            FanButton("Sign in", onSignOut)
        }
        Spacer(Modifier.height(20.dp))
    }
}
