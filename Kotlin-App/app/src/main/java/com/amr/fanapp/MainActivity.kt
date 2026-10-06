package com.amr.fanapp

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.viewModels
import com.amr.fanapp.session.SessionViewModel
import com.amr.fanapp.ui.navigation.MainNavHost
import com.amr.fanapp.ui.theme.FanTheme

class MainActivity : ComponentActivity() {
    private val session: SessionViewModel by viewModels()

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        handleAuthenticationIntent(intent)
        setContent { FanTheme { MainNavHost(session) } }
    }

    override fun onNewIntent(intent: android.content.Intent) {
        super.onNewIntent(intent)
        setIntent(intent)
        handleAuthenticationIntent(intent)
    }

    private fun handleAuthenticationIntent(intent: android.content.Intent?) {
        session.handleAuthCallback(intent?.data)
    }
}
