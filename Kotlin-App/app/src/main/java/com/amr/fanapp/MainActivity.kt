package com.amr.fanapp

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import com.amr.fanapp.ui.navigation.MainNavHost
import com.amr.fanapp.ui.theme.FanTheme

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) { super.onCreate(savedInstanceState); setContent { FanTheme { MainNavHost() } } }
}
