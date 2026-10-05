package com.amr.fanapp.ui.screens

import androidx.compose.animation.AnimatedContent
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.CardGiftcard
import androidx.compose.material.icons.filled.Home
import androidx.compose.material.icons.filled.Eco
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
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
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.draw.clip
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.amr.fanapp.ui.theme.FanColors

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
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.SpaceBetween, modifier = Modifier.fillMaxWidth()) {
            Row(horizontalArrangement = Arrangement.spacedBy(5.dp), modifier = Modifier.width(112.dp).height(5.dp)) {
                pages.indices.forEach { index ->
                    androidx.compose.foundation.layout.Box(
                        Modifier.weight(1f).fillMaxHeight().clip(CircleShape)
                            .background(if (index <= step) FanColors.astonGreen else Color.White.copy(.2f))
                    )
                }
            }
            androidx.compose.material3.TextButton(onClick = onContinue) { Text("Skip", color = FanColors.muted) }
        }
        AnimatedContent(targetState = step, label = "onboarding") { page ->
            Column(verticalArrangement = Arrangement.spacedBy(18.dp)) {
                Icon(pages[page].icon, contentDescription = null, tint = FanColors.teal, modifier = Modifier.padding(top = 20.dp).then(Modifier))
                Text(pages[page].title, fontSize = 30.sp, fontWeight = FontWeight.Bold)
                Text(pages[page].detail, color = FanColors.muted, fontSize = 17.sp)
            }
        }
        Spacer(Modifier.weight(1f))
        Button(
            onClick = { if (step == pages.lastIndex) onContinue() else step += 1 },
            colors = ButtonDefaults.buttonColors(containerColor = FanColors.astonGreen),
            shape = androidx.compose.ui.graphics.RectangleShape,
            modifier = Modifier.fillMaxWidth(),
        ) {
            Text(
                if (step == pages.lastIndex) "Choose your driver" else "Next",
                color = Color.White,
                modifier = Modifier.fillMaxWidth(),
                textAlign = TextAlign.Center,
            )
        }
    }
}
