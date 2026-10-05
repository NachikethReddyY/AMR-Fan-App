package com.amr.fanapp.ui.navigation

import androidx.compose.animation.core.tween
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.material3.Scaffold
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.Modifier
import androidx.lifecycle.viewmodel.compose.viewModel
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.currentBackStackEntryAsState
import androidx.navigation.compose.rememberNavController
import kotlinx.coroutines.launch
import com.amr.fanapp.domain.DemoFanState
import com.amr.fanapp.domain.Driver
import com.amr.fanapp.domain.FanDestination
import com.amr.fanapp.domain.FanTab
import com.amr.fanapp.domain.PreferencesStore
import com.amr.fanapp.network.BackendAccount
import com.amr.fanapp.session.SessionViewModel
import com.amr.fanapp.ui.screens.AccountScreen
import com.amr.fanapp.ui.screens.ChallengesScreen
import com.amr.fanapp.ui.screens.DriverSelectionScreen
import com.amr.fanapp.ui.screens.DetailScreen
import com.amr.fanapp.ui.screens.EmptyFeature
import com.amr.fanapp.ui.screens.F1IntroScreen
import com.amr.fanapp.ui.screens.HistoryScreen
import com.amr.fanapp.ui.screens.HomeScreen
import com.amr.fanapp.ui.screens.ImpactScreen
import com.amr.fanapp.ui.screens.LoginGateScreen
import com.amr.fanapp.ui.screens.NewsFeedScreen
import com.amr.fanapp.ui.screens.OnboardingScreen
import com.amr.fanapp.ui.screens.ProfileScreen
import com.amr.fanapp.ui.screens.QuizScreen
import com.amr.fanapp.ui.screens.RewardsScreen
import com.amr.fanapp.ui.screens.ShopScreen
import com.amr.fanapp.ui.screens.SustainabilityCamScreen
import com.amr.fanapp.ui.screens.TravelScreen
import com.amr.fanapp.ui.screens.TreeScreen
import com.amr.fanapp.ui.theme.FanColors

private object Routes {
    const val INTRO = "intro"
    const val ONBOARDING = "onboarding"
    const val DRIVER = "driver"
    const val LOGIN = "login"
    const val MAIN = "main"
    const val HOME = "home"
    const val REWARDS = "rewards"
    const val IMPACT = "impact"
    const val DETAIL = "detail"
    const val DETAIL_WITH_ARGUMENT = "$DETAIL/{destination}"

    fun detail(destination: FanDestination) = "$DETAIL/${destination.name}"
}

@Composable
fun MainNavHost(session: SessionViewModel = viewModel()) {
    val context = LocalContext.current
    val preferences = remember(context) { PreferencesStore(context) }
    val savedDriverName by preferences.driver.collectAsState(initial = null)
    val isRestoring by session.isRestoring.collectAsState()
    val preferenceScope = rememberCoroutineScope()
    var driver by rememberSaveable { mutableStateOf<Driver?>(null) }
    var state by remember { mutableStateOf(DemoFanState(greenPoints = 9_000)) }
    val account by session.account.collectAsState()
    val navController = rememberNavController()

    LaunchedEffect(savedDriverName) {
        if (driver == null) {
            driver = savedDriverName?.let { name -> runCatching { Driver.valueOf(name) }.getOrNull() }
        }
    }
    LaunchedEffect(account, driver, isRestoring) {
        if (isRestoring || driver == null) return@LaunchedEffect
        val destination = if (account == null) Routes.LOGIN else Routes.MAIN
        val current = navController.currentDestination?.route
        if (current == destination) return@LaunchedEffect
        val removable = setOf(Routes.INTRO, Routes.ONBOARDING, Routes.DRIVER, Routes.LOGIN)
        if (current !in removable) return@LaunchedEffect
        navController.navigate(destination) {
            popUpTo(current!!) { inclusive = true }
            launchSingleTop = true
        }
    }

    Box(
        Modifier
            .fillMaxSize()
            .background(FanColors.background)
            .statusBarsPadding(),
    ) {
        NavHost(navController = navController, startDestination = Routes.INTRO, modifier = Modifier.fillMaxSize(),
            enterTransition = { fadeIn(tween(120)) },
            exitTransition = { fadeOut(tween(120)) },
            popEnterTransition = { fadeIn(tween(120)) },
            popExitTransition = { fadeOut(tween(120)) },
        ) {
            composable(Routes.INTRO) {
                F1IntroScreen {
                    navController.navigate(Routes.ONBOARDING) {
                        popUpTo(Routes.INTRO) { inclusive = true }
                    }
                }
            }
            composable(Routes.ONBOARDING) {
                OnboardingScreen {
                    navController.navigate(Routes.DRIVER) {
                        popUpTo(Routes.ONBOARDING) { inclusive = true }
                    }
                }
            }
            composable(Routes.DRIVER) {
                DriverSelectionScreen(
                    onSelect = { selected ->
                        driver = selected
                        preferenceScope.launch { preferences.saveDriver(selected) }
                        navController.navigate(Routes.LOGIN) {
                            popUpTo(Routes.DRIVER) { inclusive = true }
                        }
                    },
                )
            }
            composable(Routes.LOGIN) {
                val context = LocalContext.current
                val authError by session.errorMessage.collectAsState()
                LaunchedEffect(account, driver) {
                    if (account != null && driver != null) {
                        navController.navigate(Routes.MAIN) {
                            popUpTo(Routes.LOGIN) { inclusive = true }
                        }
                    }
                }
                LoginGateScreen({ session.beginSignIn(context) }, authError)
            }
            composable(Routes.MAIN) {
                val selectedDriver = driver
                if (selectedDriver == null) {
                    LaunchedEffect(Unit) { navController.popBackStack(Routes.DRIVER, false) }
                } else {
                    MainShell(
                        driver = selectedDriver,
                        state = state,
                        onState = { state = it },
                        account = account,
                        session = session,
                    )
                }
            }
        }
    }
}

@Composable
private fun MainShell(
    driver: Driver,
    state: DemoFanState,
    onState: (DemoFanState) -> Unit,
    account: BackendAccount?,
    session: SessionViewModel,
) {
    val navController = rememberNavController()
    val backStackEntry by navController.currentBackStackEntryAsState()
    val currentRoute = backStackEntry?.destination?.route
    val selectedTab = when (currentRoute) {
        Routes.REWARDS -> FanTab.REWARDS
        Routes.IMPACT -> FanTab.IMPACT
        else -> FanTab.HOME
    }
    val travelSelected = backStackEntry?.arguments?.getString("destination") == FanDestination.TRAVEL.name
    val showBottomBar = travelSelected || currentRoute == Routes.HOME || currentRoute == Routes.REWARDS || currentRoute == Routes.IMPACT

    Scaffold(
        containerColor = FanColors.background,
        contentWindowInsets = WindowInsets(0, 0, 0, 0),
        bottomBar = {
            if (showBottomBar) {
                BottomBar(
                    selectedTab.takeUnless { travelSelected },
                    onSelect = { tab -> navController.navigate(tab.route()) { selectTabBackStack() } },
                    onTravel = { navController.navigate(Routes.detail(FanDestination.TRAVEL)) { selectTabBackStack() } },
                )
            }
        },
    ) { padding ->
        NavHost(
            navController = navController,
            startDestination = Routes.HOME,
            modifier = Modifier.fillMaxSize().padding(padding),
            enterTransition = { fadeIn(tween(120)) },
            exitTransition = { fadeOut(tween(120)) },
            popEnterTransition = { fadeIn(tween(120)) },
            popExitTransition = { fadeOut(tween(120)) },
        ) {
            composable(Routes.HOME) {
                HomeScreen(driver, account, state) { destination -> navController.navigate(Routes.detail(destination)) }
            }
            composable(Routes.REWARDS) {
                RewardsScreen(state, { destination -> navController.navigate(Routes.detail(destination)) }, Modifier.fillMaxSize(), driver)
            }
            composable(Routes.IMPACT) {
                ImpactScreen(state, { destination -> navController.navigate(Routes.detail(destination)) }, Modifier.fillMaxSize())
            }
            composable(Routes.DETAIL_WITH_ARGUMENT) { entry ->
                val destination = entry.arguments?.getString("destination")?.let { name ->
                    runCatching { FanDestination.valueOf(name) }.getOrNull()
                }
                if (destination == null) {
                    DetailScreen(navController::popBackStack) {
                        EmptyFeature("Missing page", "This destination is not available.")
                    }
                } else {
                    DestinationContent(destination, driver, state, onState, account, session, navController::popBackStack)
                }
            }
        }
    }
}

private fun FanTab.route() = when (this) {
    FanTab.HOME -> Routes.HOME
    FanTab.REWARDS -> Routes.REWARDS
    FanTab.IMPACT -> Routes.IMPACT
}

private fun androidx.navigation.NavOptionsBuilder.selectTabBackStack() {
    popUpTo(Routes.HOME) { saveState = true }
    launchSingleTop = true
    restoreState = true
}

@Composable
private fun DestinationContent(
    page: FanDestination,
    driver: Driver,
    state: DemoFanState,
    onState: (DemoFanState) -> Unit,
    account: BackendAccount?,
    session: SessionViewModel,
    close: () -> Unit,
) {
    if (page == FanDestination.CAMERA) {
        SustainabilityCamScreen(close, session)
    } else {
        DetailScreen(close) {
            when (page) {
                FanDestination.NEWS -> NewsFeedScreen(close)
                FanDestination.OFFERS, FanDestination.CAPS, FanDestination.TSHIRTS, FanDestination.OUTERWEAR, FanDestination.OTHER -> ShopScreen(close)
                FanDestination.PROFILE -> ProfileScreen(driver, close)
                FanDestination.ACCOUNT -> AccountScreen(account) { session.signOut(); close() }
                FanDestination.TRAVEL -> TravelScreen(close, session)
                FanDestination.TREE -> TreeScreen(state, close)
                FanDestination.HISTORY -> HistoryScreen(close)
                FanDestination.CHALLENGES -> ChallengesScreen(close)
                FanDestination.QUIZ -> QuizScreen(state, onState, close)
                FanDestination.CONTENT -> EmptyFeature("Stories.", "Team access and editorial stories will appear here when connected.")
                else -> EmptyFeature(page.name.lowercase().replace('_', ' '), "This feature is ready for the Kotlin port.")
            }
        }
    }
}
