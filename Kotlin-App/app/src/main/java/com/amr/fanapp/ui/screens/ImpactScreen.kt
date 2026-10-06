package com.amr.fanapp.ui.screens

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Co2
import androidx.compose.material.icons.filled.DirectionsWalk
import androidx.compose.material.icons.filled.Description
import androidx.compose.material.icons.filled.Eco
import androidx.compose.material.icons.filled.Info
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.amr.fanapp.domain.DemoFanState
import com.amr.fanapp.domain.FanDestination
import com.amr.fanapp.ui.theme.FanColors

@Composable
fun ImpactScreen(state: DemoFanState, open: (FanDestination) -> Unit, modifier: Modifier = Modifier) {
    Column(modifier.fillMaxWidth().verticalScroll(rememberScrollState()).padding(horizontal = 22.dp), verticalArrangement = Arrangement.spacedBy(20.dp)) {
        SectionHeader("Impact.", "Your journeys. Your difference.", Modifier.padding(top = 30.dp))
        FeatureCard {
            Icon(Icons.Filled.Info, contentDescription = null, tint = FanColors.teal)
            Icon(Icons.Filled.Eco, contentDescription = null, tint = FanColors.teal, modifier = Modifier.height(34.dp))
            Text(if (state.plantedTrees.isEmpty()) "Your story starts here." else "Your impact is taking shape.", style = androidx.compose.material3.MaterialTheme.typography.headlineSmall, fontWeight = FontWeight.Bold)
            Text("Verified journeys, Green Points activity, and plantings are separate from community and official AMR figures.", color = FanColors.muted)
        }
        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(12.dp)) {
            ImpactMetric("Unavailable", "VERIFIED JOURNEYS", Icons.Filled.DirectionsWalk, Modifier.weight(1f))
            ImpactMetric("%.1f".format(state.totalEstimatedCarbonKg), "KG CO₂E EST.", Icons.Filled.Co2, Modifier.weight(1f))
        }
        FeatureCard { Text("Together, we go further.", fontWeight = FontWeight.Bold); Text("Community totals are unavailable in this device-only demo.", color = FanColors.muted) }
        FeatureCard { Icon(Icons.Filled.Description, contentDescription = null, tint = FanColors.teal); Text("Official team figures", fontWeight = FontWeight.Bold); Text("Official AMR ESG figures will appear after admin report approval. This demo does not claim team totals.", color = FanColors.muted) }
        com.amr.fanapp.ui.theme.FanButton("View digital forest", { open(FanDestination.TREE) }, Modifier.fillMaxWidth())
        Spacer(Modifier.height(90.dp))
    }
}

@Composable
private fun ImpactMetric(value: String, label: String, icon: androidx.compose.ui.graphics.vector.ImageVector, modifier: Modifier) {
    FeatureCard(modifier) { Icon(icon, contentDescription = null, tint = FanColors.teal); Text(value, fontSize = if (value.length > 8) 24.sp else 35.sp, lineHeight = 30.sp, maxLines = 1, softWrap = false, fontWeight = FontWeight.Bold); Text(label, color = FanColors.muted, fontWeight = FontWeight.Bold) }
}
