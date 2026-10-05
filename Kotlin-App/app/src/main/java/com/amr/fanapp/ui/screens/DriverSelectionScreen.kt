package com.amr.fanapp.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.amr.fanapp.domain.Driver
import com.amr.fanapp.ui.theme.FanColors

@Composable
fun DriverSelectionScreen(onSelect: (Driver) -> Unit) {
    Column(Modifier.fillMaxWidth().verticalScroll(rememberScrollState()).background(FanColors.background).padding(horizontal = 22.dp), verticalArrangement = Arrangement.spacedBy(18.dp)) {
        Text("I / AM", color = FanColors.teal, fontSize = 14.sp, fontWeight = FontWeight.Black, letterSpacing = 5.sp, modifier = Modifier.padding(top = 18.dp))
        Text("On this team.", fontSize = 38.sp, lineHeight = 38.sp, fontWeight = FontWeight.Bold, modifier = Modifier.padding(top = 10.dp))
        Text("Choose the driver you support.", color = FanColors.muted, modifier = Modifier.padding(bottom = 14.dp))
        Driver.entries.forEach { driver ->
            DriverCard(driver, { onSelect(driver) })
        }
    }
}

@Composable
private fun DriverCard(driver: Driver, onClick: () -> Unit) {
    Box(Modifier.fillMaxWidth().height(248.dp).clip(RoundedCornerShape(22.dp)).clickable(onClick = onClick)) {
        ImageAsset(driver.imageAsset, Modifier.fillMaxWidth().height(248.dp), "Support ${driver.firstName} ${driver.displayName}")
        Box(Modifier.fillMaxWidth().height(248.dp).background(Brush.verticalGradient(listOf(Color.Transparent, Color.Black.copy(.7f)))))
        androidx.compose.foundation.layout.Row(Modifier.align(Alignment.BottomStart).fillMaxWidth().padding(22.dp), verticalAlignment = Alignment.CenterVertically) {
            Text("TEAM ${driver.displayName.uppercase()}", fontSize = 11.sp, fontWeight = FontWeight.Black, letterSpacing = 2.sp)
        }
    }
}
