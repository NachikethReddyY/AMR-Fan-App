package com.amr.fanapp.ui.screens

import androidx.compose.animation.AnimatedContent
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ArrowForward
import androidx.compose.material.icons.filled.CardGiftcard
import androidx.compose.material.icons.filled.Home
import androidx.compose.material.icons.filled.Eco
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.amr.fanapp.ui.theme.FanColors
import com.amr.fanapp.ui.theme.FanButton

private data class OnboardingPage(val title: String, val detail: String, val icon: androidx.compose.ui.graphics.vector.ImageVector)

@Composable
fun OnboardingScreen(onContinue: () -> Unit) {
    val pages = listOf(
        OnboardingPage("Your home", "Follow Aston Martin and keep your fan activity in one place.", Icons.Filled.Home),
        OnboardingPage("Travel with impact", "Explore lower-impact ways to reach race weekends and track your estimates.", Icons.Filled.Eco),
        OnboardingPage("Earn your way in", "Collect points through fan activities and use them on rewards.", Icons.Filled.CardGiftcard),
    )
    var step by remember { mutableIntStateOf(0) }
    Column(Modifier.fillMaxSize().background(FanColors.background).padding(25.dp), verticalArrangement = Arrangement.spacedBy(18.dp)) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Row(horizontalArrangement = Arrangement.spacedBy(6.dp), modifier = Modifier.weight(1f)) { pages.indices.forEach { index -> Text(if (index == step) "━━━━" else "━", color = if (index == step) FanColors.teal else Color.White.copy(.2f), fontSize = 16.sp) } }
            FanButton("Skip", onContinue)
        }
        AnimatedContent(targetState = step, label = "onboarding") { page ->
            Column(verticalArrangement = Arrangement.spacedBy(18.dp)) {
                Icon(pages[page].icon, contentDescription = null, tint = FanColors.teal, modifier = Modifier.padding(top = 20.dp).then(Modifier))
                Text(pages[page].title, fontSize = 30.sp, fontWeight = FontWeight.Bold)
                Text(pages[page].detail, color = FanColors.muted, fontSize = 17.sp)
            }
        }
        Spacer(Modifier.weight(1f))
        FanButton(if (step == pages.lastIndex) "Choose your driver" else "Next", { if (step == pages.lastIndex) onContinue() else step += 1 }, Modifier.fillMaxWidth())
    }
}
