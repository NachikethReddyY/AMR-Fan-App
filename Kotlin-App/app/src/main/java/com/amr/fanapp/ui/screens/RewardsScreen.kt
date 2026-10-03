package com.amr.fanapp.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Bolt
import androidx.compose.material.icons.filled.CardGiftcard
import androidx.compose.material.icons.filled.Checkroom
import androidx.compose.material.icons.filled.Flag
import androidx.compose.material.icons.filled.LocalFlorist
import androidx.compose.material.icons.filled.PlayCircle
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.amr.fanapp.domain.DemoFanState
import com.amr.fanapp.domain.Driver
import com.amr.fanapp.domain.FanDestination
import com.amr.fanapp.ui.theme.FanColors
import com.amr.fanapp.ui.theme.FanButton
import com.amr.fanapp.ui.theme.panelCard

@Composable
fun RewardsScreen(state: DemoFanState, open: (FanDestination) -> Unit, modifier: Modifier = Modifier, driver: Driver = Driver.ALONSO) {
    var section by remember { mutableStateOf("Rewards") }
    Column(modifier.fillMaxWidth().verticalScroll(rememberScrollState()).background(FanColors.background).padding(horizontal = 22.dp), verticalArrangement = Arrangement.spacedBy(20.dp)) {
        SectionHeader("Rewards.", "Your points. Your choices.", Modifier.padding(top = 30.dp))
        Row(Modifier.fillMaxWidth().panelCard(20).padding(18.dp), verticalAlignment = Alignment.CenterVertically) {
            Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(4.dp)) { Text("Green Points", color = FanColors.muted); Text(state.greenPoints.toString(), fontWeight = FontWeight.Bold, style = androidx.compose.material3.MaterialTheme.typography.headlineMedium) }
            Icon(Icons.Filled.Bolt, contentDescription = null, tint = FanColors.teal)
        }
        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(9.dp)) {
            listOf("Rewards", "Coupons").forEach { tab -> Text(tab, color = if (section == tab) Color.White else FanColors.muted, fontWeight = FontWeight.Bold, modifier = Modifier.weight(1f).background(if (section == tab) FanColors.darkTeal else FanColors.panel, RoundedCornerShape(50)).clickable { section = tab }.padding(12.dp)) }
        }
        if (section == "Coupons") {
            FeatureCard { Icon(Icons.Filled.CardGiftcard, contentDescription = null, tint = FanColors.teal); Text("Your coupon codes", fontWeight = FontWeight.Bold); Text(if (state.coupons.isEmpty()) "Claim a merchandise offer to see its code here." else state.coupons.joinToString("\n") { it.code }, color = FanColors.muted) }
        } else {
            ActionRow("Fan challenges", "Your idea. The team's stage.", { open(FanDestination.CHALLENGES) }) { Icon(Icons.Filled.Flag, contentDescription = null, tint = FanColors.teal) }
            Text("Merchandise", style = androidx.compose.material3.MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold)
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                PreviewCard(driver.capAsset, "Caps", Modifier.weight(1f)) { open(FanDestination.CAPS) }
                PreviewCard(driver.teamwearAsset, "T-shirts", Modifier.weight(1f)) { open(FanDestination.TSHIRTS) }
            }
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                PreviewCard(driver.outerwearAsset, "Outerwear", Modifier.weight(1f)) { open(FanDestination.OUTERWEAR) }
                CategoryCard("Other", "Official team collection", Icons.Filled.Checkroom, Modifier.weight(1f)) { open(FanDestination.OTHER) }
            }
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                CategoryCard("Trees", "${state.plantedTrees.size} pending", Icons.Filled.LocalFlorist, Modifier.weight(1f)) { open(FanDestination.TREE) }
                CategoryCard("Stories", "Team access", Icons.Filled.PlayCircle, Modifier.weight(1f)) { open(FanDestination.CONTENT) }
            }
        }
        Spacer(Modifier.height(90.dp))
    }
}

@Composable
private fun PreviewCard(asset: String, title: String, modifier: Modifier = Modifier, onClick: () -> Unit) {
    Column(modifier.panelCard(19).clickable(onClick = onClick).padding(10.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
        ImageAsset(asset, Modifier.fillMaxWidth().height(118.dp), title)
        Text(title, fontWeight = FontWeight.Bold)
        Text("Official team collection", color = FanColors.muted, style = androidx.compose.material3.MaterialTheme.typography.bodySmall)
    }
}

@Composable
private fun CategoryCard(title: String, detail: String, icon: ImageVector, modifier: Modifier = Modifier, onClick: () -> Unit) {
    Column(modifier.height(105.dp).panelCard(19).clickable(onClick = onClick).padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) { Icon(icon, contentDescription = null, tint = Color.White); Spacer(Modifier.weight(1f)); Text(title, fontWeight = FontWeight.Bold); Text(detail, color = FanColors.muted, style = androidx.compose.material3.MaterialTheme.typography.bodySmall) }
}
