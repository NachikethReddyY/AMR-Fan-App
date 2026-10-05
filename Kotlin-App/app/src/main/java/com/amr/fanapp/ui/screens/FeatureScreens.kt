package com.amr.fanapp.ui.screens

import android.net.Uri
import android.content.Intent
import android.widget.Toast
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.ArrowBack
import androidx.compose.material.icons.filled.ArrowUpward
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.ChevronRight
import androidx.compose.material.icons.filled.Flag
import androidx.compose.material.icons.filled.History
import androidx.compose.material.icons.filled.Info
import androidx.compose.material.icons.filled.Newspaper
import androidx.compose.material.icons.filled.Park
import androidx.compose.material.icons.filled.Person
import androidx.compose.material.icons.filled.PhotoCamera
import androidx.compose.material.icons.filled.PlayCircle
import androidx.compose.material.icons.filled.Quiz
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material.icons.filled.Send
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberUpdatedState
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import coil3.compose.AsyncImage
import com.amr.fanapp.domain.DemoFanState
import com.amr.fanapp.domain.Driver
import com.amr.fanapp.domain.FanDestination
import com.amr.fanapp.ui.theme.FanColors
import com.amr.fanapp.ui.theme.FanButton
import com.amr.fanapp.ui.theme.panelCard
import com.amr.fanapp.session.SessionViewModel
import com.amr.fanapp.network.BackendActivityResponse
import androidx.compose.runtime.rememberCoroutineScope
import kotlinx.coroutines.launch
import com.amr.fanapp.rss.RssParser
import com.amr.fanapp.rss.RssStory
import com.amr.fanapp.rss.formatRssDate
import java.net.HttpURLConnection
import java.net.URL
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext

@Composable
fun NewsFeedScreen(onBack: () -> Unit) {
    var stories by remember { mutableStateOf<List<RssStory>?>(null) }
    var failed by remember { mutableStateOf(false) }
    var refresh by remember { mutableStateOf(0) }
    LaunchedEffect(refresh) {
        stories = null
        failed = false
        runCatching { loadNewsFeed() }
            .onSuccess { stories = it }
            .onFailure { failed = true }
    }
    Column(Modifier.fillMaxWidth().verticalScroll(rememberScrollState()).background(FanColors.background).padding(horizontal = 20.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
        Text("Latest", fontSize = 36.sp, fontWeight = FontWeight.Bold)
        when {
            stories == null && !failed -> Column(Modifier.fillMaxWidth().padding(vertical = 70.dp), horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(14.dp)) { CircularProgressIndicator(color = FanColors.teal); Text("Loading the latest stories…", color = FanColors.muted) }
            failed -> FeatureCard { Icon(Icons.Filled.Info, contentDescription = null, tint = FanColors.teal); Text("News unavailable", fontWeight = FontWeight.Bold); Text("We couldn't reach the team feed. Check your connection and try again.", color = FanColors.muted); FanButton("Try again", { refresh++ }) }
            stories.orEmpty().isEmpty() -> FeatureCard { Text("No stories yet", fontWeight = FontWeight.Bold); Text("There are no stories in the feed right now.", color = FanColors.muted) }
            else -> stories.orEmpty().forEach { story -> NewsCard(story) }
        }
        Spacer(Modifier.height(25.dp))
    }
}

@Composable
private fun NewsCard(story: RssStory) {
    val context = LocalContext.current
    Column(Modifier.fillMaxWidth().panelCard(22).clickable {
        val intent = Intent(Intent.ACTION_VIEW, Uri.parse(story.link))
        if (intent.resolveActivity(context.packageManager) != null) context.startActivity(intent)
    }, verticalArrangement = Arrangement.spacedBy(0.dp)) {
        Box(Modifier.fillMaxWidth().height(190.dp).background(Brush.linearGradient(listOf(FanColors.darkTeal, FanColors.panel)), RoundedCornerShape(topStart = 22.dp, topEnd = 22.dp)), contentAlignment = Alignment.Center) {
            Icon(Icons.Filled.Newspaper, contentDescription = null, tint = FanColors.teal, modifier = Modifier.size(52.dp))
            story.imageUrl?.let { AsyncImage(model = it, contentDescription = null, modifier = Modifier.fillMaxSize(), contentScale = ContentScale.Crop) }
        }
        Column(Modifier.padding(18.dp), verticalArrangement = Arrangement.spacedBy(9.dp)) { formatRssDate(story.published)?.let { Text(it, color = FanColors.teal, fontSize = 11.sp, fontWeight = FontWeight.SemiBold) }; Text(story.title, fontSize = 22.sp, fontWeight = FontWeight.Bold); Text(story.summary.ifBlank { "Aston Martin Aramco team news." }, color = FanColors.muted, maxLines = 3); Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) { Text("Read story", fontWeight = FontWeight.Bold); Icon(Icons.Filled.ArrowUpward, contentDescription = null, modifier = Modifier.size(15.dp)) } }
    }
}

private suspend fun loadNewsFeed(): List<RssStory> = withContext(Dispatchers.IO) {
    val connection = (URL("https://green-sky-08b27ad10.4.azurestaticapps.net/feed.xml").openConnection() as HttpURLConnection).apply { connectTimeout = 8_000; readTimeout = 8_000; requestMethod = "GET" }
    try {
        if (connection.responseCode !in 200..299) error("RSS returned HTTP ${connection.responseCode}")
        connection.inputStream.use(RssParser::parse)
    } finally {
        connection.disconnect()
    }
}

@Composable
fun ShopScreen(onBack: () -> Unit) {
    val products = listOf(
        "merch_701238091_trueblack_product" to "Stealth Sweater",
        "merch_701238092_amgreen_product" to "Seasonal Polo",
        "merch_701238353_greenlux_product" to "PUMA Cap",
        "merch_701238354_pumablack_product" to "PUMA Bomber Jacket",
        "merch_701238357_pumablack_product" to "PUMA Jersey",
        "merch_701238098_multicolor_product" to "Team Keyring",
    )
    Column(Modifier.fillMaxWidth().verticalScroll(rememberScrollState()).background(FanColors.background).padding(horizontal = 22.dp), verticalArrangement = Arrangement.spacedBy(20.dp)) {
        SectionHeader("Merchandise", "The full team catalog.", Modifier.padding(top = 12.dp))
        Row(Modifier.fillMaxWidth().horizontalScroll(rememberScrollState()), horizontalArrangement = Arrangement.spacedBy(9.dp)) { listOf("Caps", "T-shirts", "Outerwear", "Other").forEach { Text(it, color = FanColors.muted, fontWeight = FontWeight.Bold, modifier = Modifier.background(FanColors.panel, RoundedCornerShape(50)).padding(horizontal = 16.dp, vertical = 11.dp)) } }
        Text("All products", style = androidx.compose.material3.MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold)
        Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
            products.chunked(2).forEach { row -> Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(12.dp)) { row.forEach { (asset, title) -> ProductCard(asset, title, Modifier.weight(1f)) } } }
        }
        Spacer(Modifier.height(30.dp))
    }
}

@Composable private fun ProductCard(asset: String, title: String, modifier: Modifier = Modifier) { Column(modifier.panelCard(19).padding(10.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) { ImageAsset(asset, Modifier.fillMaxWidth().height(150.dp), title); Text("20% off · $title", fontWeight = FontWeight.Bold); Text("In stock", color = FanColors.teal, style = androidx.compose.material3.MaterialTheme.typography.bodySmall); Text("450 Green Points", color = Color.White, modifier = Modifier.fillMaxWidth().background(FanColors.teal, RoundedCornerShape(11.dp)).padding(9.dp)) } }

@Composable fun ProfileScreen(driver: Driver, onBack: () -> Unit) {
    Column(Modifier.fillMaxWidth().verticalScroll(rememberScrollState()).padding(horizontal = 22.dp), verticalArrangement = Arrangement.spacedBy(20.dp)) {
        SectionHeader("Profile.", "Your driver. Your journey.", Modifier.padding(top = 24.dp))
        ImageAsset(driver.imageAsset, Modifier.fillMaxWidth().height(235.dp), "${driver.firstName} ${driver.displayName}")
        FeatureCard { Icon(Icons.Filled.Flag, contentDescription = null, tint = FanColors.teal); Text("${driver.firstName} ${driver.displayName} · #${driver.number}", style = androidx.compose.material3.MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold); Text("Your choice is saved on this device.", color = FanColors.muted) }
        FanButton("Change your driver", {}, Modifier.fillMaxWidth())
        FanButton("Sign in or create account", {}, Modifier.fillMaxWidth())
        FanButton("Explore app features", {}, Modifier.fillMaxWidth())
        Text("Sign in to sync your backend profile and earned balance.", color = FanColors.muted, style = androidx.compose.material3.MaterialTheme.typography.bodySmall)
        Spacer(Modifier.height(25.dp))
    }
}

@Composable fun HistoryScreen(onBack: () -> Unit) { Column(Modifier.fillMaxWidth().padding(22.dp), verticalArrangement = Arrangement.spacedBy(24.dp)) { SectionHeader("History.", "Your journeys and points.", Modifier.padding(top = 20.dp)); FeatureCard { Icon(Icons.Filled.History, contentDescription = null, tint = FanColors.teal); Text("No activity yet", fontWeight = FontWeight.Bold); Text("Every great journey begins somewhere.", color = FanColors.muted) }; Spacer(Modifier.weight(1f)) } }

@Composable fun TreeScreen(state: DemoFanState, onBack: () -> Unit) { Column(Modifier.fillMaxWidth().verticalScroll(rememberScrollState()).padding(horizontal = 22.dp), verticalArrangement = Arrangement.spacedBy(16.dp)) { SectionHeader("Your digital forest", "Redeemed plantings stay pending until the AMR team assigns a real-world location.", Modifier.padding(top = 20.dp)); FeatureCard { Icon(Icons.Filled.Park, contentDescription = null, tint = FanColors.teal); Text("${state.plantedTrees.size} plantings", fontWeight = FontWeight.Bold); Text("${state.totalEstimatedCarbonKg} kg CO₂e estimated", color = FanColors.muted) }; if (state.plantedTrees.isEmpty()) FeatureCard { Text("No plantings yet", fontWeight = FontWeight.Bold); Text("Use the rewards catalogue to add a tree, bush, or plant.", color = FanColors.muted) } else state.plantedTrees.forEach { ListCard(it.kind.label, "${it.status.name.lowercase()} · ${it.carbonSavedKg} kg CO₂e") }; Spacer(Modifier.height(25.dp)) } }

@Composable fun ChallengesScreen(onBack: () -> Unit) { var showComposer by remember { mutableStateOf(false) }; Column(Modifier.fillMaxWidth().verticalScroll(rememberScrollState()).padding(horizontal = 22.dp), verticalArrangement = Arrangement.spacedBy(16.dp)) { SectionHeader("Fan challenges.", "Choose a race, vote for an idea, or propose what comes next.", Modifier.padding(top = 20.dp)); Row(Modifier.fillMaxWidth().panelCard(18).padding(16.dp), verticalAlignment = Alignment.CenterVertically) { Icon(Icons.Filled.Flag, contentDescription = null, tint = FanColors.teal); Text("9,000 Green Points", fontWeight = FontWeight.Bold, modifier = Modifier.padding(start = 10.dp)); Spacer(Modifier.weight(1f)); Text("500 to submit", color = FanColors.muted, style = androidx.compose.material3.MaterialTheme.typography.bodySmall) }; listOf("Aston Martin Fan Challenge", "Race-weekend travel idea", "Community green lap").forEach { title -> ActionRow(title, "by AMR fan · Add points", {}) { Icon(Icons.Filled.ArrowUpward, contentDescription = null, tint = FanColors.teal) } }; if (showComposer) FeatureCard { Text("Propose a challenge", fontWeight = FontWeight.Bold); Text("Your idea stays pending admin review.", color = FanColors.muted); FanButton("Submit challenge", { showComposer = false }) }; FanButton(if (showComposer) "Close composer" else "Propose a challenge", { showComposer = !showComposer }, Modifier.fillMaxWidth()); Spacer(Modifier.height(25.dp)) } }

@Composable fun QuizScreen(state: DemoFanState, onState: (DemoFanState) -> Unit, onBack: () -> Unit) { var selected by remember { mutableStateOf<Int?>(null) }; var completed by remember { mutableStateOf(false) }; val answers = listOf("The race is over", "A safety car is out", "The pits are open"); Column(Modifier.fillMaxWidth().verticalScroll(rememberScrollState()).padding(horizontal = 22.dp), verticalArrangement = Arrangement.spacedBy(16.dp)) { SectionHeader("Race IQ.", "Complete today's quiz to earn 100 Green Points.", Modifier.padding(top = 20.dp)); Text("QUESTION 1 / 1", color = FanColors.teal, fontWeight = FontWeight.Black); FeatureCard { Text("What does the chequered flag mean?", fontSize = 27.sp, fontWeight = FontWeight.Bold) }; if (!completed) { answers.forEachIndexed { index, answer -> Row(Modifier.fillMaxWidth().panelCard(17).clickable { selected = index }.padding(19.dp), verticalAlignment = Alignment.CenterVertically) { Text(answer, fontWeight = FontWeight.Bold, modifier = Modifier.weight(1f)); if (selected == index) Icon(if (index == 0) Icons.Filled.CheckCircle else Icons.Filled.Info, contentDescription = null, tint = FanColors.teal) } }; if (selected != null) FanButton("See results", { completed = true; onState(state.claimDailyQuizReward()) }, Modifier.fillMaxWidth()) } else FeatureCard { Icon(Icons.Filled.Flag, contentDescription = null, tint = FanColors.teal); Text(if (selected == 0) "1 out of 1" else "0 out of 1", fontSize = 35.sp, fontWeight = FontWeight.Bold); Text("Today's reward has been added to your Green Points. Come back tomorrow for the next quiz.", color = FanColors.muted) }; Spacer(Modifier.height(25.dp)) } }

@Composable fun FeatureTourScreen(onBack: () -> Unit) = EmptyFeature("Explore the app", "Follow your driver, plan travel, earn rewards, and see your impact.", onBack)

private enum class CameraPhase { Capturing, Confirming, Processing, Result }

@Composable
fun SustainabilityCamScreen(onBack: () -> Unit, session: SessionViewModel) {
    var selected by remember { mutableStateOf<Uri?>(null) }
    var cleanupCamera by remember { mutableStateOf<(() -> Unit)?>(null) }
    var result by remember { mutableStateOf<BackendActivityResponse?>(null) }
    var phase by remember { mutableStateOf(CameraPhase.Capturing) }
    var error by remember { mutableStateOf<String?>(null) }
    val scope = rememberCoroutineScope()
    val latestCleanup by rememberUpdatedState(cleanupCamera)
    val context = LocalContext.current
    DisposableEffect(Unit) { onDispose { latestCleanup?.invoke() } }
    if (phase == CameraPhase.Capturing || selected == null) {
        CameraPreview(
            onSelected = { uri, cleanup -> selected = uri; cleanupCamera = cleanup; phase = CameraPhase.Confirming },
            onBack = onBack,
        )
    } else if (phase == CameraPhase.Processing) {
        Box(Modifier.fillMaxSize().background(Color.Black), contentAlignment = Alignment.Center) {
            Column(horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(14.dp)) {
                CircularProgressIndicator(color = FanColors.teal)
                Text("Checking photo", color = Color.White, fontWeight = FontWeight.Bold)
            }
        }
    } else if (phase == CameraPhase.Result) {
        val value = result
        Box(Modifier.fillMaxSize().background(Color.Black)) {
            BackButton({ phase = CameraPhase.Capturing; selected = null; result = null }, Modifier.align(Alignment.TopStart).padding(20.dp))
            Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(horizontal = 22.dp).padding(top = 100.dp), verticalArrangement = Arrangement.spacedBy(18.dp)) {
                Text("Result", fontSize = 34.sp, fontWeight = FontWeight.Bold)
                FeatureCard {
                    Icon(if (value?.kind == "accepted") Icons.Filled.CheckCircle else Icons.Filled.Info, contentDescription = null, tint = FanColors.teal)
                    Text(if (value?.kind == "accepted") "Activity verified" else "No points yet", fontWeight = FontWeight.Bold)
                    Text("${value?.evidenceScore ?: 0}/100", fontSize = 34.sp, fontWeight = FontWeight.Bold, color = FanColors.teal)
                    Text("${value?.creditedPoints ?: 0} points", fontWeight = FontWeight.Bold)
                    value?.category?.let { Text(it.replace('_', ' '), color = FanColors.muted) }
                    value?.rationale?.let { Text(it, color = FanColors.muted) }
                    value?.reason?.let { Text(it.replace('_', ' '), color = FanColors.orange) }
                }
                CameraActionButton("Retake photo", {
                    cleanupCamera?.invoke(); cleanupCamera = null; selected = null; result = null; phase = CameraPhase.Capturing
                })
            }
        }
    } else {
        Box(Modifier.fillMaxSize().background(Color.Black)) {
            AsyncImage(
                model = selected,
                contentDescription = "Captured photo",
                modifier = Modifier.fillMaxSize(),
                contentScale = ContentScale.Fit,
            )
            Box(Modifier.fillMaxSize().background(Color.Black.copy(alpha = .18f)))
            BackButton(onBack, Modifier.align(Alignment.TopStart).padding(20.dp))
            Column(
                Modifier
                    .align(Alignment.BottomCenter)
                    .fillMaxWidth()
                    .padding(12.dp)
                    .background(FanColors.panel, RoundedCornerShape(20.dp))
                    .border(1.dp, Color.White.copy(alpha = .12f), RoundedCornerShape(20.dp))
                    .padding(18.dp),
                verticalArrangement = Arrangement.spacedBy(10.dp),
            ) {
                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                    Box(
                        Modifier.size(34.dp).background(FanColors.teal, RoundedCornerShape(10.dp)),
                        contentAlignment = Alignment.Center,
                    ) { Icon(Icons.Filled.PhotoCamera, contentDescription = null, tint = Color.Black, modifier = Modifier.size(20.dp)) }
                    Text("Ready to send?", fontSize = 28.sp, fontWeight = FontWeight.Bold)
                }
                CameraActionButton("Use this photo", {
                    if (phase == CameraPhase.Confirming) scope.launch {
                        phase = CameraPhase.Processing
                        error = null
                        runCatching { session.verifyActivity(selected!!) }
                            .onSuccess { result = it; phase = CameraPhase.Result }
                            .onFailure { error = it.message ?: "Analysis unavailable."; phase = CameraPhase.Confirming }
                    }
                }, filled = true)
                CameraActionButton("Retake photo", {
                    cleanupCamera?.invoke()
                    cleanupCamera = null
                    selected = null
                    result = null
                    error = null
                    phase = CameraPhase.Capturing
                })
                error?.let { Text(it, color = FanColors.orange) }
            }
        }
    }
}

@Composable
private fun CameraActionButton(label: String, onClick: () -> Unit, filled: Boolean = false) {
    val shape = RoundedCornerShape(3.dp)
    Box(
        Modifier
            .fillMaxWidth()
            .height(48.dp)
            .background(if (filled) FanColors.teal else Color.Transparent, shape)
            .border(1.dp, if (filled) Color.Transparent else FanColors.teal.copy(alpha = .72f), shape)
            .clickable(onClick = onClick),
        contentAlignment = Alignment.Center,
    ) { Text(label, color = if (filled) Color.Black else Color.White, fontWeight = FontWeight.Bold) }
}
