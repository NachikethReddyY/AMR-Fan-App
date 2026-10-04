package com.amr.fanapp.ui.theme

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.LocalContentColor
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.darkColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp

object FanColors {
    val background = Color(0xFF0A0A0A)
    val panel = Color(0xFF1E2020)
    val darkTeal = Color(0xFF222727)
    val teal = Color(0xFF45988F)
    val introGreen = Color(0xFF30974E)
    val muted = Color(0xFFA1B0AB)
    val orange = Color(0xFFFF9D48)
}

object FanMotion { const val pageMillis = 280 }

private val fanScheme = darkColorScheme(
    background = FanColors.background,
    surface = FanColors.panel,
    primary = FanColors.teal,
    secondary = FanColors.teal,
    onBackground = Color.White,
    onSurface = Color.White,
    onPrimary = Color.Black,
)

@Composable fun FanTheme(content: @Composable () -> Unit) {
    MaterialTheme(colorScheme = fanScheme) {
        androidx.compose.runtime.CompositionLocalProvider(LocalContentColor provides Color.White, content = content)
    }
}

fun Modifier.panelCard(radius: Int = 20) =
    background(FanColors.panel, RoundedCornerShape(radius.dp))
        .border(1.dp, Color.White.copy(alpha = .07f), RoundedCornerShape(radius.dp))

fun Modifier.capsuleButton() = background(FanColors.teal, RoundedCornerShape(50))

@Composable
fun FanButton(text: String, onClick: () -> Unit, modifier: Modifier = Modifier) {
    val interaction = remember { MutableInteractionSource() }
    Surface(
        modifier = modifier.clickable(interactionSource = interaction, indication = null, onClick = onClick),
        color = FanColors.darkTeal,
        shape = RoundedCornerShape(15.dp),
        border = androidx.compose.foundation.BorderStroke(1.dp, FanColors.teal.copy(alpha = .55f)),
    ) { Text(text, color = Color.White, modifier = Modifier.padding(horizontal = 17.dp, vertical = 13.dp)) }
}
