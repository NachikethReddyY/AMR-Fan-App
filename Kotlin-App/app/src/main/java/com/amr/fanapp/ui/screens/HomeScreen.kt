package com.amr.fanapp.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.CameraAlt
import androidx.compose.material.icons.filled.ChevronRight
import androidx.compose.material.icons.filled.Flag
import androidx.compose.material.icons.filled.Newspaper
import androidx.compose.material.icons.filled.Person
import androidx.compose.material.icons.filled.Psychology
import androidx.compose.material.icons.filled.WorkspacePremium
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.rotate
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.Font
import androidx.compose.ui.text.font.FontVariation
import androidx.compose.ui.text.ExperimentalTextApi
import com.amr.fanapp.R
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.amr.fanapp.domain.DemoFanState
import com.amr.fanapp.domain.Driver
import com.amr.fanapp.domain.FanDestination
import com.amr.fanapp.network.BackendAccount
import com.amr.fanapp.ui.theme.FanColors
import com.amr.fanapp.ui.theme.panelCard
import java.time.LocalTime

@OptIn(ExperimentalTextApi::class)
private val RoundedNumbers = FontFamily(Font(
    R.font.nunito,
    weight = FontWeight.Black,
    variationSettings = FontVariation.Settings(FontVariation.weight(900)),
))

internal fun homeDisplayName(account: BackendAccount?): String =
    account?.realProfile?.displayName?.trim()?.takeIf { it.isNotEmpty() } ?: "Fan"

@Composable
fun HomeScreen(driver: Driver, account: BackendAccount?, state: DemoFanState, open: (FanDestination) -> Unit) {
    val greeting = remember { when (LocalTime.now().hour) { in 0..11 -> "Good Morning,"; in 12..16 -> "Good Afternoon,"; else -> "Good Evening," } }
    val accountName = homeDisplayName(account)
    Column(
        Modifier.fillMaxSize().background(FanColors.background).verticalScroll(rememberScrollState()).padding(bottom = 106.dp),
    ) {
        Box(Modifier.fillMaxWidth().height(405.dp)) {
            Text(
                text = driver.number,
                modifier = Modifier.offset(x = (-20).dp, y = (-78).dp).clearAndSetSemantics {},
                color = FanColors.teal.copy(alpha = .15f),
                fontFamily = RoundedNumbers,
                fontSize = 270.sp,
                lineHeight = 270.sp,
                fontWeight = FontWeight.Black,
                letterSpacing = (-30).sp,
            )
            Column(Modifier.fillMaxWidth().padding(top = 8.dp)) {
                Row(Modifier.fillMaxWidth().padding(horizontal = 28.dp, vertical = 22.dp), verticalAlignment = Alignment.Top) {
                    Column(Modifier.weight(1f)) {
                        Text(greeting, fontSize = 29.sp, lineHeight = 31.sp, fontWeight = FontWeight.SemiBold)
                        Text(accountName + "!", Modifier.padding(start = 15.dp), color = FanColors.teal, fontSize = 29.sp, lineHeight = 31.sp, fontWeight = FontWeight.SemiBold)
                    }
                    IconButton(onClick = { open(FanDestination.PROFILE) }, modifier = Modifier.size(48.dp).semantics { contentDescription = "Profile" }) {
                        CircleIcon({ Icon(Icons.Filled.Person, contentDescription = null, tint = Color.White, modifier = Modifier.size(25.dp)) }, 48.dp)
                    }
                }
                HeroCards(state)
                QuickActions(open)
            }
        }
        RaceIqCard { open(FanDestination.QUIZ) }
    }
}

@Composable
private fun HeroCards(state: DemoFanState) {
    Box(Modifier.fillMaxWidth().height(196.dp)) {
        MetricCard(state.greenPoints.toString(), "Green Points", isPoints = true, modifier = Modifier.align(Alignment.TopEnd).offset(y = 6.dp).rotate(-18f))
        MetricCard(state.currentStreak.toString(), "Day Streak", isPoints = false, modifier = Modifier.align(Alignment.TopStart).offset(y = 17.dp).rotate(18f))
    }
}

@Composable
private fun MetricCard(value: String, caption: String, isPoints: Boolean, modifier: Modifier) {
    Column(
        modifier.fillMaxWidth(.53f).height(151.dp)
            .background(Brush.linearGradient(listOf(Color.White.copy(.12f), Color.White.copy(.04f))), RoundedCornerShape(17.dp))
            .border(.8.dp, Color.White.copy(.28f), RoundedCornerShape(17.dp))
            .padding(horizontal = 16.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center,
    ) {
        if (!isPoints) Icon(Icons.Filled.WorkspacePremium, contentDescription = "Day streak", tint = FanColors.orange, modifier = Modifier.size(27.dp))
        Text(value, fontSize = if (isPoints) 52.sp else 48.sp, lineHeight = 56.sp, fontWeight = FontWeight.Bold, color = Color.White, maxLines = 1, overflow = TextOverflow.Clip)
        Text(caption, fontSize = 14.sp, fontWeight = FontWeight.SemiBold, color = Color.White, maxLines = 1)
    }
}

@Composable
private fun QuickActions(open: (FanDestination) -> Unit) {
    Row(Modifier.fillMaxWidth().padding(horizontal = 30.dp, vertical = 20.dp), horizontalArrangement = Arrangement.SpaceBetween) {
        QuickAction(Icons.Filled.Newspaper, "News") { open(FanDestination.NEWS) }
        QuickAction(Icons.Filled.CameraAlt, "Camera") { open(FanDestination.CAMERA) }
        QuickAction(Icons.Filled.Flag, "Challenges") { open(FanDestination.CHALLENGES) }
    }
}

@Composable
private fun QuickAction(icon: androidx.compose.ui.graphics.vector.ImageVector, label: String, onClick: () -> Unit) {
    Column(Modifier.width(84.dp).clickable(onClick = onClick), horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(7.dp)) {
        CircleIcon({ Icon(icon, contentDescription = label, tint = Color.White, modifier = Modifier.size(26.dp)) }, 66.dp)
        Text(label, fontSize = 11.sp, color = FanColors.muted, maxLines = 1)
    }
}

@Composable
private fun RaceIqCard(onClick: () -> Unit) {
    Row(
        Modifier.fillMaxWidth().padding(horizontal = 22.dp).panelCard(21).clickable(onClick = onClick).padding(17.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(15.dp),
    ) {
        Box(Modifier.size(46.dp).background(Color.White.copy(.07f), RoundedCornerShape(14.dp)), contentAlignment = Alignment.Center) {
            Icon(Icons.Filled.Psychology, contentDescription = null, tint = Color.White, modifier = Modifier.size(26.dp))
        }
        Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(4.dp)) {
            Text("Race IQ", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold)
            Text("Play daily and earn Green Points.", color = FanColors.muted, style = MaterialTheme.typography.bodySmall)
        }
        Icon(Icons.Filled.ChevronRight, contentDescription = null, tint = FanColors.muted)
    }
}
