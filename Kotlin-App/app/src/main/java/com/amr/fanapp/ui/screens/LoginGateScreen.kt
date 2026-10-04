package com.amr.fanapp.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Lock
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.amr.fanapp.ui.theme.FanColors
import com.amr.fanapp.ui.theme.FanButton

@Composable
fun LoginGateScreen(onDemoLogin: () -> Unit) {
    Column(Modifier.fillMaxSize().background(FanColors.background).padding(25.dp), verticalArrangement = Arrangement.spacedBy(22.dp)) {
        Spacer(Modifier.weight(1f))
        Icon(Icons.Filled.Lock, contentDescription = null, tint = FanColors.teal, modifier = Modifier.padding(bottom = 4.dp))
        Text("Your fan experience starts here.", fontSize = 34.sp, lineHeight = 37.sp, fontWeight = FontWeight.Bold)
        Text("Create an account or sign in to save your driver, points, journeys and rewards.", color = FanColors.muted, fontSize = 17.sp)
        Spacer(Modifier.weight(1f))
        FanButton("Sign in or create account", onDemoLogin, Modifier.fillMaxWidth())
        Text("Sign-in and sign-up pages will be connected here.", color = FanColors.muted, style = androidx.compose.material3.MaterialTheme.typography.bodySmall)
    }
}
