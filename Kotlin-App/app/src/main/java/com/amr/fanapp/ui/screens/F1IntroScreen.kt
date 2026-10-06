package com.amr.fanapp.ui.screens

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.core.tween
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.amr.fanapp.ui.theme.FanColors
import kotlinx.coroutines.delay

@Composable
fun F1IntroScreen(onContinue: () -> Unit) {
    var showMessage by remember { mutableStateOf(false) }
    LaunchedEffect(Unit) { delay(400); showMessage = true; delay(700); onContinue() }
    Box(Modifier.fillMaxSize().background(FanColors.background), contentAlignment = Alignment.Center) {
        AnimatedVisibility(visible = !showMessage, enter = fadeIn(tween(120)), exit = fadeOut(tween(120))) {
            Column(horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(4.dp)) {
                Text("WELCOME!", color = Color.White, fontSize = 36.sp, fontWeight = FontWeight.Black, fontStyle = FontStyle.Italic, letterSpacing = (-1).sp)
                Text("to", color = Color.White, fontSize = 62.sp, fontWeight = FontWeight.Black, fontStyle = FontStyle.Italic)
            }
        }
        AnimatedVisibility(visible = showMessage, enter = fadeIn(tween(120)), exit = fadeOut(tween(120))) {
            Text("Your fan experience awaits", color = Color.White, fontSize = 31.sp, fontWeight = FontWeight.Black, fontStyle = FontStyle.Italic, textAlign = TextAlign.Center, modifier = Modifier.fillMaxWidth().padding(28.dp))
        }
    }
}
