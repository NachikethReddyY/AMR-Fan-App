package com.amr.fanapp.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ArrowBack
import androidx.compose.material.icons.filled.DirectionsBike
import androidx.compose.material.icons.filled.DirectionsBus
import androidx.compose.material.icons.filled.DirectionsCar
import androidx.compose.material.icons.filled.DirectionsWalk
import androidx.compose.material.icons.filled.Map
import androidx.compose.material3.Icon
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.Alignment
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.amr.fanapp.ui.theme.FanColors
import com.amr.fanapp.ui.theme.FanButton
import com.amr.fanapp.ui.theme.panelCard
import com.amr.fanapp.BuildConfig
import com.google.android.gms.maps.model.CameraPosition
import com.google.android.gms.maps.model.LatLng
import com.google.maps.android.compose.GoogleMap
import com.google.maps.android.compose.MapProperties
import com.google.maps.android.compose.MapUiSettings
import com.google.maps.android.compose.rememberCameraPositionState
import android.content.Intent
import android.net.Uri
import androidx.compose.ui.platform.LocalContext

@Composable
fun TravelScreen(onBack: () -> Unit) {
    var origin by remember { mutableStateOf("") }
    var destination by remember { mutableStateOf("") }
    var searched by remember { mutableStateOf(false) }
    val context = LocalContext.current
    Column(Modifier.fillMaxWidth().verticalScroll(rememberScrollState()).background(FanColors.background).padding(horizontal = 22.dp), verticalArrangement = Arrangement.spacedBy(18.dp)) {
        Row(Modifier.fillMaxWidth().padding(top = 20.dp), horizontalArrangement = Arrangement.SpaceBetween) { Text("Travel.", color = Color.White, fontSize = 38.sp, fontWeight = FontWeight.Bold); Icon(Icons.Filled.Map, contentDescription = null, tint = FanColors.teal) }
        Text("Plan a lower-impact route to your next race weekend.", color = FanColors.muted)
        if (BuildConfig.GOOGLE_MAPS_API_KEY.isNotBlank()) {
            val cameraPositionState = rememberCameraPositionState { position = CameraPosition.fromLatLngZoom(LatLng(1.3521, 103.8198), 10f) }
            GoogleMap(Modifier.fillMaxWidth().height(220.dp).panelCard(22), cameraPositionState = cameraPositionState, properties = MapProperties(), uiSettings = MapUiSettings(zoomControlsEnabled = false))
        } else {
            Box(Modifier.fillMaxWidth().height(220.dp).panelCard(22), contentAlignment = Alignment.Center) {
                Column(horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(12.dp)) {
                    Icon(Icons.Filled.Map, contentDescription = null, tint = FanColors.muted, modifier = Modifier.size(40.dp))
                    Text("Map preview", color = Color.White, fontWeight = FontWeight.Bold)
                    Text("Coming soon", color = FanColors.muted)
                }
            }
            FanButton("Open Google Maps", {
                val intent = Intent(Intent.ACTION_VIEW, Uri.parse("geo:0,0?q=${Uri.encode(destination.ifBlank { "Singapore" })}"))
                if (intent.resolveActivity(context.packageManager) != null) context.startActivity(intent)
            })
        }
        OutlinedTextField(origin, { origin = it }, Modifier.fillMaxWidth(), label = { Text("From") }, singleLine = true)
        OutlinedTextField(destination, { destination = it }, Modifier.fillMaxWidth(), label = { Text("To") }, singleLine = true)
        FanButton("Search routes", { searched = origin.isNotBlank() && destination.isNotBlank() }, Modifier.fillMaxWidth())
        if (searched) {
            Text("Route options", fontWeight = FontWeight.Bold)
            RouteOption("Public transport", "Live estimates unavailable", Icons.Filled.DirectionsBus)
            RouteOption("Drive", "Add provider data for route estimates", Icons.Filled.DirectionsCar)
            RouteOption("Walk or cycle", "Best for short journeys", Icons.Filled.DirectionsWalk)
        }
        FanButton("Back", onBack, Modifier.fillMaxWidth())
        Spacer(Modifier.height(25.dp))
    }
}

@Composable
private fun RouteOption(title: String, detail: String, icon: androidx.compose.ui.graphics.vector.ImageVector) {
    Row(Modifier.fillMaxWidth().panelCard(16).padding(17.dp), horizontalArrangement = Arrangement.spacedBy(14.dp)) { Icon(icon, contentDescription = null, tint = FanColors.teal); Column { Text(title, fontWeight = FontWeight.Bold); Text(detail, color = FanColors.muted, style = androidx.compose.material3.MaterialTheme.typography.bodySmall) } }
}
