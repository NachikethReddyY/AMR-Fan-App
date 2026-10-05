package com.amr.fanapp.ui.screens

import android.content.Context
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ArrowBack
import androidx.compose.material.icons.filled.ChevronRight
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.material3.LocalContentColor
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.amr.fanapp.ui.theme.FanColors
import com.amr.fanapp.ui.theme.FanButton
import com.amr.fanapp.ui.theme.panelCard

@Composable
fun ScreenColumn(content: @Composable ColumnScope.() -> Unit) {
    Column(
        modifier = Modifier.fillMaxSize().background(FanColors.background).padding(horizontal = 22.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp),
        content = content,
    )
}

@Composable
fun BackButton(onBack: () -> Unit, modifier: Modifier = Modifier) {
    IconButton(
        onClick = onBack,
        modifier = modifier
            .size(44.dp)
            .background(FanColors.panel, CircleShape)
            .border(1.dp, Color.White.copy(alpha = .12f), CircleShape),
    ) {
        Icon(Icons.Filled.ArrowBack, contentDescription = "Back")
    }
}

@Composable
fun DetailScreen(onBack: () -> Unit, content: @Composable () -> Unit) {
    Column(Modifier.fillMaxSize().background(FanColors.background)) {
        Row(
            Modifier.fillMaxWidth().padding(horizontal = 22.dp, vertical = 6.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            BackButton(onBack)
        }
        Box(Modifier.fillMaxWidth().weight(1f)) { content() }
    }
}

@Composable
fun SectionHeader(title: String, description: String, modifier: Modifier = Modifier) {
    Column(modifier, verticalArrangement = Arrangement.spacedBy(8.dp)) {
        Text(title, fontSize = 38.sp, lineHeight = 40.sp, fontWeight = FontWeight.Bold)
        Text(description, color = FanColors.muted, style = MaterialTheme.typography.bodyMedium)
    }
}

@Composable fun SectionTitle(text: String) = Text(text, style = MaterialTheme.typography.headlineSmall)

@Composable
fun EmptyFeature(title: String, description: String, onBack: (() -> Unit)? = null) {
    ScreenColumn {
        Spacer(Modifier.height(18.dp))
        SectionHeader(title, description)
        Spacer(Modifier.weight(1f))
        onBack?.let { FanButton("Back", it, Modifier.fillMaxWidth()) }
        Spacer(Modifier.height(30.dp))
    }
}

@Composable
fun FeatureCard(modifier: Modifier = Modifier, content: @Composable ColumnScope.() -> Unit) {
    CompositionLocalProvider(LocalContentColor provides Color.White) {
        Column(modifier = modifier.fillMaxWidth().panelCard(22).padding(20.dp), verticalArrangement = Arrangement.spacedBy(9.dp), content = content)
    }
}

@Composable
fun ListCard(title: String, body: String, onClick: (() -> Unit)? = null) {
    Row(
        Modifier.fillMaxWidth().panelCard().padding(16.dp),
        horizontalArrangement = Arrangement.spacedBy(12.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(4.dp)) {
            Text(title, fontWeight = FontWeight.Bold)
            Text(body, color = FanColors.muted, style = MaterialTheme.typography.bodySmall)
        }
        onClick?.let { FanButton("Open", it) }
    }
}

@Composable
fun CircleIcon(symbol: @Composable () -> Unit, size: Dp, modifier: Modifier = Modifier) {
    Box(
        modifier = modifier.size(size)
            .background(Brush.verticalGradient(listOf(Color.White.copy(.18f), Color.White.copy(.06f))), CircleShape)
            .border(1.dp, Color.White.copy(.12f), CircleShape),
        contentAlignment = Alignment.Center,
    ) { symbol() }
}

@Composable
fun ImageAsset(name: String, modifier: Modifier = Modifier, contentDescription: String? = null) {
    val context = LocalContext.current
    val resourceId = remember(name) { drawableId(context, name) }
    if (resourceId != 0) {
        androidx.compose.foundation.Image(painterResource(resourceId), contentDescription, modifier, contentScale = ContentScale.Crop)
    } else {
        Box(modifier.background(FanColors.darkTeal), contentAlignment = Alignment.Center) { Text("AMR", color = FanColors.teal, fontWeight = FontWeight.Black) }
    }
}

fun drawableId(context: Context, name: String): Int = context.resources.getIdentifier(name.lowercase().replace("-", "_"), "drawable", context.packageName)

@Composable
fun ActionRow(title: String, detail: String, onClick: () -> Unit, icon: @Composable () -> Unit) {
    Row(
        Modifier.fillMaxWidth().panelCard(16).clickable(onClick = onClick).padding(17.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(14.dp),
    ) {
        Box(Modifier.size(46.dp).background(Color.White.copy(.07f), RoundedCornerShape(14.dp)), contentAlignment = Alignment.Center) { icon() }
        Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(4.dp)) { Text(title, fontWeight = FontWeight.Bold); Text(detail, color = FanColors.muted, style = MaterialTheme.typography.bodySmall) }
        Icon(Icons.Filled.ChevronRight, contentDescription = null, tint = FanColors.muted)
    }
}
