package com.amr.fanapp.ui.navigation

import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.Send
import androidx.compose.material.icons.filled.CardGiftcard
import androidx.compose.material.icons.filled.Home
import androidx.compose.material.icons.filled.Park
import androidx.compose.material3.Icon
import androidx.compose.material3.NavigationBar
import androidx.compose.material3.NavigationBarDefaults
import androidx.compose.material3.NavigationBarItem
import androidx.compose.material3.NavigationBarItemDefaults
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.RectangleShape
import com.amr.fanapp.domain.FanTab
import com.amr.fanapp.ui.theme.FanColors

@Composable
fun BottomBar(selected: FanTab?, onSelect: (FanTab) -> Unit, onTravel: () -> Unit) {
    // The app shell consumes system insets once for every destination.
    NavigationBar(
        modifier = androidx.compose.ui.Modifier.clip(RectangleShape),
        containerColor = FanColors.panel,
        windowInsets = NavigationBarDefaults.windowInsets,
    ) {
        val colors = NavigationBarItemDefaults.colors(
            selectedIconColor = Color.White,
            selectedTextColor = Color.White,
            indicatorColor = FanColors.teal.copy(alpha = .35f),
            unselectedIconColor = FanColors.muted,
            unselectedTextColor = FanColors.muted,
        )
        FanTab.entries.forEach { tab ->
            NavigationBarItem(
                selected = selected == tab,
                onClick = { onSelect(tab) },
                icon = {
                    Icon(when (tab) {
                        FanTab.HOME -> Icons.Filled.Home
                        FanTab.REWARDS -> Icons.Filled.CardGiftcard
                        FanTab.IMPACT -> Icons.Filled.Park
                    }, contentDescription = null)
                },
                label = { Text(tab.label) },
                colors = colors,
            )
        }
        NavigationBarItem(
            selected = selected == null,
            onClick = onTravel,
            icon = { Icon(Icons.AutoMirrored.Filled.Send, contentDescription = null) },
            label = { Text("Travel") },
            colors = colors,
        )
    }
}
