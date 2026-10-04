package com.amr.fanapp.ui.screens

import android.Manifest
import android.content.Context
import android.content.pm.PackageManager
import android.location.Location
import android.location.LocationListener
import android.location.LocationManager
import android.graphics.Color as AndroidColor
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.DirectionsCar
import androidx.compose.material.icons.filled.DirectionsWalk
import androidx.compose.material.icons.filled.Map
import androidx.compose.material.icons.filled.Train
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.Alignment
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.core.content.ContextCompat
import java.time.Instant
import java.time.ZoneId
import java.time.format.DateTimeFormatter
import java.util.Locale
import com.amr.fanapp.network.BackendTransportLeg
import com.amr.fanapp.network.BackendTransportPlan
import com.amr.fanapp.session.SessionViewModel
import com.amr.fanapp.ui.theme.FanButton
import com.amr.fanapp.ui.theme.FanColors
import com.amr.fanapp.ui.theme.panelCard
import androidx.compose.ui.viewinterop.AndroidView
import org.osmdroid.config.Configuration
import org.osmdroid.tileprovider.tilesource.TileSourceFactory
import org.osmdroid.util.GeoPoint
import org.osmdroid.views.MapView
import org.osmdroid.views.overlay.Marker
import org.osmdroid.views.overlay.Polyline

@Composable
fun TravelScreen(onBack: () -> Unit, session: SessionViewModel) {
    var origin by remember { mutableStateOf("orchard") }
    var destination by remember { mutableStateOf("bayfront") }
    var searched by remember { mutableStateOf(false) }
    var loading by remember { mutableStateOf(false) }
    var error by remember { mutableStateOf<String?>(null) }
    var plan by remember { mutableStateOf<BackendTransportPlan?>(null) }
    var selectedRoute by remember { mutableStateOf<String?>(null) }
    var navigating by remember { mutableStateOf(false) }
    var stepIndex by remember { mutableIntStateOf(0) }
    var currentLocation by remember { mutableStateOf<Location?>(null) }
    val context = LocalContext.current
    val locationManager = remember { context.getSystemService(Context.LOCATION_SERVICE) as LocationManager }
    val permissionLauncher = rememberLauncherForActivityResult(ActivityResultContracts.RequestMultiplePermissions()) { grants ->
        if (grants[Manifest.permission.ACCESS_FINE_LOCATION] == true || grants[Manifest.permission.ACCESS_COARSE_LOCATION] == true) navigating = true
        else error = "Location access is required for automatic next-step guidance."
    }

    DisposableEffect(navigating) {
        if (!navigating) return@DisposableEffect onDispose {}
        val listener = object : LocationListener { override fun onLocationChanged(location: Location) { currentLocation = location } }
        val fine = ContextCompat.checkSelfPermission(context, Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED
        val coarse = ContextCompat.checkSelfPermission(context, Manifest.permission.ACCESS_COARSE_LOCATION) == PackageManager.PERMISSION_GRANTED
        if (fine || coarse) {
            locationManager.requestLocationUpdates(LocationManager.GPS_PROVIDER, 2_000L, 5f, listener)
            locationManager.requestLocationUpdates(LocationManager.NETWORK_PROVIDER, 2_000L, 5f, listener)
        }
        onDispose { locationManager.removeUpdates(listener) }
    }

    val selected = plan?.routes?.firstOrNull { it.id == selectedRoute } ?: plan?.routes?.firstOrNull()
    val steps = selected?.legs.orEmpty()
    LaunchedEffect(currentLocation, navigating, selected?.id, stepIndex) {
        val target = steps.getOrNull(stepIndex)?.toCoordinate ?: return@LaunchedEffect
        val location = currentLocation ?: return@LaunchedEffect
        val distance = FloatArray(1)
        Location.distanceBetween(location.latitude, location.longitude, target.latitude, target.longitude, distance)
        if (distance[0] <= 50f && stepIndex < steps.lastIndex) stepIndex += 1
    }
    LaunchedEffect(searched) {
        if (!searched) return@LaunchedEffect
        loading = true; error = null
        try {
            plan = session.planTransport(origin, destination)
            selectedRoute = plan?.recommendation?.routeId ?: plan?.routes?.firstOrNull()?.id
        } catch (cause: Exception) { error = cause.message ?: "Transport is unavailable." }
        finally { loading = false }
    }

    Column(Modifier.fillMaxWidth().verticalScroll(rememberScrollState()).background(FanColors.background).padding(horizontal = 22.dp), verticalArrangement = Arrangement.spacedBy(16.dp)) {
        Row(Modifier.fillMaxWidth().padding(top = 20.dp), horizontalArrangement = Arrangement.SpaceBetween) { Text("Travel.", color = Color.White, fontSize = 38.sp, fontWeight = FontWeight.Bold); Icon(Icons.Filled.Map, contentDescription = null, tint = FanColors.teal) }
        OSMRouteMap(selected, Modifier.fillMaxWidth().height(220.dp).panelCard(22))
        OutlinedTextField(origin, { origin = it }, Modifier.fillMaxWidth(), label = { Text("From stop") }, singleLine = true)
        OutlinedTextField(destination, { destination = it }, Modifier.fillMaxWidth(), label = { Text("To stop") }, singleLine = true)
        FanButton("Find routes", { searched = origin.isNotBlank() && destination.isNotBlank() }, Modifier.fillMaxWidth())
        if (loading) CircularProgressIndicator(color = FanColors.teal)
        error?.let { Text(it, color = FanColors.orange) }
        plan?.let { value ->
            value.routes.forEach { route ->
                val isSelected = route.id == selected?.id
                Row(Modifier.fillMaxWidth().panelCard(16).padding(16.dp), horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                        Icon(if (route.mode == "car") Icons.Filled.DirectionsCar else if (route.mode == "walk") Icons.Filled.DirectionsWalk else Icons.Filled.Train, contentDescription = null, tint = FanColors.teal)
                    val modeLabel = when {
                        route.legs.any { it.mode == "train" } && route.legs.any { it.mode == "bus" } -> "Train + bus"
                        route.mode == "transit" -> "Train + bus"
                        else -> route.mode.replaceFirstChar { it.uppercase() }
                    }
                    Column(Modifier.weight(1f)) { Text(modeLabel, fontWeight = FontWeight.Bold); Text("${route.durationSeconds.toInt() / 60} min · ${formatArrival(route.arrivesAt)} arrival", color = FanColors.muted); Text(route.legs.joinToString(" → ") { it.description }, color = FanColors.muted, style = androidx.compose.material3.MaterialTheme.typography.bodySmall) }
                    FanButton(if (isSelected) "Selected" else "Use", { selectedRoute = route.id; stepIndex = 0 }, Modifier)
                }
            }
            value.unavailable.forEach { item -> Text("${item.mode}: ${item.reason.replace('_', ' ')}", color = FanColors.muted, style = androidx.compose.material3.MaterialTheme.typography.bodySmall) }
        }
        if (selected != null && !navigating) FanButton("Start navigation", {
            val fine = ContextCompat.checkSelfPermission(context, Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED
            val coarse = ContextCompat.checkSelfPermission(context, Manifest.permission.ACCESS_COARSE_LOCATION) == PackageManager.PERMISSION_GRANTED
            if (fine || coarse) navigating = true else permissionLauncher.launch(arrayOf(Manifest.permission.ACCESS_FINE_LOCATION, Manifest.permission.ACCESS_COARSE_LOCATION))
        }, Modifier.fillMaxWidth())
        if (navigating && selected != null) {
            val current = steps.getOrNull(stepIndex)
            Text("Navigation", fontWeight = FontWeight.Bold)
            Text(if (currentLocation == null) "Waiting for your GPS position…" else "GPS active. Move toward the next step to advance automatically.", color = FanColors.muted)
            current?.let { NavigationStep(it, stepIndex + 1, steps.size) }
            FanButton("Stop navigation", { navigating = false }, Modifier.fillMaxWidth())
        }
        Spacer(Modifier.height(25.dp))
    }
}

private val arrivalFormatter = DateTimeFormatter.ofPattern("h:mm a", Locale.getDefault())

private fun formatArrival(value: String): String = runCatching {
    Instant.parse(value).atZone(ZoneId.systemDefault()).format(arrivalFormatter)
}.getOrDefault("Arrival time unavailable")

@Composable
private fun OSMRouteMap(
    route: com.amr.fanapp.network.BackendTransportRoute?,
    modifier: Modifier,
) {
    val context = LocalContext.current
    val mapView = remember {
        Configuration.getInstance().userAgentValue = context.packageName
        MapView(context).apply {
            setTileSource(TileSourceFactory.MAPNIK)
            setMultiTouchControls(true)
            controller.setZoom(12.0)
            controller.setCenter(GeoPoint(1.2931, 103.8520))
        }
    }
    DisposableEffect(mapView) { onDispose { mapView.onDetach() } }
    Box(modifier.clip(RoundedCornerShape(22.dp))) {
        AndroidView(factory = { mapView }, modifier = Modifier.fillMaxSize(), update = { view ->
            view.overlays.clear()
            val points = route?.legs.orEmpty().flatMap { leg ->
                listOfNotNull(leg.fromCoordinate, leg.toCoordinate).map { GeoPoint(it.latitude, it.longitude) }
            }.distinctBy { "${it.latitude},${it.longitude}" }
            if (points.size >= 2) {
                view.overlays += Polyline(view).apply {
                    setPoints(points)
                    outlinePaint.color = AndroidColor.rgb(65, 190, 177)
                    outlinePaint.strokeWidth = 8f
                }
                points.first().let { point -> view.overlays += Marker(view).apply { position = point; title = "Start" } }
                points.last().let { point -> view.overlays += Marker(view).apply { position = point; title = "Destination" } }
                view.controller.setCenter(points[points.size / 2])
            }
            view.invalidate()
        })
        Text(
            "© OpenStreetMap contributors",
            color = Color.DarkGray,
            style = androidx.compose.material3.MaterialTheme.typography.labelSmall,
            modifier = Modifier.align(Alignment.BottomEnd).padding(6.dp),
        )
    }
}

@Composable
private fun NavigationStep(step: BackendTransportLeg, number: Int, total: Int) {
    Column(Modifier.fillMaxWidth().panelCard(16).padding(17.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
        Text("Step $number of $total", color = FanColors.teal, fontWeight = FontWeight.Bold)
        Text(step.instruction ?: step.description, fontWeight = FontWeight.Bold)
        Text("${step.from} → ${step.to}", color = FanColors.muted)
        Text("${step.durationSeconds.toInt() / 60} min", color = FanColors.muted)
    }
}
